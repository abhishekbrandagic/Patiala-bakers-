import { CustomerProfile } from '../models/CustomerProfile.js';
import { WALK_IN_EMAIL } from '../config/constants.js';
import { samePhone } from '../utils/phone.js';

export const phoneKey = (phone) => String(phone || '').replace(/\D/g, '').slice(-9);
const realEmail = (email) => {
  const e = String(email || '').trim().toLowerCase();
  return e && e !== WALK_IN_EMAIL ? e : '';
};

// The profile for a customer: their account first, then the same email, then the same phone number
export async function findProfile({ user, email, phone }) {
  if (user) {
    const own = await CustomerProfile.findOne({ user });
    if (own) return own;
  }
  const mail = realEmail(email);
  if (mail) {
    const byMail = await CustomerProfile.findOne({ email: mail });
    if (byMail) return byMail;
  }
  const key = phoneKey(phone);
  if (key.length >= 8) {
    const candidates = await CustomerProfile.find({ phoneKey: key }).limit(10);
    return candidates.find((p) => samePhone(p.phone, phone)) || null;
  }
  return null;
}

/**
 * Saves the details. `changes` may hold name, email, phone, dob, anniversary, address and whatsappOptIn.
 * `by` is 'customer' when they edit their own profile, or the staff member's name.
 */
export async function saveProfile({ user, email, phone }, changes, by) {
  let p = await findProfile({ user, email, phone });
  if (!p) p = new CustomerProfile({ user });
  if (user && !p.user) p.user = user;
  if (changes.name) p.name = changes.name;
  const mail = realEmail(changes.email ?? email);
  if (mail) p.email = mail;
  const tel = changes.phone ?? phone;
  if (tel) { p.phone = tel; p.phoneKey = phoneKey(tel); }
  if ('dob' in changes) p.dob = changes.dob?.day ? changes.dob : undefined;
  if ('anniversary' in changes) p.anniversary = changes.anniversary?.day ? changes.anniversary : undefined;
  if ('address' in changes) p.address = changes.address || undefined;
  if (typeof changes.whatsappOptIn === 'boolean' && changes.whatsappOptIn !== Boolean(p.whatsapp?.optIn)) {
    if (changes.whatsappOptIn) p.set('whatsapp', { optIn: true, at: new Date(), by });
    else { p.set('whatsapp.optIn', false); p.set('whatsapp.optOutAt', new Date()); }
  }
  p.updatedBy = by;
  await p.save();
  return p;
}

const dateView = (d) => (d?.day ? { day: d.day, month: d.month, year: d.year || null } : null);

// What the admin panel and the customer see
export function profileView(p) {
  if (!p) return null;
  return {
    id: p._id,
    name: p.name,
    email: p.email,
    phone: p.phone,
    dob: dateView(p.dob),
    anniversary: dateView(p.anniversary),
    address: p.address?.line1 || p.address?.suburb ? p.address : null,
    whatsapp: { optIn: Boolean(p.whatsapp?.optIn), at: p.whatsapp?.at || null, by: p.whatsapp?.by || '', optOutAt: p.whatsapp?.optOutAt || null },
    updatedAt: p.updatedAt,
    updatedBy: p.updatedBy || '',
  };
}