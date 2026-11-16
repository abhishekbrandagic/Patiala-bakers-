import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { addDays, format } from 'date-fns';
import toast from 'react-hot-toast';
import { ImagePlus, X } from 'lucide-react';
import { api, apiError } from '../api/client.js';
import { Field, Spinner } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { cn, fmtLong, t12 } from '../utils/format.js';

const OCCASIONS = ['Birthday', 'Wedding', 'Engagement', 'Anniversary', 'Baby shower', 'Corporate', 'Diwali / festive', 'Other'];
const SIZES = ['5"', '7"', '9"', '2-tier', '3-tier', 'Not sure'];
const DIETS = ['Eggless', 'Vegan', 'Gluten-free', 'Nut-free'];

// The custom cake enquiry form. The website uses it as is; the admin panel passes `staff`
// to take an order for a customer over the phone or at the counter.
export default function CustomCakeForm({ staff = false, onDone, onCancel }) {
  const { settings } = useSettings();
  const { user } = useAuth();
  const days = Math.ceil((settings?.prepHours?.['custom-cakes'] ?? 120) / 24);
  const minDate = format(addDays(new Date(), days), 'yyyy-MM-dd');
  const schema = z.object({
    occasion: z.string().min(2, 'Choose an occasion'),
    size: z.string().optional(),
    servings: z.coerce.number({ invalid_type_error: 'Enter servings' }).int().min(1, 'Enter servings').max(500),
    requiredDate: z.string().min(1, 'Choose a date').refine((d) => d >= minDate, `Custom cakes need ${days} days notice — earliest ${minDate}`),
    pickupTime: z.string().min(1, 'Choose a pickup time'),
    description: z.string().trim().min(15, 'Tell us a little more (15+ characters)').max(4000),
    budget: z.string().max(60).optional(),
    name: z.string().trim().min(2, staff ? 'Enter the customer’s name' : 'Enter your name'),
    email: staff ? z.string().trim().email('Enter a valid email').or(z.literal('')) : z.string().trim().email('Enter a valid email'),
    phone: z.string().trim().min(6, 'Enter a valid phone number'),
  });
  const { register, handleSubmit, watch, setValue, reset, setError, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema), defaultValues: { occasion: 'Birthday', size: '7"', servings: 15, requiredDate: '', pickupTime: '', description: '', budget: '', name: '', email: '', phone: '' } });
  const [diet, setDiet] = useState(['Eggless']);
  const [files, setFiles] = useState([]);
  const [err, setErr] = useState('');
  const [slots, setSlots] = useState(null);
  const requiredDate = watch('requiredDate');

  // Pickup times the bakery is open on the chosen day
  useEffect(() => {
    setValue('pickupTime', '');
    if (!requiredDate) { setSlots(null); return undefined; }
    let current = true;
    setSlots('loading');
    api.get('/availability', { params: { date: requiredDate } })
      .then(({ data }) => current && setSlots(data.slots || []))
      .catch(() => current && setSlots([]));
    return () => { current = false; };
  }, [requiredDate, setValue]);
  const openSlots = Array.isArray(slots) ? slots.filter((s) => s.available) : [];
  useEffect(() => { if (user && !staff) { setValue('name', user.name); setValue('email', user.email); setValue('phone', user.phone || ''); } }, [user, staff, setValue]);
  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.preview)), [files]);

  const addFiles = (list) => {
    const next = [...files];
    for (const f of list) {
      if (next.length >= 3) { toast.error('You can attach up to 3 images.'); break; }
      if (!/^image\/(jpeg|png|webp|gif)$/.test(f.type)) { toast.error(`${f.name} is not a supported image.`); continue; }
      if (f.size > 5 * 1024 * 1024) { toast.error(`${f.name} is larger than 5 MB.`); continue; }
      next.push({ file: f, preview: URL.createObjectURL(f) });
    }
    setFiles(next);
  };

  const onSubmit = handleSubmit(async (v) => {
    setErr('');
    const fd = new FormData();
    Object.entries(v).forEach(([k, val]) => fd.append(k, val ?? ''));
    fd.append('diet', JSON.stringify(diet));
    files.forEach((f) => fd.append('images', f.file));
    try {
      const { data } = await api.post(staff ? '/admin/enquiries' : '/enquiries', fd);
      reset(); setFiles([]); setDiet(['Eggless']);
      onDone?.(data);
    } catch (e) {
      const ae = apiError(e);
      setErr(ae.message);
      Object.entries(ae.fields).forEach(([k, m]) => setError(k, { message: m }));
    }
  });

  const occasion = watch('occasion');
  const size = watch('size');

  return (
    <form className={cn('flex flex-col gap-6', !staff && 'card card-b')} onSubmit={onSubmit} noValidate>
      {err && <p className="errbox" role="alert">{err}</p>}
      <fieldset>
        <legend className="lbl">Occasion</legend>
        <div className="flex flex-wrap gap-2">{OCCASIONS.map((o) => <button type="button" key={o} className={cn('opt', occasion === o && 'on')} aria-pressed={occasion === o} onClick={() => setValue('occasion', o)}>{o}</button>)}</div>
      </fieldset>
      <fieldset>
        <legend className="lbl">Size</legend>
        <div className="flex flex-wrap gap-2">{SIZES.map((o) => <button type="button" key={o} className={cn('opt', size === o && 'on')} aria-pressed={size === o} onClick={() => setValue('size', o)}>{o.replace(/"/g, '″')}</button>)}</div>
      </fieldset>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
        <Field label="Servings" htmlFor="sv" error={errors.servings?.message}><input id="sv" type="number" min="1" className={cn('in', errors.servings && 'err')} {...register('servings')} /></Field>
        <Field label="Date needed" htmlFor="dt" error={errors.requiredDate?.message} help={`Earliest ${fmtLong(minDate)}`}><input id="dt" type="date" min={minDate} className={cn('in', errors.requiredDate && 'err')} {...register('requiredDate')} /></Field>
        <Field label="Pickup time" htmlFor="pt" error={errors.pickupTime?.message} help={!requiredDate ? 'Choose the date first' : ''}>
          <select id="pt" className={cn('in', errors.pickupTime && 'err')} disabled={!requiredDate || slots === 'loading'} {...register('pickupTime')}>
            <option value="">{!requiredDate ? 'Choose the date first' : slots === 'loading' ? 'Loading…' : openSlots.length ? 'Choose…' : 'Closed this day'}</option>
            {openSlots.map((s) => <option key={s.time} value={s.time}>{t12(s.time)}</option>)}
          </select>
        </Field>
        <Field label="Budget (optional)" htmlFor="bd"><input id="bd" className="in" placeholder="e.g. $150–$200" {...register('budget')} /></Field>
      </div>
      <fieldset>
        <legend className="lbl">Dietary requirements</legend>
        <div className="flex flex-wrap gap-2">{DIETS.map((d) => <label key={d} className="dbox !min-h-[44px]"><input type="checkbox" checked={diet.includes(d)} onChange={(e) => setDiet(e.target.checked ? [...diet, d] : diet.filter((x) => x !== d))} /><span className="text-sm font-bold">{d}</span></label>)}</div>
      </fieldset>
      <Field label="Describe your cake" htmlFor="ds" error={errors.description?.message} help="Colours, theme, flavours, message, toppers — the more detail the better."><textarea id="ds" className={cn('in !min-h-[140px]', errors.description && 'err')} {...register('description')} /></Field>
      <div>
        <span className="lbl">Reference images (optional, up to 3)</span>
        <div className="upl">
          <ImagePlus className="text-gold-d" size={28} aria-hidden="true" />
          <b>Drop images here or click to upload</b><span className="text-xs muted">JPG, PNG or WebP · max 5 MB each</span>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple aria-label="Upload reference images" onChange={(e) => { addFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />
        </div>
        {files.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2.5">
            {files.map((f, i) => (
              <div key={f.preview} className="relative h-24 w-24 overflow-hidden rounded-xl border border-line">
                <img src={f.preview} alt={`Reference ${i + 1}`} className="h-full w-full object-cover" />
                <button type="button" className="absolute right-1 top-1 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-white/95 shadow-1" onClick={() => setFiles(files.filter((x) => x !== f))} aria-label={`Remove image ${i + 1}`}><X size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="grid gap-4 border-t border-line-2 pt-6 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
        <Field label={staff ? 'Customer name' : 'Your name'} htmlFor="nm" error={errors.name?.message}><input id="nm" className={cn('in', errors.name && 'err')} autoComplete="name" {...register('name')} /></Field>
        <Field label={staff ? 'Email (optional)' : 'Email'} htmlFor="em" error={errors.email?.message} help={staff ? 'Leave empty if they don’t have one' : ''}><input id="em" type="email" className={cn('in', errors.email && 'err')} autoComplete="email" {...register('email')} /></Field>
        <Field label="Phone" htmlFor="ph" error={errors.phone?.message}><input id="ph" className={cn('in', errors.phone && 'err')} autoComplete="tel" {...register('phone')} /></Field>
      </div>
      <div className="flex justify-end gap-2.5">{onCancel && <button type="button" className="btn btn-o btn-lg" onClick={onCancel}>Cancel</button>}<button className="btn btn-p btn-lg" disabled={isSubmitting}>{isSubmitting && <Spinner />} {staff ? 'Add custom order' : 'Send enquiry'}</button></div>
    </form>
  );
}