import { User } from '../models/User.js';
import { Order } from '../models/Order.js';
import { CustomerProfile } from '../models/CustomerProfile.js';
import { WALK_IN_EMAIL } from '../config/constants.js';
import { r2 } from '../utils/http.js';
import { addDays, nowParts } from '../utils/time.js';
import { getSettings } from '../services/settings.service.js';
import { findProfile, phoneKey, profileView, saveProfile } from '../services/customerProfile.service.js';

const cleanEmail = (e) => {
  const v = String(e || '').trim().toLowerCase();
  return v && v !== WALK_IN_EMAIL ? v : '';
};
// Matches "0412 345 678", "+61412345678" and so on for the same number
const phoneRegex = (phone) => {
  const key = phoneKey(phone);
  return key.length >= 8 ? { $regex: `${key.split('').join('\\D*')}\\D*$` } : null;
};

// One customer, found from an order: their saved details, account and order history
export async function getCustomerProfile(req, res) {
  const email = cleanEmail(req.query.email);
  const phone = String(req.query.phone || '').trim();
  const user = email ? await User.findOne({ email, role: 'customer' }).select('name email phone dietaryPref createdAt') : null;
  const profile = await findProfile({ user: user?._id, email, phone });

  const or = [];
  if (email) or.push({ 'customer.email': email });
  const tel = phoneRegex(phone);
  if (tel) or.push({ 'customer.phone': tel });
  const orders = or.length
    ? await Order.find({ $or: or }).select('orderNumber status total pickupDate pickupTime createdAt items.name items.qty source customer.name').sort({ createdAt: -1 }).limit(100).lean()
    : [];
  const live = orders.filter((o) => o.status !== 'Cancelled');

  res.json({
    customer: {
      name: profile?.name || user?.name || orders[0]?.customer?.name || req.query.name || '',
      email: email || profile?.email || '',
      phone: phone || profile?.phone || user?.phone || '',
      registered: Boolean(user),
      memberSince: user?.createdAt || null,
      dietaryPref: user?.dietaryPref || '',
    },
    profile: profileView(profile),
    stats: { orders: live.length, spend: r2(live.reduce((s, o) => s + (o.total || 0), 0)), lastOrder: orders[0]?.createdAt || null },
    orders: orders.slice(0, 10),
  });
}

export async function saveCustomerProfile(req, res) {
  const { email: rawEmail, phone, ...changes } = req.body;
  const email = cleanEmail(rawEmail);
  const user = email ? await User.findOne({ email, role: 'customer' }).select('_id') : null;
  const profile = await saveProfile({ user: user?._id, email, phone }, { email, phone, ...changes }, req.user.name);
  res.json({ profile: profileView(profile) });
}

// Customers whose birthday falls in the next few days (bakery time), soonest first
export async function upcomingBirthdays(req, res) {
  const days = Math.min(31, Math.max(1, Number(req.query.days) || 7));
  const s = await getSettings();
  const today = nowParts(s.timezone).date;
  const wanted = [];
  for (let i = 0; i < days; i += 1) {
    const date = addDays(today, i);
    const [y, m, d] = date.split('-').map(Number);
    wanted.push({ date, month: m, day: d, inDays: i });
    // Birthdays on 29 February are celebrated on 28 February in other years
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    if (m === 2 && d === 28 && !leap) wanted.push({ date, month: 2, day: 29, inDays: i });
  }
  const profiles = await CustomerProfile.find({ $or: wanted.map((w) => ({ 'dob.month': w.month, 'dob.day': w.day })) }).limit(300);
  const items = profiles
    .map((p) => {
      const when = wanted.find((w) => w.month === p.dob.month && w.day === p.dob.day);
      const turning = p.dob.year ? Number(when.date.slice(0, 4)) - p.dob.year : null;
      return { ...profileView(p), date: when.date, inDays: when.inDays, turning };
    })
    .sort((a, b) => a.inDays - b.inDays || a.name.localeCompare(b.name));
  res.json({ today, days, items });
}