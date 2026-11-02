import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { WALK_IN_EMAIL } from '../config/constants.js';
import { AppError, badRequest, r2 } from '../utils/http.js';
import { getSettings } from '../services/settings.service.js';
import { priceItems } from '../services/pricing.service.js';
import { applyPayment, lowStockSync, newOrderNumber } from '../services/order.service.js';
import { nowParts } from '../utils/time.js';

const METHOD_LABELS = { cash: 'cash', card_in_store: 'card', bank_transfer: 'bank transfer' };

// Everything the counter can sell right now
export async function listPosProducts(_req, res) {
  const items = await Product.find({ archived: false, available: true, stockStatus: { $nin: ['Sold out', 'Unavailable'] } })
    .select('name category images variants stockQty stockStatus customisable defaults dietary upgrades')
    .sort({ category: 1, sortOrder: 1, name: 1 })
    .lean();
  res.json({ items });
}

/**
 * Records a counter sale as a real order, so it counts in Orders, Dashboard, Reports and stock.
 * The sale is paid and handed over on the spot: no pickup slot, confirmation email, deposit or service fee.
 */
export async function createPosSale(req, res) {
  const { items, paymentMethod, customerName, cashTendered, idempotencyKey } = req.body;

  // A retry with the same key returns the original sale instead of charging twice
  const existing = await Order.findOne({ idempotencyKey });
  if (existing) return res.json({ order: existing, created: false });

  const settings = await getSettings();
  const priced = await priceItems(items, settings);
  if (priced.issues.length) throw new AppError(422, priced.issues[0].message, { issues: priced.issues });

  const total = priced.subtotal;
  if (paymentMethod === 'cash' && cashTendered != null && cashTendered < total) {
    throw badRequest(`Cash received is less than the total ($${total.toFixed(2)}).`);
  }

  // Take tracked stock atomically; give it back if anything below fails
  const decremented = [];
  try {
    for (const l of priced.lines) {
      const result = await Product.updateOne({ _id: l.product, stockQty: { $ne: null, $gte: l.qty } }, { $inc: { stockQty: -l.qty } });
      if (result.modifiedCount) decremented.push(l);
      else {
        const p = await Product.findById(l.product).select('stockQty name');
        if (p && p.stockQty != null) throw new AppError(422, `Only ${p.stockQty} × ${p.name} left in stock.`);
      }
    }

    const now = nowParts(settings.timezone);
    const by = req.user.name;
    const change = paymentMethod === 'cash' && cashTendered != null ? r2(cashTendered - total) : null;
    const order = new Order({
      orderNumber: await newOrderNumber(),
      customer: { name: customerName || 'Walk-in customer', email: WALK_IN_EMAIL, phone: 'N/A' },
      items: priced.lines.map(({ id, leadHours, ...line }) => line),
      pickupDate: now.date,
      pickupTime: now.time,
      subtotal: total,
      fees: 0,
      total,
      paymentMethod,
      status: 'Collected',
      source: 'POS',
      history: [{ text: `POS sale by ${by} · ${METHOD_LABELS[paymentMethod]}`, by }],
      idempotencyKey,
    });
    applyPayment(order, {
      amount: total,
      method: paymentMethod,
      by,
      note: change == null ? undefined : `Cash received $${cashTendered.toFixed(2)}, change $${change.toFixed(2)}`,
    });
    await order.save();
    await lowStockSync(decremented.map((l) => l.product));
    res.status(201).json({ order, created: true });
  } catch (err) {
    for (const l of decremented) await Product.updateOne({ _id: l.product }, { $inc: { stockQty: l.qty } });
    if (err.code === 11000 && err.keyPattern?.idempotencyKey) {
      const saved = await Order.findOne({ idempotencyKey });
      if (saved) return res.json({ order: saved, created: false });
    }
    throw err;
  }
}