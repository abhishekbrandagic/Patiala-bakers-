import { Field } from './ui.jsx';
import { AU_STATES, MONTHS, dobError } from '../utils/dob.js';

// Day, month and an optional year
export function DobInput({ idPrefix = 'dob', value, onChange, label = 'Date of birth', help }) {
  const error = dobError(value);
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <Field label={label} htmlFor={`${idPrefix}-d`} error={error} help={error ? '' : help}>
      <div className="flex gap-2">
        <select id={`${idPrefix}-d`} aria-label="Day" className="in !w-[84px] flex-none" value={value.day} onChange={(e) => set({ day: e.target.value })}>
          <option value="">Day</option>
          {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
        </select>
        <select aria-label="Month" className="in min-w-0 flex-1" value={value.month} onChange={(e) => set({ month: e.target.value })}>
          <option value="">Month</option>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <input aria-label="Year (optional)" className="in !w-[96px] flex-none" inputMode="numeric" maxLength={4} placeholder="Year" value={value.year} onChange={(e) => set({ year: e.target.value.replace(/\D/g, '') })} />
      </div>
    </Field>
  );
}

export function AddressInput({ idPrefix = 'addr', value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-3 [grid-template-columns:repeat(6,minmax(0,1fr))]">
      <div className="col-span-6"><Field label="Street address" htmlFor={`${idPrefix}-1`}><input id={`${idPrefix}-1`} className="in" autoComplete="street-address" maxLength={120} value={value.line1} onChange={(e) => set({ line1: e.target.value })} /></Field></div>
      <div className="col-span-6 sm:col-span-3"><Field label="Suburb / city" htmlFor={`${idPrefix}-s`}><input id={`${idPrefix}-s`} className="in" autoComplete="address-level2" maxLength={60} value={value.suburb} onChange={(e) => set({ suburb: e.target.value })} /></Field></div>
      <div className="col-span-3 sm:col-span-1"><Field label="State" htmlFor={`${idPrefix}-st`}><select id={`${idPrefix}-st`} className="in" value={value.state} onChange={(e) => set({ state: e.target.value })}><option value="">—</option>{AU_STATES.map((s) => <option key={s}>{s}</option>)}{value.state && !AU_STATES.includes(value.state) && <option>{value.state}</option>}</select></Field></div>
      <div className="col-span-3 sm:col-span-2"><Field label="Postcode" htmlFor={`${idPrefix}-p`}><input id={`${idPrefix}-p`} className="in" autoComplete="postal-code" inputMode="numeric" maxLength={10} value={value.postcode} onChange={(e) => set({ postcode: e.target.value })} /></Field></div>
    </div>
  );
}