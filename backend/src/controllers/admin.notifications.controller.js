import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { Enquiry } from "../models/Enquiry.js";
import { ContactMessage } from "../models/misc.js";
import { getSettings } from "../services/settings.service.js";
import { addDays, localStamp, nowParts } from "../utils/time.js";

const DAY = 24 * 60 * 60 * 1000;
const MINUTE = 60 * 1000;

const clock = (time = "") => {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m || 0).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`;
};

const summary = (order) => {
  const first = order.items?.[0];
  if (!first) return order.customer?.name || "";
  const more =
    order.items.length > 1 ? ` and ${order.items.length - 1} more` : "";
  return `${order.customer?.name || "Customer"}: ${first.qty} × ${first.name}${more}`;
};

/**
 * Builds the bell's list from live data, so it is always up to date and each
 * staff member only sees what their permissions allow.
 */
export async function listNotifications(req, res) {
  const settings = await getSettings();
  const now = nowParts(settings.timezone);
  const nowStamp = localStamp(now.date, now.time);
  const since = new Date(Date.now() - 7 * DAY);
  const items = [];
  const push = (n) => items.push({ ...n, at: new Date(n.at).toISOString() });

  if (req.user.can("orders")) {
    const fields =
      "orderNumber customer items pickupDate pickupTime status createdAt updatedAt history";
    const [recent, cancelled] = await Promise.all([
      Order.find({
        createdAt: { $gte: since },
        source: { $ne: "POS" },
        status: { $ne: "Cancelled" },
      })
        .select(fields)
        .sort({ createdAt: -1 })
        .limit(30)
        .lean(),
      Order.find({ status: "Cancelled", updatedAt: { $gte: since } })
        .select(fields)
        .sort({ updatedAt: -1 })
        .limit(20)
        .lean(),
    ]);

    for (const o of recent) {
      const link = `/admin/orders?open=${o._id}`;
      if (o.status === "Pending")
        push({
          id: `pay-${o._id}`,
          type: "payment",
          severity: "warn",
          title: `Order ${o.orderNumber} is waiting for payment`,
          body: summary(o),
          at: o.createdAt,
          link,
        });
      else
        push({
          id: `new-${o._id}`,
          type: "new_order",
          severity: "info",
          title: `New order ${o.orderNumber}`,
          body: summary(o),
          at: o.createdAt,
          link,
        });
    }
    for (const o of cancelled) {
      const entry = [...(o.history || [])]
        .reverse()
        .find((h) => /Cancelled/.test(h.text || ""));
      push({
        id: `cancel-${o._id}`,
        type: "cancelled",
        severity: "bad",
        title: `Order ${o.orderNumber} was cancelled`,
        body: summary(o),
        at: entry?.at || o.updatedAt,
        link: `/admin/orders?open=${o._id}`,
      });
    }
  }

  // Late alerts also go to bakers who only have access to the production board
  if (req.user.can("orders") || req.user.can("production")) {
    const alertMinutes = Math.round(
      (settings.notifications?.lateAlertHours ?? 2) * 60,
    );
    const active = await Order.find({
      status: { $in: ["Confirmed", "In Production", "Ready"] },
      source: { $ne: "POS" },
      pickupDate: {
        $gte: addDays(now.date, -3),
        $lte: addDays(now.date, Math.ceil(alertMinutes / 1440) + 1),
      },
    })
      .select("orderNumber customer items pickupDate pickupTime status")
      .sort({ pickupDate: 1, pickupTime: 1 })
      .limit(100)
      .lean();
    const thisMinute = Math.floor(Date.now() / MINUTE) * MINUTE;
    for (const o of active) {
      const minutes = localStamp(o.pickupDate, o.pickupTime) - nowStamp;
      const link = req.user.can("production")
        ? `/admin/production?date=${o.pickupDate}`
        : `/admin/orders?open=${o._id}`;
      const body = `${summary(o)}. Pickup at ${clock(o.pickupTime)}`;
      if (minutes < 0) {
        const ready = o.status === "Ready";
        push({
          id: `late-${o._id}`,
          type: "late",
          severity: "bad",
          urgent: !ready,
          title: ready
            ? `Order ${o.orderNumber} hasn't been collected`
            : `Order ${o.orderNumber} is late`,
          body,
          at: thisMinute + minutes * MINUTE,
          link,
        });
      } else if (
        minutes <= alertMinutes &&
        alertMinutes > 0 &&
        o.status !== "Ready"
      ) {
        push({
          id: `soon-${o._id}`,
          type: "due_soon",
          severity: "bad",
          urgent: true,
          title: `Order ${o.orderNumber} is getting late`,
          body,
          at: thisMinute + (minutes - alertMinutes) * MINUTE,
          link,
        });
      }
    }
  }

  if (req.user.can("enquiries")) {
    const enquiries = await Enquiry.find({
      status: "New",
      createdAt: { $gte: new Date(Date.now() - 30 * DAY) },
    })
      .select("reference name occasion createdAt")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    for (const e of enquiries)
      push({
        id: `enq-${e._id}`,
        type: "enquiry",
        severity: "info",
        title: `New cake enquiry ${e.reference}`,
        body: `${e.name}: ${e.occasion}`,
        at: e.createdAt,
        link: `/admin/enquiries?open=${e._id}`,
      });
  }

  if (req.user.can("products")) {
    const products = await Product.find({
      archived: false,
      stockStatus: { $in: ["Low stock", "Sold out"] },
    })
      .select("name stockStatus stockQty updatedAt")
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();
    for (const p of products) {
      const soldOut = p.stockStatus === "Sold out";
      push({
        id: `stock-${p._id}`,
        type: "stock",
        severity: soldOut ? "bad" : "warn",
        title: soldOut ? `${p.name} is sold out` : `${p.name} is low on stock`,
        body:
          p.stockQty != null
            ? `${p.stockQty} left`
            : "Update it in Products & Inventory",
        at: p.updatedAt,
        link: `/admin/products?edit=${p._id}`,
      });
    }
  }

  if (req.user.can("customers")) {
    const messages = await ContactMessage.find({
      handled: false,
      createdAt: { $gte: since },
    })
      .select("name message createdAt")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    for (const m of messages)
      push({
        id: `msg-${m._id}`,
        type: "message",
        severity: "info",
        title: `Website message from ${m.name}`,
        body: String(m.message || "").slice(0, 90),
        at: m.createdAt,
        link: "/admin/messages",
      });
  }

  const seen = req.user.notificationsSeenAt
    ? new Date(req.user.notificationsSeenAt).getTime()
    : 0;
  const list = items
    .filter((n) => new Date(n.at).getTime() <= Date.now() + MINUTE)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 50)
    .map((n) => ({ ...n, unread: new Date(n.at).getTime() > seen }));
  res.json({
    items: list,
    unread: list.filter((n) => n.unread).length,
    sound: settings.notifications?.sound !== false,
  });
}

export async function markNotificationsRead(req, res) {
  req.user.notificationsSeenAt = new Date();
  await req.user.save();
  res.json({ ok: true });
}
