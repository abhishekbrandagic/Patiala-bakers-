import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { WALK_IN_EMAIL } from "../config/constants.js";
import { AppError, badRequest, r2 } from "../utils/http.js";
import { getSettings } from "../services/settings.service.js";
import { priceItems } from "../services/pricing.service.js";
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
  const items = await Product.find({
    archived: false,
    available: true,
    stockStatus: { $nin: ["Sold out", "Unavailable"] },
  })
    .select(
      "name category description images variants stockQty stockStatus customisable defaults dietary upgrades",
    )
    .sort({ category: 1, sortOrder: 1, name: 1 })
    .lean();
  res.json({ items });
}

/**
 * Records a counter sale as a real order, so it counts in Orders, Dashboard, Reports and stock.
 * It is paid straight away and goes to Production as Confirmed. It has no pickup slot, confirmation email, deposit or service fee.
 */
export async function createPosSale(req, res) {
  const { items, paymentMethod, customerName, cashTendered, idempotencyKey } =
    req.body;

  // A retry with the same key returns the original sale instead of charging twice
  const existing = await Order.findOne({ idempotencyKey });
  if (existing) return res.json({ order: existing, created: false });

  const settings = await getSettings();
  const priced = await priceItems(items, settings);
  if (priced.issues.length)
    throw new AppError(422, priced.issues[0].message, {
      issues: priced.issues,
    });

  const total = priced.subtotal;
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
        name: customerName || "Walk-in customer",
        email: WALK_IN_EMAIL,
        phone: "N/A",
      },
      items: priced.lines.map(({ id, leadHours, ...line }) => line),
      pickupDate: now.date,
      pickupTime: now.time,
      subtotal: total,
      fees: 0,
      total,
      paymentMethod,
      status: "Confirmed",
      source: "POS",
      history: [
        { text: `POS sale by ${by} · ${METHOD_LABELS[paymentMethod]}`, by },
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

  const amount =
    payment === "full"
      ? priced.total
      : payment === "deposit"
        ? depositAmount
        : 0;
  if (payment !== "none" && !paymentMethod)
    throw badRequest("Choose how the customer paid.");
  if (payment === "deposit" && (!amount || amount >= priced.total)) {
    throw badRequest(
      `Enter a deposit less than the total ($${priced.total.toFixed(2)}).`,
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
  });
  if (!created) return res.json({ order, created: false });

  if (amount > 0) {
    applyPayment(order, { amount, method: paymentMethod, by });
    order.paymentMethod = paymentMethod;
    order.history.push({
      text: `Payment recorded · $${amount.toFixed(2)} (${METHOD_LABELS[paymentMethod]})`,
      by,
    });
    await order.save();
  }
  res.status(201).json({ order, created: true });
}
