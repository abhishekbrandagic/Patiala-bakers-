import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Cake, MapPin, MessageCircle, Pencil, Plus } from 'lucide-react';
import { api, apiError } from '../../api/client.js';
import { Badge, Modal, PageLoader, Spinner } from '../ui.jsx';
import { AddressInput, DobInput } from '../ProfileFields.jsx';
import { fmtDate, fmtStamp, money } from '../../utils/format.js';
import { addressFromForm, addressToForm, dobError, dobFromForm, dobToForm, fmtAddress, fmtDob } from '../../utils/dob.js';

const CSS = `
.cc-row { display: grid; grid-template-columns: 26px 140px 1fr auto; align-items: center; gap: 8px; padding: 11px 0; border-bottom: 1px solid #E1EDF9; font-size: 14px; }
.cc-row:last-child { border-bottom: 0; }
.cc-row svg { color: #5F748C; }
.cc-key { font-weight: 700; color: #5F748C; }
.cc-empty { color: #8A9AAC; font-style: italic; }
.cc-stat { border-radius: 12px; background: #F5FAFE; border: 1px solid #E1EDF9; padding: 10px 12px; }
.cc-stat b { display: block; font-size: 18px; font-variant-numeric: tabular-nums; }
.cc-stat span { font-size: 12px; font-weight: 700; color: #5F748C; }
@media (max-width: 560px) { .cc-row { grid-template-columns: 22px 1fr auto; } .cc-row .cc-val { grid-column: 2 / -1; } }
`;

/**
 * A customer's saved details (birthday, address, WhatsApp consent) with an edit form.
 * Finds the customer by `email` and/or `phone`, so it works for guests and counter customers too.
 */
export function CustomerDetails({ email, phone, name, onOpenOrder, compact = false }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setError('');
    api.get('/admin/customer-profile', { params: { email, phone, name } })
      .then(({ data }) => setD(data))
      .catch((e) => setError(apiError(e).message));
  };
  useEffect(load, [email, phone]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <p className="errbox">{error}</p>;
  if (!d) return <PageLoader />;
  const p = d.profile;

  const startEdit = () => setEdit({ dob: dobToForm(p?.dob), address: addressToForm(p?.address), whatsappOptIn: Boolean(p?.whatsapp?.optIn) });
  const save = async () => {
    if (dobError(edit.dob)) return;
    setBusy(true);
    try {
      const { data } = await api.put('/admin/customer-profile', {
        email: d.customer.email, phone: d.customer.phone, name: d.customer.name,
        dob: dobFromForm(edit.dob), address: addressFromForm(edit.address), whatsappOptIn: edit.whatsappOptIn,
      });
      setD({ ...d, profile: data.profile });
      setEdit(null);
      toast.success('Customer details saved');
    } catch (e) { toast.error(apiError(e).message); } finally { setBusy(false); }
  };

  const Empty = () => <span className="cc-empty">Not added yet</span>;
  const AddBtn = ({ has }) => <button type="button" className="btn btn-ghost btn-xs" onClick={startEdit}>{has ? <Pencil size={13} aria-hidden="true" /> : <Plus size={13} aria-hidden="true" />} {has ? 'Edit' : 'Add'}</button>;
  const wa = p?.whatsapp;

  return (
    <div className="flex flex-col gap-5">
      <style>{CSS}</style>
      {!compact && <>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge cls={d.customer.registered ? 'b-ok' : 'b-mute'}>{d.customer.registered ? 'Registered' : 'Guest'}</Badge>
        {d.customer.phone && <a href={`tel:${d.customer.phone}`}>{d.customer.phone}</a>}
        {d.customer.email && <><span className="muted">·</span><a href={`mailto:${d.customer.email}`}>{d.customer.email}</a></>}
        {d.customer.memberSince && <span className="muted">· member since {fmtDate(d.customer.memberSince)}</span>}
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <div className="cc-stat"><span>Orders</span><b>{d.stats.orders}</b></div>
        <div className="cc-stat"><span>Total spent</span><b>{money(d.stats.spend)}</b></div>
        <div className="cc-stat"><span>Last order</span><b className="!text-sm !leading-7">{d.stats.lastOrder ? fmtDate(d.stats.lastOrder) : '—'}</b></div>
      </div>
      </>}

      {edit ? (
        <section className="flex flex-col gap-4 rounded-[14px] border border-line-2 bg-white p-4">
          <h4 className="text-sm font-extrabold">Edit details</h4>
          <DobInput idPrefix="cc-dob" value={edit.dob} onChange={(dob) => setEdit({ ...edit, dob })} help="Day and month are enough. The year is optional." />
          <AddressInput idPrefix="cc-addr" value={edit.address} onChange={(address) => setEdit({ ...edit, address })} />
          <label className="check items-start !min-h-0">
            <input type="checkbox" className="mt-0.5" checked={edit.whatsappOptIn} onChange={(e) => setEdit({ ...edit, whatsappOptIn: e.target.checked })} />
            <span className="text-sm">The customer agreed to get birthday offers and deals from us on WhatsApp<span className="block text-xs muted">Only tick this if they said yes. It is saved with your name and today’s date.</span></span>
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-o btn-sm" onClick={() => setEdit(null)} disabled={busy}>Cancel</button>
            <button type="button" className="btn btn-p btn-sm" onClick={save} disabled={busy || Boolean(dobError(edit.dob))}>{busy && <Spinner />} Save details</button>
          </div>
        </section>
      ) : (
        <section className="rounded-[14px] border border-line-2 bg-white px-4 py-1">
          <div className="cc-row"><Cake size={17} aria-hidden="true" /><span className="cc-key">Birthday</span><span className="cc-val">{p?.dob ? <b>{fmtDob(p.dob)}</b> : <Empty />}</span><AddBtn has={Boolean(p?.dob)} /></div>
          <div className="cc-row"><MapPin size={17} aria-hidden="true" /><span className="cc-key">Address</span><span className="cc-val">{p?.address ? fmtAddress(p.address) : <Empty />}</span><AddBtn has={Boolean(p?.address)} /></div>
          <div className="cc-row"><MessageCircle size={17} aria-hidden="true" /><span className="cc-key">WhatsApp offers</span>
            <span className="cc-val">{wa?.optIn ? <><Badge cls="b-ok">Agreed</Badge> <span className="text-xs muted">{fmtStamp(wa.at)} · {wa.by === 'customer' ? 'by the customer' : `recorded by ${wa.by}`}</span></> : wa?.optOutAt ? <><Badge cls="b-bad">Said no</Badge> <span className="text-xs muted">{fmtStamp(wa.optOutAt)}</span></> : <span className="cc-empty">Not asked yet</span>}</span>
            <AddBtn has={Boolean(wa?.optIn || wa?.optOutAt)} />
          </div>
          {d.customer.dietaryPref && <div className="cc-row"><span /><span className="cc-key">Dietary</span><span className="cc-val">{d.customer.dietaryPref}</span><span /></div>}
          {p?.updatedBy && <p className="pb-2 pt-1 text-right text-[11.5px] muted">Last updated {fmtStamp(p.updatedAt)} · {p.updatedBy === 'customer' ? 'by the customer' : p.updatedBy}</p>}
        </section>
      )}

      {!compact && d.orders.length > 0 && (
        <section>
          <h4 className="mb-2 text-sm font-extrabold">Recent orders</h4>
          <div className="flex flex-col">
            {d.orders.map((o) => (
              <button key={o._id} type="button" className="mini" onClick={() => onOpenOrder?.(o._id)} disabled={!onOpenOrder}>
                <span className="w-[92px] flex-none text-[13px] font-extrabold">{o.orderNumber}<span className="block text-[11.5px] font-semibold muted">{fmtDate(o.pickupDate)}</span></span>
                <span className="nm min-w-0 flex-1 truncate text-sm">{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</span>
                <b className="num text-sm">{money(o.total)}</b>
                <Badge>{o.status}</Badge>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// The same details in a popup, opened from an order
export default function CustomerCard({ open, onClose, email, phone, name, onOpenOrder }) {
  const nav = useNavigate();
  // By default a past order opens on the Orders page
  const openOrder = onOpenOrder || ((orderId) => { onClose(); nav(`/admin/orders?open=${orderId}`); });
  return (
    <Modal open={open} onClose={onClose} title={name || 'Customer'} wide>
      {open && <CustomerDetails email={email} phone={phone} name={name} onOpenOrder={openOrder} />}
    </Modal>
  );
}