import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { User } from "../models/User.js";
import { WALK_IN_EMAIL } from "../config/constants.js";
import { AppError, badRequest, escapeRegex, r2 } from "../utils/http.js";
import { applyDiscount, discountText } from "../utils/discount.js";
import { getSettings } from "../services/settings.service.js";
import {
  leadHoursFor,
  needsMaking,
  priceItems,
} from "../services/pricing.service.js";
import { assertPickupValid } from "../services/slots.service.js";
import {
  applyPayment,
  createOrder,
  lowStockSync,
  newOrderNumber,
} from "../services/order.service.js";
import { nowParts } from "../utils/time.js";

const METHOD_LABELS = {
  cash: "cash",
  card_in_store: "card",
  bank_transfer: "bank transfer",
};

// Everything the counter can sell right now
export async function listPosProducts(_req, res) {
  const [products, settings] = await Promise.all([
    Product.find({
      archived: false,
      available: true,
      stockStatus: { $nin: ["Sold out", "Unavailable"] },
    })
      .select(
        "name category description images variants stockQty stockStatus customisable defaults dietary upgrades prepHours",
      )
      .sort({ category: 1, sortOrder: 1, name: 1 })
      .lean(),
    getSettings(),
  ]);
  // Tells the counter which items must be ordered ahead, and how much notice they need
  const items = products.map((p) => ({
    ...p,
    needsMaking: needsMaking(p),
    leadHours: leadHoursFor(p, settings),
  }));
  res.json({ items });
}

// Australian numbers saved with +61 are shown in the 10-digit form the POS uses
function localPhone(phone = "") {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("61"))
    return `0${digits.slice(2)}`;
  return digits.length === 10 ? digits : phone;
}

// Past customers matching a name or phone number, most recent first
export async function searchPosCustomers(req, res) {
  const q = String(req.query.q || "")
    .trim()
    .slice(0, 60);
  if (q.length < 2) return res.json({ items: [] });

  const name = { $regex: escapeRegex(q), $options: "i" };
  const digits = q.replace(/\D/g, "").slice(0, 15);
  const number =
    digits.length > 2 && digits.startsWith("0") ? digits.slice(1) : digits;
  const phone =
    number.length >= 2 && digits.length === q.replace(/[\s()+-]/g, "").length
      ? { $regex: number.split("").join("\\D*") }
      : null;

  const [orders, users] = await Promise.all([
    Order.find({
      status: { $ne: "Cancelled" },
      "customer.phone": { $ne: "N/A" },
      $or: [
        { "customer.name": name },
        ...(phone ? [{ "customer.phone": phone }] : []),
      ],
    })
      .select("customer createdAt")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean(),
    User.find({
      role: "customer",
      $or: [{ name }, ...(phone ? [{ phone }] : [])],
    })
      .select("name email phone")
      .limit(20)
      .lean(),
  ]);

  const found = [];
  const add = (
    { name: customerName, email, phone: customerPhone },
    orderCount,
  ) => {
    const shownPhone = localPhone(customerPhone);
    const shownEmail = email === WALK_IN_EMAIL ? "" : email || "";
    const same = found.find(
      (c) =>
        (shownPhone && c.phone === shownPhone) ||
        (shownEmail && c.email === shownEmail),
    );
    if (same) {
      same.orders += orderCount;
      same.phone ||= shownPhone;
      same.email ||= shownEmail;
    } else
      found.push({
        name: customerName,
        phone: shownPhone,
        email: shownEmail,
        orders: orderCount,
      });
  };
  for (const o of orders) add(o.customer, 1);
  for (const u of users) add(u, 0);
  res.json({ items: found.slice(0, 8) });
}

/**
 * Records a counter sale as a real order, so it counts in Orders, Dashboard, Reports and stock.
 * It is paid straight away and goes to Production as Confirmed. It has no pickup slot, confirmation email, deposit or service fee.
 */
export async function createPosSale(req, res) {
  const {
    items,
    paymentMethod,
    customer,
    notes,
    cashTendered,
    idempotencyKey,
    discount,
  } = req.body;

  // A retry with the same key returns the original sale instead of charging twice
  const existing = await Order.findOne({ idempotencyKey });
  if (existing) return res.json({ order: existing, created: false });

  const settings = await getSettings();
  const priced = await priceItems(items, settings);
  if (priced.issues.length)
    throw new AppError(422, priced.issues[0].message, {
      issues: priced.issues,
    });

  if (priced.toMake.length) {
    throw badRequest(
      `${priced.toMake.join(", ")} has to be made to order. Choose Take Away and a pickup date.`,
    );
  }

  const disc = applyDiscount(priced.subtotal, discount);
  const total = r2(priced.subtotal - (disc?.amount || 0));
  if (
    paymentMethod === "cash" &&
    cashTendered != null &&
    cashTendered < total
  ) {
    throw badRequest(
      `Cash received is less than the total ($${total.toFixed(2)}).`,
    );
  }

  // Take tracked stock atomically; give it back if anything below fails
  const decremented = [];
  try {
    for (const l of priced.lines) {
      const result = await Product.updateOne(
        { _id: l.product, stockQty: { $ne: null, $gte: l.qty } },
        { $inc: { stockQty: -l.qty } },
      );
      if (result.modifiedCount) decremented.push(l);
      else {
        const p = await Product.findById(l.product).select("stockQty name");
        if (p && p.stockQty != null)
          throw new AppError(
            422,
            `Only ${p.stockQty} × ${p.name} left in stock.`,
          );
      }
    }

    const now = nowParts(settings.timezone);
    const by = req.user.name;
    const change =
      paymentMethod === "cash" && cashTendered != null
        ? r2(cashTendered - total)
        : null;
    const order = new Order({
      orderNumber: await newOrderNumber(),
      customer: {
        name: customer.name,
        email: customer.email || WALK_IN_EMAIL,
        phone: customer.phone,
      },
      notes,
      items: priced.lines.map(({ id, leadHours, ...line }) => line),
      pickupDate: now.date,
      pickupTime: now.time,
      subtotal: priced.subtotal,
      fees: 0,
      ...(disc ? { discount: disc } : {}),
      total,
      paymentMethod,
      status: "Confirmed",
      source: "POS",
      fromPos: true,
      history: [
        {
          text: `POS sale by ${by} · ${METHOD_LABELS[paymentMethod]}${disc ? ` · ${discountText(disc)} −$${disc.amount.toFixed(2)}` : ""}`,
          by,
        },
      ],
      idempotencyKey,
    });
    applyPayment(order, {
      amount: total,
      method: paymentMethod,
      by,
      note:
        change == null
          ? undefined
          : `Cash received $${cashTendered.toFixed(2)}, change $${change.toFixed(2)}`,
    });
    await order.save();
    await lowStockSync(decremented.map((l) => l.product));
    res.status(201).json({ order, created: true });
  } catch (err) {
    for (const l of decremented)
      await Product.updateOne(
        { _id: l.product },
        { $inc: { stockQty: l.qty } },
      );
    if (err.code === 11000 && err.keyPattern?.idempotencyKey) {
      const saved = await Order.findOne({ idempotencyKey });
      if (saved) return res.json({ order: saved, created: false });
    }
    throw err;
  }
}

/**
 * "Send to production": an order the bakery still has to make. It uses the normal order flow,
 * so it appears in Production and the Pickup Calendar, and takes a pickup slot and stock.
 */
export async function createPosOrder(req, res) {
  const {
    items,
    customer,
    pickupDate,
    pickupTime,
    notes,
    source,
    payment,
    paymentMethod,
    depositAmount,
    idempotencyKey,
    discount,
  } = req.body;

  // Checked first: a retry must return the original order, even if stock has since run out
  const existing = await Order.findOne({ idempotencyKey });
  if (existing) return res.json({ order: existing, created: false });

  const settings = await getSettings();
  const priced = await priceItems(items, settings);
  if (priced.issues.length)
    throw new AppError(422, priced.issues[0].message, {
      issues: priced.issues,
    });

  // Cakes that still have to be made need their notice period, even when ordered at the counter
  if (priced.makeLeadHours)
    await assertPickupValid(
      pickupDate,
      pickupTime,
      settings,
      priced.makeLeadHours,
    );

  const disc = applyDiscount(priced.total, discount);
  const total = r2(priced.total - (disc?.amount || 0));
  const amount =
    payment === "full" ? total : payment === "deposit" ? depositAmount : 0;
  if (payment !== "none" && !paymentMethod)
    throw badRequest("Choose how the customer paid.");
  if (payment === "deposit" && (!amount || amount >= total)) {
    throw badRequest(
      `Enter a deposit less than the total ($${total.toFixed(2)}).`,
    );
  }

  const by = req.user.name;
  const { order, created } = await createOrder({
    items,
    customer: { ...customer, email: customer.email || WALK_IN_EMAIL },
    pickupDate,
    pickupTime,
    notes,
    paymentMethod: "pay_at_pickup",
    idempotencyKey,
    source,
    settings,
    by,
    discount,
  });
  if (!created) return res.json({ order, created: false });

  order.fromPos = true;
  if (amount > 0) {
    applyPayment(order, { amount, method: paymentMethod, by });
    order.paymentMethod = paymentMethod;
    order.history.push({
      text: `Payment recorded · $${amount.toFixed(2)} (${METHOD_LABELS[paymentMethod]})`,
      by,
    });
  }
  await order.save();
  res.status(201).json({ order, created: true });
}
