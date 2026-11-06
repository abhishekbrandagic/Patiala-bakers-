import { format, parseISO } from 'date-fns';

// Dates and times follow the bakery's time zone from Settings, not the computer's
let bakeryTimezone;
export const setBakeryTimezone = (timeZone) => { bakeryTimezone = timeZone || undefined; };
export function bakeryDate(value = new Date()) {
  const date = new Date(value);
  if (!bakeryTimezone) return date;
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: bakeryTimezone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }).formatToParts(date).map((p) => [p.type, Number(p.value)]));
    return new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  } catch { return date; }
}

export const money = (n, currency = 'AUD') =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency, minimumFractionDigits: 2 }).format(Number(n) || 0);
export const money0 = (n) => `$${Math.round(Number(n) || 0).toLocaleString('en-AU')}`;

export const t12 = (h) => {
  if (!h) return '';
  const [a, b] = h.split(':').map(Number);
  return `${a % 12 || 12}${b ? `:${String(b).padStart(2, '0')}` : ''} ${a >= 12 ? 'pm' : 'am'}`;
};
export const fmtDate = (s, f = 'EEE d MMM') => (s ? format(parseISO(s), f) : '');
export const fmtLong = (s) => fmtDate(s, 'EEEE d MMMM yyyy');
export const fmtStamp = (d) => (d ? format(bakeryDate(d), 'dd/MM/yyyy HH:mm') : '');
export const fmtShort = (d) => (d ? format(bakeryDate(d), 'd MMM yyyy') : '');
export const todayISO = () => format(bakeryDate(), 'yyyy-MM-dd');
export const tomorrowISO = () => { const d = bakeryDate(); return format(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1), 'yyyy-MM-dd'); };


// Minutes from now until a pickup, on the bakery's clock (negative once it has passed)
export function minutesUntil(date, time) {
  const n = bakeryDate();
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time || '00:00').split(':').map(Number);
  return (Date.UTC(y, m - 1, d, hh, mm) - Date.UTC(n.getFullYear(), n.getMonth(), n.getDate(), n.getHours(), n.getMinutes())) / 60000;
}

export function relDay(s) {
  const t = todayISO();
  const tm = tomorrowISO();
  if (s === t) return 'Today';
  if (s === tm) return 'Tomorrow';
  return fmtDate(s);
}

export const sizeLabel = (k) => String(k || '').replace(/"/g, '″');

export const STATUS_CLS = {
  Pending: 'b-gold', Confirmed: 'b-info', 'In Production': 'b-warn', Ready: 'b-ok', Collected: 'b-mute', Cancelled: 'b-bad',
  Paid: 'b-ok', Unpaid: 'b-bad', 'Deposit paid': 'b-warn', Refunded: 'b-mute',
  New: 'b-info', Quoted: 'b-gold', 'Awaiting Payment': 'b-warn', Declined: 'b-mute', Converted: 'b-ok',
  High: 'b-bad', Normal: 'b-mute', Applied: 'b-ok', 'Rolled back': 'b-mute', Scheduled: 'b-info', Failed: 'b-bad',
  'In stock': 'b-ok', 'Low stock': 'b-warn', 'Sold out': 'b-bad', 'Made to order': 'b-info', Unavailable: 'b-mute',
};

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
export const cn = (...a) => a.filter(Boolean).join(' ');

export function downloadText(filename, text, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}