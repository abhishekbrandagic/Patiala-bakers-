export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// "21 November 1990", or "21 November" without a year
export const fmtDob = (dob) => (dob?.day ? `${dob.day} ${MONTHS[dob.month - 1]}${dob.year ? ` ${dob.year}` : ''}` : '');

export const fmtAddress = (a) => (a ? [a.line1, [a.suburb, a.state, a.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ') : '');

export const inDaysLabel = (n) => (n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `In ${n} days`);

// Form values <-> what the server stores
export const dobToForm = (dob) => ({ day: dob?.day ? String(dob.day) : '', month: dob?.month ? String(dob.month) : '', year: dob?.year ? String(dob.year) : '' });
export const dobFromForm = (f) => (f.day && f.month ? { day: Number(f.day), month: Number(f.month), year: f.year ? Number(f.year) : null } : null);
export const addressToForm = (a) => ({ line1: a?.line1 || '', suburb: a?.suburb || '', state: a?.state || '', postcode: a?.postcode || '' });
export const addressFromForm = (f) => (Object.values(f).some((v) => v.trim()) ? Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim()])) : null);

// A message when the date can't be saved, otherwise ''
export function dobError(f) {
  if (!f.day && !f.month && !f.year) return '';
  if (!f.day || !f.month) return 'Choose the day and the month.';
  const max = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][Number(f.month) - 1];
  if (Number(f.day) > max) return 'Choose a real date.';
  if (f.year) {
    const y = Number(f.year);
    if (!Number.isInteger(y) || y < 1900 || y > new Date().getFullYear()) return 'Enter a real year, like 1990.';
    if (Number(f.month) === 2 && Number(f.day) === 29 && !((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0)) return `${y} didn’t have 29 February.`;
  }
  return '';
}

export const AU_STATES = ['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT'];