// Same rules as the server: a percentage of the bill, or a fixed dollar amount up to the bill
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export function discountAmount(base, discount) {
  const value = Number(discount?.value) || 0;
  if (!discount || value <= 0 || base <= 0) return 0;
  if (discount.mode === '%') return value > 100 ? 0 : r2((base * value) / 100);
  return value > base + 0.005 ? 0 : r2(value);
}

// A message when the discount can't be used, otherwise ''
export function discountError(base, discount) {
  const value = Number(discount?.value) || 0;
  if (!discount || discount.value === '' || value === 0) return '';
  if (value < 0) return 'Enter a discount above 0.';
  if (discount.mode === '%' && value > 100) return 'A discount can’t be more than 100%.';
  if (discount.mode === '$' && value > base + 0.005) return 'The discount can’t be more than the total.';
  return '';
}

// What to send to the server, or nothing when there is no discount
export const discountPayload = (base, discount) => (discountAmount(base, discount) > 0 ? { discount: { mode: discount.mode, value: Number(discount.value) } } : {});