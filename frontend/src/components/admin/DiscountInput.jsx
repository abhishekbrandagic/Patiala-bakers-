import { cn, money } from '../../utils/format.js';
import { discountAmount, discountError } from '../../utils/discount.js';

const CSS = `
.dsc { display: flex; flex-direction: column; gap: 6px; }
.dsc-row { display: flex; align-items: center; gap: 8px; }
.dsc-mode { display: inline-flex; flex: none; padding: 3px; border-radius: 10px; background: #E3F0FC; }
.dsc-mode button { min-width: 34px; height: 30px; border-radius: 8px; font-size: 13.5px; font-weight: 800; color: #3D5673; }
.dsc-mode button.on { background: #fff; color: #0B6BCB; box-shadow: 0 1px 2px rgba(15,42,74,.12); }
.dsc-input { position: relative; flex: 1; min-width: 0; }
.dsc-input input { width: 100%; min-height: 38px; padding: 6px 30px 6px 10px; border: 1.5px solid #CFE2F5; border-radius: 10px; background: #fff; font-weight: 700; font-variant-numeric: tabular-nums; }
.dsc-input input:focus { outline: none; border-color: #0B6BCB; box-shadow: 0 0 0 3px rgba(11,107,203,.14); }
.dsc-input input.err { border-color: #A12428; }
.dsc-input input::-webkit-inner-spin-button, .dsc-input input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.dsc-input input[type=number] { -moz-appearance: textfield; appearance: textfield; }
.dsc-input span { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 13px; font-weight: 800; color: #5F748C; pointer-events: none; }
.dsc-off { flex: none; font-size: 13.5px; font-weight: 800; color: #2B6638; font-variant-numeric: tabular-nums; }
.dsc-err { font-size: 12.5px; font-weight: 700; color: #A12428; }
`;

// Discount as a percentage or a fixed amount. `value` is { mode: '%' | '$', value: '' }.
export default function DiscountInput({ id = 'discount', base, value, onChange, currency, label = 'Discount' }) {
  const amount = discountAmount(base, value);
  const error = discountError(base, value);
  return (
    <div className="dsc">
      <style>{CSS}</style>
      <label className="lbl !mb-0" htmlFor={id}>{label}</label>
      <div className="dsc-row">
        <div className="dsc-mode" role="group" aria-label="Discount type">
          {['%', '$'].map((m) => (
            <button key={m} type="button" className={cn(value.mode === m && 'on')} aria-pressed={value.mode === m} onClick={() => onChange({ ...value, mode: m })}>{m}</button>
          ))}
        </div>
        <div className="dsc-input">
          <input id={id} type="number" inputMode="decimal" min="0" step={value.mode === '%' ? '1' : '0.5'} max={value.mode === '%' ? 100 : undefined} placeholder="0" className={cn(error && 'err')} value={value.value} onChange={(e) => onChange({ ...value, value: e.target.value })} aria-invalid={Boolean(error)} />
          <span aria-hidden="true">{value.mode}</span>
        </div>
        {amount > 0 && <span className="dsc-off">−{money(amount, currency)}</span>}
      </div>
      {error && <span className="dsc-err" role="alert">{error}</span>}
    </div>
  );
}