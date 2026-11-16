// Phone numbers match when the digits are the same, ignoring spaces, dashes, a leading 0
// and a country code (+61, +91, …) that one side has and the other doesn't.
const digits = (value) => String(value || '').replace(/\D/g, '').replace(/^0+/, '');

export function samePhone(a, b) {
  const x = digits(a);
  const y = digits(b);
  if (x.length < 8 || y.length < 8) return false;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  // At most a 3-digit country code can differ
  return long.length - short.length <= 3 && long.endsWith(short);
}