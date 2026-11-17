import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { ArrowLeft, CalendarClock, Cake, ChevronRight, Heart, Package, ShoppingBag, LogOut, Mail, MapPin, MessageCircle, Pencil, Phone, RotateCcw, Utensils, X } from 'lucide-react';
import { api, apiError } from '../../api/client.js';
import OrderView from '../../components/OrderView.jsx';
import { ReferenceImageList } from '../../components/ReferenceImages.jsx';
import { Badge, EmptyState, ErrorState, Field, PageLoader, Pagination, Spinner } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCart } from '../../context/CartContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { fmtDate, fmtLong, fmtShort, fmtStamp, money, t12 } from '../../utils/format.js';
import { AddressInput, DobInput } from '../../components/ProfileFields.jsx';
import { addressFromForm, addressToForm, dobError, dobFromForm, dobToForm, fmtAddress, fmtDob } from '../../utils/dob.js';

function useReorder() {
  const { items, replace, setOpen } = useCart();
  return async (orderNumber) => {
    try {
      const { data } = await api.post(`/account/orders/${orderNumber}/reorder`);
      if (!data.items.length) { toast.error('None of the items in that order are available right now.'); return; }
      replace([...items, ...data.items]);
      toast.success(`Added ${data.items.length} item${data.items.length === 1 ? '' : 's'} to your cart${data.skipped.length ? ` · ${data.skipped.length} unavailable` : ''}`);
      setOpen(true);
    } catch (e) { toast.error(apiError(e).message); }
  };
}

function Orders() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const reorder = useReorder();
  useEffect(() => { setData(null); api.get('/account/orders', { params: { page, limit: 10 } }).then(({ data: d }) => setData(d)).catch((e) => setError(apiError(e).message)); }, [page]);
  if (error) return <ErrorState message={error} />;
  if (!data) return <PageLoader />;
  if (!data.items.length) return <EmptyState title="No orders yet" action={<Link to="/shop" className="btn btn-p">Start an order</Link>}>Your orders will appear here.</EmptyState>;
  return (
    <>
      <style>{OC_CSS}</style>
      <div className="oc-list">
        {data.items.map((o, i) => <OrderCard key={o.orderNumber} o={o} i={i} onReorder={() => reorder(o.orderNumber)} />)}
      </div>
      <Pagination page={data.page} pages={data.pages} onPage={setPage} />
    </>
  );
}

// Colour and progress step for each order status
const STATUS = {
  Pending: { c: '#6B6B6B', bg: '#F0F0F0', step: 0 },
  Confirmed: { c: '#2F6FED', bg: '#E6EEFE', step: 1 },
  'In Production': { c: '#D97706', bg: '#FFF1D6', step: 2 },
  Ready: { c: '#1FA855', bg: '#DFF6E7', step: 3 },
  Collected: { c: '#111111', bg: '#ECECEC', step: 4 },
  Cancelled: { c: '#E5484D', bg: '#FDE8E8', step: -1 },
};
const STEPS = ['Placed', 'Confirmed', 'Baking', 'Ready', 'Collected'];

const OC_CSS = `
.oc-list { display: flex; flex-direction: column; gap: 14px; }
.oc { --c: #111; --bg: #F0F0F0; position: relative; display: grid; grid-template-columns: auto minmax(0, 1.5fr) minmax(0, 1fr) auto; gap: 18px 24px; align-items: center; padding: 18px 20px; border-radius: 20px; background: #fff; border: 1px solid #ECECEC;
  box-shadow: 0 1px 2px rgba(0,0,0,.03); transition: transform .25s, box-shadow .25s, border-color .25s; animation: oc-in .5s cubic-bezier(.2,.7,.2,1) both; }
.oc:hover { transform: translateY(-2px); border-color: transparent; box-shadow: 0 14px 30px -18px rgba(0,0,0,.35); }
.oc::before { content: ''; position: absolute; left: 0; top: 18px; bottom: 18px; width: 4px; border-radius: 0 4px 4px 0; background: var(--c); }
@keyframes oc-in { from { opacity: 0; transform: translateY(10px); } }
.oc-pics { position: relative; display: flex; width: 94px; }
.oc-pic { width: 60px; height: 60px; border-radius: 16px; background: var(--bg) center / cover no-repeat; color: var(--c); display: flex; align-items: center; justify-content: center; border: 3px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,.08); }
.oc-pic + .oc-pic { margin-left: -26px; }
.oc-more { position: absolute; right: -6px; bottom: -6px; min-width: 24px; height: 24px; padding: 0 6px; border-radius: 999px; background: #111; color: #fff; font-size: 11.5px; font-weight: 800; display: flex; align-items: center; justify-content: center; border: 2px solid #fff; }
.oc-main { min-width: 0; }
.oc-num { font-size: 16px; font-weight: 800; color: #111; text-decoration: none; }
/* the whole card opens the order; buttons sit above this link */
.oc-num::after { content: ''; position: absolute; inset: 0; border-radius: 20px; }
.oc-placed { margin-left: 8px; font-size: 12.5px; color: #8A8A8A; }
.oc-items { margin-top: 4px; font-size: 14px; color: #444; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oc-when { display: flex; align-items: center; gap: 10px; }
.oc-when i { width: 38px; height: 38px; flex: none; border-radius: 12px; background: #F4F4F4; color: #111; display: flex; align-items: center; justify-content: center; }
.oc-when small { display: block; font-size: 11.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #8A8A8A; }
.oc-when b { display: block; font-size: 14px; font-weight: 700; color: #111; }
.oc-side { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
.oc-total { font-size: 20px; font-weight: 800; color: #111; letter-spacing: -.01em; }
.oc-status { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 999px; background: var(--bg); color: var(--c); font-size: 12.5px; font-weight: 800; white-space: nowrap; }
.oc-status::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.oc.live .oc-status::before { animation: oc-pulse 1.6s ease-in-out infinite; }
@keyframes oc-pulse { 50% { box-shadow: 0 0 0 5px transparent; opacity: .4; } }
.oc-foot { grid-column: 2 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 12px 20px; padding-top: 14px; border-top: 1px dashed #E6E6E6; }
.oc-prog { flex: 1; min-width: 220px; display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
.oc-prog span { display: block; }
.oc-prog i { display: block; height: 5px; border-radius: 5px; background: #EDEDED; }
.oc-prog .done i { background: var(--c); }
.oc-prog em { display: block; margin-top: 5px; font-size: 11px; font-style: normal; font-weight: 700; color: #A3A3A3; }
.oc-prog .done em { color: #333; }
.oc-cancel { flex: 1; font-size: 13px; font-weight: 600; color: #E5484D; }
.oc-acts { position: relative; z-index: 1; display: flex; gap: 8px; }
.oc-btn { display: inline-flex; align-items: center; gap: 6px; min-height: 38px; padding: 0 14px; border-radius: 999px; font-size: 13.5px; font-weight: 800; border: 1.5px solid #E2E2E2; background: #fff; color: #111; text-decoration: none; transition: background .2s, color .2s, border-color .2s; }
.oc-btn:hover { border-color: #111; color: #111; }
.oc-btn.dark { background: #111; border-color: #111; color: #fff; }
.oc-btn.dark:hover { background: #333; color: #fff; }
.oc-btn.dark svg { transition: transform .4s; }
.oc-btn.dark:hover svg { transform: rotate(-200deg); }
@media (max-width: 860px) {
  .oc { grid-template-columns: auto minmax(0, 1fr) auto; padding: 16px; gap: 14px; }
  .oc-when { grid-column: 1 / -1; grid-row: 2; }
  .oc-foot { grid-column: 1 / -1; }
  .oc-pics { width: 74px; }
  .oc-pic { width: 50px; height: 50px; border-radius: 14px; }
  .oc-placed { display: block; margin: 2px 0 0; }
  .oc-acts { width: 100%; }
  .oc-acts > * { flex: 1; justify-content: center; }
}
@media (prefers-reduced-motion: reduce) { .oc, .oc-btn svg, .oc.live .oc-status::before { animation: none; transition: none; } }
`;

function OrderCard({ o, i, onReorder }) {
  const st = STATUS[o.status] || STATUS.Pending;
  const pics = o.items.slice(0, 2);
  const count = o.items.reduce((n, it) => n + (it.qty || 1), 0);
  const live = ['Confirmed', 'In Production', 'Ready'].includes(o.status);
  return (
    <article className={`oc${live ? ' live' : ''}`} style={{ '--c': st.c, '--bg': st.bg, animationDelay: `${Math.min(i, 8) * 50}ms` }}>
      <div className="oc-pics" aria-hidden="true">
        {pics.map((it, k) => <span key={k} className="oc-pic" style={it.image ? { backgroundImage: `url("${it.image}")` } : undefined}>{!it.image && (k ? <Package size={22} /> : <ShoppingBag size={22} />)}</span>)}
        {o.items.length > 2 && <span className="oc-more">+{o.items.length - 2}</span>}
      </div>
      <div className="oc-main">
        <Link to={`/account/orders/${o.orderNumber}`} className="oc-num">{o.orderNumber}</Link>
        <span className="oc-placed">Placed {fmtShort(o.createdAt)} · {count} item{count === 1 ? '' : 's'}</span>
        <div className="oc-items" title={o.items.map((it) => `${it.qty}× ${it.name}`).join(', ')}>{o.items.map((it) => `${it.qty}× ${it.name}`).join(', ')}</div>
      </div>
      <div className="oc-when">
        <i><CalendarClock size={18} aria-hidden="true" /></i>
        <div><small>Pickup</small><b>{fmtDate(o.pickupDate)} · {t12(o.pickupTime)}</b></div>
      </div>
      <div className="oc-side">
        <span className="oc-total num">{money(o.total)}</span>
        <span className="oc-status">{o.status}</span>
      </div>
      <div className="oc-foot">
        {st.step < 0
          ? <p className="oc-cancel">This order was cancelled.</p>
          : <div className="oc-prog" aria-label={`Progress: ${o.status}`}>{STEPS.map((label, k) => <span key={label} className={k <= st.step ? 'done' : ''}><i /><em>{label}</em></span>)}</div>}
        <div className="oc-acts">
          <Link to={`/account/orders/${o.orderNumber}`} className="oc-btn">Details <ChevronRight size={15} aria-hidden="true" /></Link>
          <button type="button" className="oc-btn dark" onClick={onReorder}><RotateCcw size={14} aria-hidden="true" /> Reorder</button>
        </div>
      </div>
    </article>
  );
}

function OrderDetail() {
  const { orderNumber } = useParams();
  const { settings } = useSettings();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const reorder = useReorder();
  useEffect(() => { api.get(`/account/orders/${orderNumber}`).then(({ data }) => setOrder(data.order)).catch((e) => setError(apiError(e).message)); }, [orderNumber]);
  if (error) return <ErrorState message={error} />;
  if (!order) return <PageLoader />;
  return (
    <div className="card card-b">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link to="/account" className="btn btn-ghost btn-sm"><ArrowLeft size={15} /> All orders</Link>
        <h2 className="flex-1 font-sans text-xl font-extrabold">{order.orderNumber}</h2>
        <button className="btn btn-o btn-sm" onClick={() => reorder(order.orderNumber)}><RotateCcw size={14} /> Order again</button>
      </div>
      <OrderView order={order} address={settings?.business?.address} />
    </div>
  );
}

function Enquiries() {
  const [items, setItems] = useState(null);
  useEffect(() => { api.get('/account/enquiries').then(({ data }) => setItems(data.items)).catch(() => setItems([])); }, []);
  if (!items) return <PageLoader />;
  if (!items.length) return <EmptyState title="No custom cake enquiries" action={<Link to="/custom-cakes" className="btn btn-p">Start an enquiry</Link>} />;
  return (
    <div className="tblwrap"><table className="tbl"><thead><tr><th>Reference</th><th>Occasion</th><th>Date needed</th><th>Quote</th><th>Status</th></tr></thead>
      <tbody>{items.map((e) => <tr key={e.reference}><td><Link to={`/account/enquiries/${e.reference}`} className="font-extrabold">{e.reference}</Link></td><td>{e.occasion} · {e.servings} serves</td><td>{fmtDate(e.requiredDate)}</td><td>{e.finalPrice ? money(e.finalPrice) : e.quote?.sentAt && e.quote?.total ? money(e.quote.total) : '—'}</td><td><Badge>{e.progress?.label || e.status}</Badge>{e.orderNumber && <Link className="ml-2 text-sm" to={`/account/orders/${e.orderNumber}`}>{e.orderNumber}</Link>}{e.progress?.detail && <div className="mt-1 text-xs muted">{e.progress.detail}</div>}</td></tr>)}</tbody>
    </table></div>
  );
}

// What the customer asked for, the photos they sent, and the bakery's quote
function EnquiryDetail() {
  const { reference } = useParams();
  const [e, setE] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { api.get(`/account/enquiries/${reference}`).then(({ data }) => setE(data.enquiry)).catch((err) => setError(apiError(err).message)); }, [reference]);
  if (error) return <ErrorState message={error} />;
  if (!e) return <PageLoader />;
  const rows = [
    ['Occasion', e.occasion],
    ['Size', e.size],
    ['Servings', e.servings ? `${e.servings} serves` : ''],
    ['Pickup', `${fmtLong(e.requiredDate)}${e.pickupTime ? ` at ${t12(e.pickupTime)}` : ''}`],
    ['Agreed price', e.finalPrice ? money(e.finalPrice) : ''],
    ['Dietary', e.diet?.join(', ')],
    ['Budget', e.budget],
    ['Contact', [e.name, e.phone, e.email].filter(Boolean).join(' · ')],
  ].filter(([, v]) => v);
  const deposit = e.quote?.total && e.quote.depositPercent ? (e.quote.total * e.quote.depositPercent) / 100 : 0;
  return (
    <div className="card card-b flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/account/enquiries" className="btn btn-ghost btn-sm"><ArrowLeft size={15} /> All enquiries</Link>
        <h2 className="flex-1 font-sans text-xl font-extrabold">{e.reference}</h2>
        <Badge>{e.progress?.label || e.status}</Badge>
      </div>
      {e.progress?.detail && <p className="-mt-2 text-sm muted">{e.progress.detail}</p>}
      {e.orderNumber && <p className="goldbox">This enquiry is now order <Link to={`/account/orders/${e.orderNumber}`} className="font-extrabold">{e.orderNumber}</Link>.</p>}
      <div className="grid gap-3 rounded-xl bg-cream p-4 text-sm [grid-template-columns:110px_1fr]">
        {rows.map(([k, v]) => <div key={k} className="contents"><span className="font-semibold muted">{k}</span><span>{v}</span></div>)}
      </div>
      <div>
        <h3 className="mb-2 text-sm font-extrabold">Your description</h3>
        <p className="whitespace-pre-wrap text-sm">{e.description}</p>
      </div>
      {e.referenceImages?.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-extrabold">Your reference photos</h3>
          <ReferenceImageList images={e.referenceImages} size={110} />
        </div>
      )}
      <div>
        <h3 className="mb-2 text-sm font-extrabold">Quote</h3>
        {!e.quote ? <p className="text-sm muted">We haven’t sent a quote yet. We usually reply within 24 hours.</p> : (
          <>
            {e.quote.lines.map((l, k) => <div key={k} className="sumline"><span>{l.label}</span><span className="num">{money(l.amount)}</span></div>)}
            <div className="sumline tot"><span>Total</span><span className="num">{money(e.quote.total)}</span></div>
            {deposit > 0 && <p className="mt-2 text-sm">A {e.quote.depositPercent}% deposit of <b>{money(deposit)}</b> confirms your booking.</p>}
            {e.quote.note && <p className="mt-2 text-sm muted">{e.quote.note}</p>}
          </>
        )}
      </div>
      {e.timeline?.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-extrabold">History</h3>
          <div className="hist">{e.timeline.map((h, k) => <div key={k} className="h">{h.text}<span className="block text-[11.5px] muted">{fmtStamp(h.at)}</span></div>)}</div>
        </div>
      )}
    </div>
  );
}

function Profile({ onSaved, onClose }) {
  const { user, setUser } = useAuth();
  const p = useForm({ defaultValues: { name: user.name, phone: user.phone || '', dietaryPref: user.dietaryPref || '' } });
  const pw = useForm({ defaultValues: { currentPassword: '', newPassword: '' } });
  // Birthday, address and WhatsApp consent are kept in the customer profile the bakery sees
  const [extra, setExtra] = useState(null);
  useEffect(() => {
    api.get('/account/profile')
      .then(({ data }) => setExtra({ dob: dobToForm(data.profile?.dob), anniversary: dobToForm(data.profile?.anniversary), address: addressToForm(data.profile?.address), whatsappOptIn: Boolean(data.profile?.whatsapp?.optIn) }))
      .catch(() => setExtra({ dob: dobToForm(null), anniversary: dobToForm(null), address: addressToForm(null), whatsappOptIn: false }));
  }, []);
  const save = p.handleSubmit(async (v) => {
    const dateProblem = extra && (dobError(extra.dob) || dobError(extra.anniversary));
    if (dateProblem) { toast.error(dateProblem); return; }
    const more = extra ? { dob: dobFromForm(extra.dob), anniversary: dobFromForm(extra.anniversary), address: addressFromForm(extra.address), whatsappOptIn: extra.whatsappOptIn } : {};
    try { const { data } = await api.patch('/account/profile', { ...v, ...more }); setUser(data.user); onSaved?.(data.profile); toast.success('Profile saved'); onClose?.(); } catch (e) { toast.error(apiError(e).message); }
  });
  const change = pw.handleSubmit(async (v) => {
    if (v.newPassword.length < 8) { pw.setError('newPassword', { message: 'Use at least 8 characters' }); return; }
    try { await api.post('/account/password', v); pw.reset(); toast.success('Password updated'); } catch (e) { const ae = apiError(e); Object.entries(ae.fields).forEach(([k, m]) => pw.setError(k, { message: m })); toast.error(ae.message); }
  });
  return (
    <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))]">
      <form className="card card-b flex flex-col gap-4" onSubmit={save}>
        <div className="flex items-center gap-3"><h2 className="flex-1 font-sans text-lg font-extrabold">Edit profile</h2>{onClose && <button type="button" className="iconbtn !h-9 !w-9" onClick={onClose} aria-label="Close"><X size={18} /></button>}</div>
        <Field label="Email"><input className="in" value={user.email} disabled /></Field>
        <Field label="Name" htmlFor="pn"><input id="pn" className="in" {...p.register('name', { required: true, minLength: 2 })} /></Field>
        <Field label="Mobile" htmlFor="pp"><input id="pp" className="in" {...p.register('phone')} /></Field>
        <Field label="Dietary preference" htmlFor="pd" help="Shown to our team when you order."><select id="pd" className="in" {...p.register('dietaryPref')}><option value="">None</option><option>Eggless</option><option>Vegan</option><option>Gluten-free</option><option>Nut-free</option></select></Field>
        {extra && (
          <div className="flex flex-col gap-4 border-t border-line-2 pt-4">
            <p className="text-sm muted">Optional. Tell us your birthday or anniversary so we can send you something special on the day.</p>
            <DobInput idPrefix="pf-dob" value={extra.dob} onChange={(dob) => setExtra({ ...extra, dob })} help="The year is optional." />
            <DobInput idPrefix="pf-ann" label="Wedding anniversary" value={extra.anniversary} onChange={(anniversary) => setExtra({ ...extra, anniversary })} help="Optional. We’d love to help you celebrate." />
            <AddressInput idPrefix="pf-addr" value={extra.address} onChange={(address) => setExtra({ ...extra, address })} />
            <label className="check items-start !min-h-0">
              <input type="checkbox" className="mt-0.5" checked={extra.whatsappOptIn} onChange={(e) => setExtra({ ...extra, whatsappOptIn: e.target.checked })} />
              <span className="text-sm">Send me birthday offers and special deals from Patiala Bakers on WhatsApp<span className="block text-xs muted">You can turn this off here at any time, or reply STOP to any message.</span></span>
            </label>
          </div>
        )}
        <button className="btn btn-p self-start" disabled={p.formState.isSubmitting}>{p.formState.isSubmitting && <Spinner />} Save</button>
      </form>
      {user.googleLinked ? (
        <div className="card card-b flex flex-col gap-2">
          <h2 className="font-sans text-lg font-extrabold">Sign-in</h2>
          <p className="muted">You sign in with your Google account, so there's no password to manage here.</p>
        </div>
      ) : (
      <form className="card card-b flex flex-col gap-4" onSubmit={change}>
        <h2 className="font-sans text-lg font-extrabold">Change password</h2>
        <Field label="Current password" htmlFor="cp" error={pw.formState.errors.currentPassword?.message}><input id="cp" type="password" autoComplete="current-password" className="in" {...pw.register('currentPassword', { required: 'Required' })} /></Field>
        <Field label="New password" htmlFor="np" error={pw.formState.errors.newPassword?.message}><input id="np" type="password" autoComplete="new-password" className="in" {...pw.register('newPassword')} /></Field>
        <button className="btn btn-o self-start" disabled={pw.formState.isSubmitting}>Update password</button>
      </form>
      )}
    </div>
  );
}

// The customer's details at the top of the account page, with a button to edit them
const PC_CSS = `
.pc { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 2fr); border-radius: 24px; background: #fff; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 18px 40px -20px rgba(0,0,0,.25); }
/* dark panel with soft coloured glows */
.pc-me { position: relative; isolation: isolate; display: flex; flex-direction: column; gap: 14px; padding: 28px; color: #fff; overflow: hidden;
  background: radial-gradient(circle at 110% -10%, rgba(255,122,89,.55), transparent 45%), radial-gradient(circle at -20% 120%, rgba(124,92,255,.55), transparent 50%), #121212; }
.pc-me::after { content: ''; position: absolute; right: -40px; bottom: -40px; width: 160px; height: 160px; border-radius: 50%; border: 22px solid rgba(255,255,255,.05); z-index: -1; }
.pc-top { display: flex; align-items: center; gap: 16px; }
.pc-av { position: relative; width: 66px; height: 66px; flex: none; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800; color: #fff;
  background: linear-gradient(135deg, #FF7A59, #E83E8C 55%, #7C5CFF); box-shadow: 0 0 0 4px rgba(255,255,255,.12); }
.pc-me h2 { font-family: inherit; font-size: 22px; font-weight: 800; line-height: 1.2; color: #fff; }
.pc-role { display: inline-block; margin-top: 5px; padding: 2px 10px; border-radius: 999px; background: rgba(255,255,255,.12); font-size: 12px; font-weight: 700; color: #F2F2F2; }
.pc-line { display: flex; align-items: center; gap: 10px; font-size: 14px; color: #EDEDED; word-break: break-all; }
.pc-line i { width: 30px; height: 30px; flex: none; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,.1); color: #fff; }
.pc-edit { margin-top: auto; align-self: flex-start; display: inline-flex; align-items: center; gap: 8px; min-height: 42px; padding: 0 18px; border-radius: 999px; background: #fff; color: #111; font-size: 14px; font-weight: 800; transition: transform .2s, box-shadow .2s; }
.pc-edit:hover { transform: translateY(-2px); box-shadow: 0 8px 18px -6px rgba(255,122,89,.7); }
.pc-info { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(210px, 100%), 1fr)); gap: 12px; padding: 16px; background: #FAFAFA; }
/* each detail gets its own colour */
.pc-item { --c: #111; --bg: #F4F4F4; position: relative; display: flex; gap: 14px; align-items: flex-start; padding: 18px; border-radius: 18px; background: #fff; border: 1px solid #EFEFEF; overflow: hidden; transition: transform .25s, box-shadow .25s, border-color .25s; }
.pc-item::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--c); opacity: .85; }
.pc-item:hover { transform: translateY(-3px); border-color: transparent; box-shadow: 0 12px 24px -14px var(--c); }
.pc-item.bday { --c: #E83E8C; --bg: #FDE7F1; }
.pc-item.anni { --c: #E5484D; --bg: #FDE8E8; }
.pc-item.addr { --c: #2F6FED; --bg: #E6EEFE; }
.pc-item.diet { --c: #E08A00; --bg: #FFF1D6; }
.pc-item.wa { --c: #1FA855; --bg: #DFF6E7; }
.pc-ico { width: 42px; height: 42px; flex: none; border-radius: 13px; background: var(--bg); color: var(--c); display: flex; align-items: center; justify-content: center; transition: transform .35s cubic-bezier(.3,1.6,.5,1); }
.pc-item:hover .pc-ico { transform: rotate(-8deg) scale(1.08); }
.pc-lbl { display: block; font-size: 11.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--c); }
.pc-val { display: block; margin-top: 4px; font-size: 15px; font-weight: 700; color: #111; line-height: 1.4; }
.pc-add { margin-top: 6px; display: inline-flex; align-items: center; gap: 4px; padding: 3px 12px; border-radius: 999px; background: var(--bg); color: var(--c); font-size: 13px; font-weight: 800; transition: background .2s, color .2s; }
.pc-add:hover { background: var(--c); color: #fff; }
.pc-pill { display: inline-flex; align-items: center; gap: 6px; margin-top: 6px; padding: 3px 12px; border-radius: 999px; font-size: 12.5px; font-weight: 800; font-style: normal; }
.pc-pill::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.pc-pill.on { background: #DFF6E7; color: #17803F; }
.pc-pill.off { background: #EFEFEF; color: #666; }
@media (min-width: 1100px) { .pc-info { grid-template-columns: repeat(3, minmax(0, 1fr)); } .pc-item.wa { grid-column: span 2; } }
@media (max-width: 760px) { .pc { grid-template-columns: 1fr; } }
/* Orders / enquiries switch */
.acc-tabs { display: inline-flex; flex-wrap: wrap; gap: 4px; margin-bottom: 22px; padding: 5px; border-radius: 999px; background: #EFEFEF; }
.acc-tab { display: inline-flex; align-items: center; gap: 8px; min-height: 42px; padding: 0 18px; border-radius: 999px; font-size: 14.5px; font-weight: 800; color: #555; text-decoration: none; transition: background .25s, color .25s, box-shadow .25s; }
.acc-tab:hover { color: #111; }
.acc-tab.on { background: #111; color: #fff; box-shadow: 0 6px 14px -6px rgba(0,0,0,.45); }
@media (prefers-reduced-motion: reduce) { .pc-item, .pc-ico, .pc-edit { transition: none; } }
`;

function ProfileCard({ profile, onEdit }) {
  const { user } = useAuth();
  const initials = (user.name.match(/\b[A-Za-z]/g) || ['?']).join('').slice(0, 2).toUpperCase();
  const add = <button type="button" className="pc-add" onClick={onEdit}>+ Add</button>;
  const items = [
    [Cake, 'Birthday', profile?.dob ? fmtDob(profile.dob) : null, 'bday'],
    [Heart, 'Anniversary', profile?.anniversary ? fmtDob(profile.anniversary) : null, 'anni'],
    [MapPin, 'Address', profile?.address ? fmtAddress(profile.address) : null, 'addr'],
    [Utensils, 'Dietary preference', user.dietaryPref || null, 'diet'],
  ];
  return (
    <section className="pc" aria-label="Your profile">
      <div className="pc-me">
        <div className="pc-top">
          <span className="pc-av" aria-hidden="true">{initials}</span>
          <div className="min-w-0"><h2>{user.name}</h2><span className="pc-role">{user.role === 'staff' ? 'Staff account' : 'Customer account'}</span></div>
        </div>
        <div className="pc-line"><i><Mail size={15} aria-hidden="true" /></i>{user.email}</div>
        <div className="pc-line"><i><Phone size={15} aria-hidden="true" /></i>{user.phone || 'No mobile number yet'}</div>
        <button type="button" className="pc-edit" onClick={onEdit}><Pencil size={15} aria-hidden="true" /> Edit profile</button>
      </div>
      <div className="pc-info">
        {items.map(([I, label, value, cls]) => (
          <div key={label} className={`pc-item ${cls}`}>
            <span className="pc-ico"><I size={20} aria-hidden="true" /></span>
            <div className="min-w-0"><span className="pc-lbl">{label}</span>{value ? <b className="pc-val">{value}</b> : add}</div>
          </div>
        ))}
        <div className="pc-item wa">
          <span className="pc-ico"><MessageCircle size={20} aria-hidden="true" /></span>
          <div><span className="pc-lbl">WhatsApp offers</span><em className={`pc-pill ${profile?.whatsapp?.optIn ? 'on' : 'off'}`}>{profile?.whatsapp?.optIn ? 'On' : 'Off'}</em></div>
        </div>
      </div>
    </section>
  );
}

export default function Account() {
  const { user, logout, isStaff } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const tab = ({ isActive }) => `acc-tab${isActive ? ' on' : ''}`;
  // Birthday, anniversary, address and WhatsApp choice for the card at the top
  const [profile, setProfile] = useState(null);
  useEffect(() => { api.get('/account/profile').then(({ data }) => setProfile(data.profile)).catch(() => {}); }, []);
  // /account/profile opens the edit form in place of the card
  const editing = loc.pathname === '/account/profile';
  return (
    <>
      <style>{PC_CSS}</style>
      <div className="pagehead"><div className="wrap flex flex-wrap items-end gap-4"><div className="flex-1"><p className="eyebrow">My account</p><h1>Hi, {user.name.split(' ')[0]}</h1></div>
        {isStaff && <Link to="/admin" className="btn btn-p">Open admin</Link>}
        <button className="btn btn-o" onClick={async () => { await logout(); nav('/'); }}><LogOut size={16} /> Sign out</button></div></div>
      <div className="wrap flex flex-col gap-8 py-8">
        {editing
          ? <Profile onSaved={(pr) => pr && setProfile(pr)} onClose={() => nav('/account')} />
          : <ProfileCard profile={profile} onEdit={() => nav('/account/profile')} />}
        <div>
          <nav className="acc-tabs" aria-label="Account sections"><NavLink end to="/account" className={tab}><ShoppingBag size={16} aria-hidden="true" /> Orders</NavLink><NavLink to="/account/enquiries" className={tab}><Cake size={16} aria-hidden="true" /> Custom cake enquiries</NavLink></nav>
          <Routes>
            <Route index element={<Orders />} />
            <Route path="orders/:orderNumber" element={<OrderDetail />} />
            <Route path="enquiries" element={<Enquiries />} />
            <Route path="enquiries/:reference" element={<EnquiryDetail />} />
            <Route path="profile" element={<Orders />} />
          </Routes>
        </div>
      </div>
    </>
  );
}