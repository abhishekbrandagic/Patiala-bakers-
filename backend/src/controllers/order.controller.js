import crypto from "node:crypto";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { Enquiry } from "../models/Enquiry.js";
import { nextSeq } from "../models/misc.js";
import { User } from "../models/User.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { badRequest, forbidden, notFound, paginate } from "../utils/http.js";
import { getSettings } from "../services/settings.service.js";
import {
  applyPayment,
  createOrder,
  notifyNewOrder,
} from "../services/order.service.js";
import {
  createCheckoutSession,
  getStripe,
} from "../services/payment.service.js";
import {
  MAX_REFERENCE_IMAGES,
  REFERENCE_FOLDER,
  storeImage,
} from "../services/upload.service.js";
import { enquiryReceivedEmail, sendMail } from "../services/email.service.js";
import { enquirySchema, staffEnquirySchema } from "../validators/schemas.js";
import { WALK_IN_EMAIL } from "../config/constants.js";
import { samePhone } from "../utils/phone.js";
import { addDays, nowParts } from "../utils/time.js";
import { assertPickupValid } from "../services/slots.service.js";

const PUBLIC_FIELDS =
  "orderNumber customer items pickupDate pickupTime notes subtotal fees discount total depositDue depositPercent amountPaid paymentStatus paymentMethod status createdAt history source";

function publicOrder(o) {
  const j = o.toJSON();
  return {
    orderNumber: j.orderNumber,
    customer: j.customer,
    items: j.items,
    pickupDate: j.pickupDate,
    pickupTime: j.pickupTime,
    notes: j.notes,
    subtotal: j.subtotal,
    fees: j.fees,
    discount: j.discount?.amount > 0 ? j.discount : undefined,
    total: j.total,
    depositDue: j.depositDue,
    depositPercent: j.depositPercent,
    amountPaid: j.amountPaid,
    balanceDue: j.balanceDue,
    paymentStatus: j.paymentStatus,
    paymentMethod: j.paymentMethod,
    status: j.status,
    createdAt: j.createdAt,
    source: j.source,
    timeline: (j.history || []).map((h) => ({ at: h.at, text: h.text })),
  };
}

export async function checkout(req, res) {
  const s = await getSettings();
  const { order, accessToken, created } = await createOrder({
    ...req.body,
    discount: undefined,
    user: req.user,
    source: "Online",
    settings: s,
  }); // customers can't give themselves a discount
  let paymentUrl = null;
  if (
    ["card_online", "deposit_online"].includes(order.paymentMethod) &&
    order.paymentStatus === "Unpaid"
  ) {
    const amount =
      order.paymentMethod === "deposit_online" ? order.depositDue : order.total;
    const session = await createCheckoutSession(
      order,
      amount,
      s,
      env.clientUrls[0],
    );
    order.stripeSessionId = session.id;
    await order.save();
    paymentUrl = session.url;
  }
  res
    .status(created ? 201 : 200)
    .json({
      order: publicOrder(order),
      accessToken,
      paymentUrl,
      duplicate: !created,
    });
}

/** Confirmation page: owner, staff, or a guest holding the access token. */
export async function getConfirmation(req, res) {
  const order = await Order.findOne({
    orderNumber: String(req.params.orderNumber).toUpperCase(),
  }).select(`${PUBLIC_FIELDS} user +accessToken stripeSessionId`);
  if (!order) throw notFound("Order not found");
  const token = String(req.query.token || req.get("x-order-token") || "");
  const isOwner = req.user && order.user && order.user.equals(req.user._id);
  const tokenOk =
    token &&
    order.accessToken &&
    token.length === order.accessToken.length &&
    crypto.timingSafeEqual(Buffer.from(token), Buffer.from(order.accessToken));
  if (!isOwner && !tokenOk && req.user?.role !== "staff")
    throw forbidden(
      "Sign in or use the link from your confirmation to view this order.",
    );
  // Verify a returning Stripe session server-side before showing it as paid
  if (
    req.query.session_id &&
    order.stripeSessionId === req.query.session_id &&
    order.paymentStatus === "Unpaid"
  )
    await verifyStripeSession(order);
  res.json({ order: publicOrder(order) });
}

async function verifyStripeSession(order) {
  const stripe = getStripe();
  if (!stripe || !order.stripeSessionId) return;
  const session = await stripe.checkout.sessions.retrieve(
    order.stripeSessionId,
  );
  if (session.payment_status === "paid") await markStripePaid(order, session);
}

async function markStripePaid(order, session) {
  if (order.payments.some((p) => p.reference === session.payment_intent))
    return;
  applyPayment(order, {
    amount: session.amount_total / 100,
    method: order.paymentMethod,
    reference: session.payment_intent,
    provider: "stripe",
    by: "Stripe",
  });
  if (order.status === "Pending") order.status = "Confirmed";
  order.history.push({
    text: `Online payment received · $${(session.amount_total / 100).toFixed(2)} (verified with Stripe)`,
    by: "Stripe",
  });
  await order.save();
  const s = await getSettings();
  notifyNewOrder(order, s).catch(() => {});
}

export async function stripeWebhook(req, res) {
  const stripe = getStripe();
  if (!stripe || !env.stripe.webhookSecret)
    return res.status(400).send("Stripe not configured");
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.get("stripe-signature"),
      env.stripe.webhookSecret,
    );
  } catch (err) {
    logger.warn({ err: err.message }, "Stripe webhook signature failed");
    return res.status(400).send("Invalid signature");
  }
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object;
    const order = await Order.findOne({ stripeSessionId: session.id });
    if (order && session.payment_status === "paid")
      await markStripePaid(order, session);
  }
  res.json({ received: true });
}

export async function trackOrder(req, res) {
  const { orderNumber, contact } = req.body;
  const order = await Order.findOne({ orderNumber }).select(PUBLIC_FIELDS);
  // The order number plus either the email (any capitals) or the phone number (any country code) on the order
  const email = contact.toLowerCase();
  const matches =
    order &&
    ((contact.includes("@") &&
      email !== WALK_IN_EMAIL &&
      order.customer.email === email) ||
      (!contact.includes("@") && samePhone(contact, order.customer.phone)));
  // Same message either way, so nobody can find out which order numbers exist
  if (!matches)
    throw notFound(
      "We could not find an order with that number and email or phone number.",
    );
  res.json({ order: publicOrder(order) });
}

export async function myOrders(req, res) {
  const { page, limit, skip } = paginate(req.query);
  const filter = {
    $or: [{ user: req.user._id }, { "customer.email": req.user.email }],
  };
  const [items, total] = await Promise.all([
    Order.find(filter)
      .select(PUBLIC_FIELDS)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Order.countDocuments(filter),
  ]);
  res.json({
    items: items.map(publicOrder),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

export async function myOrder(req, res) {
  const order = await Order.findOne({
    orderNumber: String(req.params.orderNumber).toUpperCase(),
    $or: [{ user: req.user._id }, { "customer.email": req.user.email }],
  }).select(PUBLIC_FIELDS);
  if (!order) throw notFound("Order not found");
  res.json({ order: publicOrder(order) });
}

/** Returns cart lines for a previous order, skipping anything no longer orderable. */
export async function reorder(req, res) {
  const order = await Order.findOne({
    orderNumber: String(req.params.orderNumber).toUpperCase(),
    $or: [{ user: req.user._id }, { "customer.email": req.user.email }],
  });
  if (!order) throw notFound("Order not found");
  const products = await Product.find({
    _id: { $in: order.items.map((i) => i.product).filter(Boolean) },
  });
  const map = new Map(products.map((p) => [p._id.toString(), p]));
  const items = [];
  const skipped = [];
  for (const i of order.items) {
    const p = i.product && map.get(i.product.toString());
    if (!p || !p.orderable || !p.variants.some((v) => v.key === i.variant)) {
      skipped.push(i.name);
      continue;
    }
    items.push({
      id: crypto.randomUUID(),
      productId: p._id.toString(),
      variant: i.variant,
      qty: i.qty,
      options: { ...(i.options || {}) },
    });
  }
  res.json({ items, skipped });
}

// ── Custom cake enquiries (public) ──
// Reference photos for a custom cake, uploaded before the item goes in the cart or the POS sale
export async function uploadReferenceImages(req, res) {
  if (!req.files?.length) throw badRequest("Choose a photo to upload.");
  if (req.files.length > MAX_REFERENCE_IMAGES)
    throw badRequest(`Attach up to ${MAX_REFERENCE_IMAGES} photos.`);
  const images = [];
  for (const f of req.files) images.push(await storeImage(f, REFERENCE_FOLDER));
  res.status(201).json({ images });
}

// Shared by the website form and the "Add custom order" form in the admin panel
async function saveEnquiry(req, { staff = false } = {}) {
  const raw = { ...req.body };
  if (typeof raw.diet === "string") {
    try {
      raw.diet = JSON.parse(raw.diet);
    } catch {
      raw.diet = [raw.diet];
    }
  }
  const body = (staff ? staffEnquirySchema : enquirySchema).parse(raw);
  const s = await getSettings();
  const today = nowParts(s.timezone).date;
  const minDate = addDays(
    today,
    Math.ceil((s.prepHours["custom-cakes"] || 120) / 24),
  );
  if (body.requiredDate < minDate)
    throw badRequest(
      `Custom cakes need at least ${Math.ceil(s.prepHours["custom-cakes"] / 24)} days notice. The earliest date is ${minDate}.`,
      { fields: { requiredDate: `Earliest date is ${minDate}` } },
    );
  // Checks the bakery is open then; the slot itself is booked when staff confirm the order
  if (body.pickupTime)
    await assertPickupValid(body.requiredDate, body.pickupTime, s, 0);
  const images = [];
  for (const f of req.files || [])
    images.push(await storeImage(f, "patiala-bakers/enquiries"));
  const email = body.email || WALK_IN_EMAIL;
  // Staff orders belong to the customer's account when one exists with that email
  const owner = staff
    ? body.email
      ? await User.findOne({ email: body.email, role: "customer" }).select(
          "_id",
        )
      : null
    : req.user;
  const enq = await Enquiry.create({
    ...body,
    email,
    reference: `CE-${await nextSeq("enquiry", 2041)}`,
    user: owner?._id,
    referenceImages: images,
    history: [
      {
        text: staff
          ? `Added in the admin panel by ${req.user.name}`
          : "Enquiry received via website",
        by: staff ? req.user.name : body.name,
      },
    ],
  });
  if (email !== WALK_IN_EMAIL)
    sendMail({ to: enq.email, ...enquiryReceivedEmail(enq, s) }).catch(
      () => {},
    );
  if (!staff && s.notifications.enquiry && s.notifications.staffEmail) {
    sendMail({
      to: s.notifications.staffEmail,
      subject: `New custom cake enquiry ${enq.reference}`,
      html: `<p>${enq.name} · ${enq.occasion} · ${enq.servings} serves · needed ${enq.requiredDate}</p><p>${enq.description.replace(/</g, "&lt;")}</p>`,
    }).catch(() => {});
  }
  return enq;
}

export async function createEnquiry(req, res) {
  const enq = await saveEnquiry(req);
  res
    .status(201)
    .json({ reference: enq.reference, requiredDate: enq.requiredDate });
}

// Admin panel: a custom cake taken over the phone or at the counter
export async function createStaffEnquiry(req, res) {
  const enq = await saveEnquiry(req, { staff: true });
  res
    .status(201)
    .json({
      id: enq._id,
      reference: enq.reference,
      requiredDate: enq.requiredDate,
    });
}

// What the customer sees: whether their cake is still waiting or has been confirmed
function enquiryProgress(e) {
  const status = e.order?.status;
  if (status === "Pending")
    return { label: "Pending", detail: "Waiting for your deposit" };
  if (status === "Cancelled")
    return { label: "Cancelled", detail: "This order was cancelled" };
  if (status)
    return {
      label: status,
      detail:
        {
          Confirmed: "Your cake is confirmed",
          "In Production": "Your cake is being made",
          Ready: "Ready for pickup",
          Collected: "Collected",
        }[status] || "",
    };
  if (e.status === "Declined")
    return { label: "Declined", detail: "We can’t make this cake" };
  if (e.status === "Confirmed")
    return { label: "Confirmed", detail: "Your cake is confirmed" };
  if (e.status === "Quoted" || e.status === "Awaiting Payment")
    return { label: "Pending", detail: "Quote sent, waiting for confirmation" };
  return { label: "Pending", detail: "Waiting for the bakery to confirm" };
}
const withProgress = ({ order, ...e }) => ({
  ...e,
  progress: enquiryProgress({ ...e, order }),
});

// One of the customer's own enquiries, without the bakery's internal notes
export async function myEnquiry(req, res) {
  const e = await Enquiry.findOne({
    reference: String(req.params.reference).toUpperCase(),
    $or: [{ user: req.user._id }, { email: req.user.email }],
  })
    .select(
      "reference status name phone email occasion size servings requiredDate pickupTime diet description referenceImages budget quote finalPrice order orderNumber createdAt history",
    )
    .populate("order", "status")
    .lean();
  if (!e) throw notFound("Enquiry not found");
  const { history, quote, ...rest } = withProgress(e);
  res.json({
    enquiry: {
      ...rest,
      quote: quote?.sentAt
        ? {
            lines: quote.lines,
            total: quote.total,
            depositPercent: quote.depositPercent,
            note: quote.note,
            sentAt: quote.sentAt,
          }
        : null,
      timeline: (history || []).map((h) => ({ at: h.at, text: h.text })),
    },
  });
}

export async function myEnquiries(req, res) {
  const items = await Enquiry.find({
    $or: [{ user: req.user._id }, { email: req.user.email }],
  })
    .select(
      "reference status occasion requiredDate pickupTime servings createdAt quote finalPrice order orderNumber",
    )
    .populate("order", "status")
    .sort({ createdAt: -1 })
    .lean();
  res.json({ items: items.map(withProgress) });
}
