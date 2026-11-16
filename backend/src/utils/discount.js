import { badRequest, r2 } from './http.js';

/**
 * Works out a staff discount on a bill. `discount` is { mode: '%' | '$', value }.
 * Returns null when there is no discount, otherwise { mode, value, amount } with the amount in dollars.
 */
export function applyDiscount(base, discount) {
  const value = Number(discount?.value) || 0;
  if (!discount || value <= 0) return null;
  if (discount.mode === '%') {
    if (value > 100) throw badRequest('A discount can’t be more than 100%.', { fields: { discount: 'Max 100%' } });
    return { mode: '%', value, amount: r2((base * value) / 100) };
  }
  if (value > base + 0.005) throw badRequest(`The discount can’t be more than the total ($${base.toFixed(2)}).`, { fields: { discount: 'More than the total' } });
  return { mode: '$', value: r2(value), amount: r2(value) };
}

export const discountText = (d) => (d.mode === '%' ? `${d.value}% discount` : 'discount');