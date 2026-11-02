import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Printer, RefreshCw, Search, ShoppingBag, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, apiError } from '../../api/client.js';
import { EmptyState, ErrorState, Field, Modal, PageLoader, Qty, Spinner } from '../../components/ui.jsx';
import ProductImage from '../../components/ProductImage.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { cn, fmtStamp, money, sizeLabel, uid } from '../../utils/format.js';

const METHODS = [
  { id: 'cash', label: 'Cash' },
  { id: 'card_in_store', label: 'Card' },
  { id: 'bank_transfer', label: 'Bank transfer' },
];
const methodLabel = (id) => METHODS.find((m) => m.id === id)?.label || id;

const priceOf = (list, name) => list?.find((o) => o.name === name)?.price || 0;
const round2 = (n) => Math.round(n * 100) / 100;

// Same sums as the server's priceItems. The server still recalculates the price of every sale.
function unitPrice(product, variant, options, cakeOptions) {
  let unit = variant.price;
  if (options.vegan && !product.dietary?.vegan) unit += variant.veganUpcharge || 0;
  if (options.glutenFree && !product.dietary?.glutenFree) unit += variant.gfUpcharge || 0;
  if (product.customisable) {
    unit += priceOf(cakeOptions?.sponges, options.sponge) + priceOf(cakeOptions?.fillings, options.filling) + priceOf(cakeOptions?.finishes, options.finish);
    for (const addon of options.addons || []) unit += priceOf(cakeOptions?.addons, addon);
  }
  return round2(unit);
}

const canUpgrade = (product, variant, kind) => product.upgrades?.[kind] && (kind === 'vegan' ? variant.veganUpcharge : variant.gfUpcharge) != null;
const needsOptions = (product) => product.customisable || product.variants.some((v) => canUpgrade(product, v, 'vegan') || canUpgrade(product, v, 'glutenFree'));

function optionSummary(options = {}) {
  return [options.sponge, options.filling, options.finish, ...(options.addons || []), options.vegan && 'Vegan', options.glutenFree && 'Gluten-free'].filter(Boolean).join(' · ');
}

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Prints from a hidden frame, so pop-up blockers can't stop it and the admin page stays open
function printReceipt(sale, settings) {
  const { order, tendered } = sale;
  const b = settings?.business || {};
  const cur = (n) => esc(money(n, settings?.currency));
  const rows = order.items.map((i) => `<tr><td>${esc(i.qty)} × ${esc(i.name)}<br><small>${esc([sizeLabel(i.variant), optionSummary(i.options)].filter(Boolean).join(' · '))}${i.options?.message ? `<br>Message: ${esc(i.options.message)}` : ''}${i.options?.instructions ? `<br>Note: ${esc(i.options.instructions)}` : ''}</small></td><td class="r">${cur(i.lineTotal)}</td></tr>`).join('');
  const cash = tendered == null ? '' : `<tr><td>Cash received</td><td class="r">${cur(tendered)}</td></tr><tr><td>Change</td><td class="r">${cur(tendered - order.total)}</td></tr>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${esc(order.orderNumber)}</title><style>
    @page { size: 80mm auto; margin: 4mm; }
    body { font: 12px/1.4 Arial, Helvetica, sans-serif; color: #000; margin: 0; }
    h1 { font-size: 18px; margin: 0; text-align: center; } p { margin: 2px 0; text-align: center; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; border-top: 1px dashed #000; } td { padding: 3px 0; vertical-align: top; }
    .r { text-align: right; white-space: nowrap; padding-left: 8px; } .t td { font-size: 15px; font-weight: 700; }
    </style></head><body>
    <h1>${esc(b.name || 'Patiala Bakers')}</h1>
    ${b.address ? `<p>${esc(b.address)}</p>` : ''}${b.phone ? `<p>${esc(b.phone)}</p>` : ''}${b.abn ? `<p>ABN ${esc(b.abn)}</p>` : ''}
    <table><tr><td>Receipt</td><td class="r">${esc(order.orderNumber)}</td></tr><tr><td>Date</td><td class="r">${esc(fmtStamp(order.createdAt))}</td></tr><tr><td>Customer</td><td class="r">${esc(order.customer.name)}</td></tr></table>
    <table>${rows}</table>
    <table><tr class="t"><td>Total</td><td class="r">${cur(order.total)}</td></tr><tr><td>Paid by</td><td class="r">${esc(methodLabel(order.paymentMethod))}</td></tr>${cash}</table>
    <p style="margin-top:12px">Thank you!</p></body></html>`;

  const frame = document.createElement('iframe');
  frame.title = 'Receipt';
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
  document.body.appendChild(frame);
  const win = frame.contentWindow;
  win.document.open();
  win.document.write(html);
  win.document.close();
  setTimeout(() => {
    win.focus();
    win.print();
    setTimeout(() => frame.remove(), 60000);
  }, 100);
}

function OptionGroup({ label, list, value, onChange, currency }) {
  if (!list?.length) return null;
  return (
    <div>
      <span className="lbl">{label}</span>
      <div className="flex flex-wrap gap-2">
        {list.map((o) => (
          <button key={o.name} type="button" aria-pressed={value === o.name} className={cn('opt', value === o.name && 'on')} onClick={() => onChange(o.name)}>
            {o.name}{o.price > 0 && <span className="x">+{money(o.price, currency)}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// Size, cake options and add-ons for one line of the sale
function CakeOptionsModal({ editing, cakeOptions, currency, onSave, onClose }) {
  const { product, line } = editing;
  const first = (list, chosen) => (list?.some((o) => o.name === chosen) ? chosen : list?.[0]?.name || '');
  const [variantKey, setVariantKey] = useState(line?.variant || editing.variant);
  const [options, setOptions] = useState(() => ({
    sponge: first(cakeOptions?.sponges, line?.options?.sponge ?? product.defaults?.sponge),
    filling: first(cakeOptions?.fillings, line?.options?.filling ?? product.defaults?.filling),
    finish: first(cakeOptions?.finishes, line?.options?.finish ?? product.defaults?.finish),
    addons: line?.options?.addons || [],
    message: line?.options?.message || '',
    instructions: line?.options?.instructions || '',
    vegan: Boolean(line?.options?.vegan),
    glutenFree: Boolean(line?.options?.glutenFree),
  }));
  const set = (patch) => setOptions((current) => ({ ...current, ...patch }));
  const toggleAddon = (name) => set({ addons: options.addons.includes(name) ? options.addons.filter((a) => a !== name) : [...options.addons, name] });
  const variant = product.variants.find((v) => v.key === variantKey) || product.variants[0];

  // Only send what applies to this product and size
  const veganOk = canUpgrade(product, variant, 'vegan');
  const gfOk = canUpgrade(product, variant, 'glutenFree');
  const clean = {
    ...(product.customisable ? { sponge: options.sponge || undefined, filling: options.filling || undefined, finish: options.finish || undefined, addons: options.addons, message: options.message.trim() } : {}),
    instructions: options.instructions.trim(),
    ...(veganOk && options.vegan ? { vegan: true } : {}),
    ...(gfOk && options.glutenFree ? { glutenFree: true } : {}),
  };
  const price = unitPrice(product, variant, clean, cakeOptions);

  return (
    <Modal open wide onClose={onClose} title={product.name} footer={<>
      <span className="mr-auto self-center text-sm">Each <b className="num">{money(price, currency)}</b></span>
      <button className="btn btn-o" onClick={onClose}>Cancel</button>
      <button className="btn btn-p" onClick={() => onSave(variant, clean, price)}>{line ? 'Update sale' : 'Add to sale'}</button>
    </>}>
      <div className="flex flex-col gap-5">
        <div>
          <span className="lbl">Size</span>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((v) => (
              <button key={v.key} type="button" aria-pressed={v.key === variant.key} className={cn('opt', v.key === variant.key && 'on')} onClick={() => setVariantKey(v.key)}>
                {sizeLabel(v.key)}<span className="x">{money(v.price, currency)}</span>
              </button>
            ))}
          </div>
        </div>

        {(veganOk || gfOk) && (
          <div>
            <span className="lbl">Dietary</span>
            {veganOk && <label className="check"><input type="checkbox" checked={options.vegan} onChange={(e) => set({ vegan: e.target.checked })} /> Vegan <span className="text-xs muted">+{money(variant.veganUpcharge, currency)}</span></label>}
            {gfOk && <label className="check"><input type="checkbox" checked={options.glutenFree} onChange={(e) => set({ glutenFree: e.target.checked })} /> Gluten-free <span className="text-xs muted">+{money(variant.gfUpcharge, currency)}</span></label>}
          </div>
        )}

        {product.customisable && <>
          <OptionGroup label="Sponge" list={cakeOptions?.sponges} value={options.sponge} onChange={(sponge) => set({ sponge })} currency={currency} />
          <OptionGroup label="Filling" list={cakeOptions?.fillings} value={options.filling} onChange={(filling) => set({ filling })} currency={currency} />
          <OptionGroup label="Finish & decoration" list={cakeOptions?.finishes} value={options.finish} onChange={(finish) => set({ finish })} currency={currency} />
          {cakeOptions?.addons?.length > 0 && (
            <div>
              <span className="lbl">Add-ons</span>
              <div className="grid gap-x-4 [grid-template-columns:repeat(auto-fill,minmax(210px,1fr))]">
                {cakeOptions.addons.map((a) => (
                  <label key={a.name} className="check"><input type="checkbox" checked={options.addons.includes(a.name)} onChange={() => toggleAddon(a.name)} /> {a.name} <span className="text-xs muted">+{money(a.price, currency)}</span></label>
                ))}
              </div>
            </div>
          )}
          <Field label="Message on the cake (optional)" htmlFor="pos-message"><input id="pos-message" className="in" maxLength={Math.min(cakeOptions?.maxMessageLength || 40, 80)} value={options.message} onChange={(e) => set({ message: e.target.value })} /></Field>
        </>}

        <Field label="Additional instructions (optional)" htmlFor="pos-notes"><textarea id="pos-notes" className="in" maxLength={500} value={options.instructions} onChange={(e) => set({ instructions: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

export default function Pos() {
  const { settings, categories } = useSettings();
  const currency = settings?.currency;
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [method, setMethod] = useState('cash');
  const [tendered, setTendered] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lastSale, setLastSale] = useState(null);
  const [editing, setEditing] = useState(null);
  // One key per sale. It survives a retry of the same cart, so a lost response can't charge twice.
  const saleKey = useRef(uid());
  const submitting = useRef(false);

  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const { data } = await api.get('/admin/pos/products');
      setProducts(data.items);
    } catch (e) { setLoadError(apiError(e).message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => (category === 'all' || p.category === category) && (!q || p.name.toLowerCase().includes(q)));
  }, [products, category, search]);

  const total = useMemo(() => Math.round(cart.reduce((sum, l) => sum + l.price * l.qty, 0) * 100) / 100, [cart]);
  const cash = tendered === '' ? null : Number(tendered);
  const cashShort = method === 'cash' && cash != null && cash < total;

  const changeCart = (next) => { saleKey.current = uid(); setCart(next); setError(''); };
  // How many more of a product this line can hold, counting the other lines in the sale
  const stockLeft = (p, lineId) => (p.stockQty == null ? 50 : Math.min(50, p.stockQty - cart.filter((l) => l.productId === p._id && l.id !== lineId).reduce((sum, l) => sum + l.qty, 0)));

  const add = (p, v) => {
    if (needsOptions(p)) {
      if (stockLeft(p, null) < 1) { toast.error(`No more ${p.name} available.`); return; }
      setEditing({ product: p, variant: v.key, line: null });
      return;
    }
    const line = cart.find((l) => l.productId === p._id && l.variant === v.key);
    const max = stockLeft(p, line?.id);
    if ((line?.qty || 0) >= max) { toast.error(`Only ${max} × ${p.name} available.`); return; }
    if (line) changeCart(cart.map((l) => (l === line ? { ...l, qty: l.qty + 1 } : l)));
    else changeCart([...cart, { id: uid(), productId: p._id, variant: v.key, name: p.name, price: v.price, qty: 1, options: {} }]);
  };
  const saveOptions = (variant, options, price) => {
    const { product, line } = editing;
    if (line) changeCart(cart.map((l) => (l.id === line.id ? { ...l, variant: variant.key, options, price } : l)));
    else changeCart([...cart, { id: uid(), productId: product._id, variant: variant.key, name: product.name, price, qty: 1, options, custom: true }]);
    setEditing(null);
  };
  const setQty = (line, qty) => changeCart(cart.map((l) => (l === line ? { ...l, qty } : l)));
  const remove = (line) => changeCart(cart.filter((l) => l !== line));
  const resetSale = () => { saleKey.current = uid(); setCart([]); setCustomerName(''); setMethod('cash'); setTendered(''); setError(''); };

  const complete = async () => {
    if (submitting.current || !cart.length || cashShort) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      const { data } = await api.post('/admin/pos/sales', {
        idempotencyKey: saleKey.current,
        items: cart.map(({ id, productId, variant, qty, options }) => ({ id, productId, variant, qty, options })),
        paymentMethod: method,
        customerName: customerName.trim(),
        ...(method === 'cash' && cash != null ? { cashTendered: cash } : {}),
      });
      const sale = { order: data.order, tendered: method === 'cash' ? cash : null };
      setLastSale(sale);
      printReceipt(sale, settings);
      toast.success(`Sale ${data.order.orderNumber} saved`);
      resetSale();
      load();
    } catch (e) {
      const ae = apiError(e);
      setError(ae.issues?.[0]?.message || Object.values(ae.fields)[0] || ae.message);
    } finally { submitting.current = false; setBusy(false); }
  };

  return (
    <div className="grid items-start gap-5 xl:[grid-template-columns:minmax(0,1fr)_380px]">
      {editing && <CakeOptionsModal editing={editing} cakeOptions={settings?.cakeOptions} currency={currency} onSave={saveOptions} onClose={() => setEditing(null)} />}
      <section className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" aria-hidden="true" />
            <label className="sr-only" htmlFor="pos-search">Search products</label>
            <input id="pos-search" className="in !min-h-[40px] !pl-10" placeholder="Search products" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-o btn-sm" onClick={load} disabled={loading}><RefreshCw size={15} /> Refresh</button>
        </div>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Category">
          {[{ id: 'all', name: 'All' }, ...(categories || [])].map((c) => (
            <button key={c.id} role="tab" aria-selected={category === c.id} className={cn('tab', category === c.id && 'on')} onClick={() => setCategory(c.id)}>{c.name}</button>
          ))}
        </div>

        {loading && !products.length ? <PageLoader label="Loading products…" />
          : loadError ? <ErrorState message={loadError} onRetry={load} />
          : !visible.length ? <EmptyState title="No products to sell">Check the search, or make sure products are available in Products & Inventory.</EmptyState>
          : (
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
              {visible.map((p) => (
                <article key={p._id} className="card flex flex-col overflow-hidden">
                  <ProductImage src={p.images?.[0]?.url} alt={p.images?.[0]?.alt} name={p.name} category={p.category} className="h-28 w-full overflow-hidden object-cover" />
                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <h3 className="font-sans text-sm font-bold leading-snug">{p.name}</h3>
                    {p.stockQty != null && <span className="text-xs muted">{p.stockQty} in stock</span>}
                    <div className="mt-auto flex flex-col gap-1.5">
                      {p.variants.map((v) => (
                        <button key={v.key} className="btn btn-o btn-xs !justify-between !whitespace-normal" onClick={() => add(p, v)} disabled={busy}>
                          <span className="text-left">{sizeLabel(v.key)}</span><span className="num">{money(v.price, currency)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
      </section>

      <aside className="card flex flex-col gap-4 p-5 xl:sticky xl:top-5">
        <h2 className="font-sans text-base font-extrabold">Current sale</h2>
        {!cart.length ? (
          <div className="py-8 text-center muted"><ShoppingBag className="mx-auto mb-2 h-7 w-7" aria-hidden="true" />Add products to start a sale.</div>
        ) : (
          <div className="flex max-h-[38vh] flex-col overflow-y-auto">
            {cart.map((l) => {
              const product = products.find((p) => p._id === l.productId);
              return (
              <div key={l.id} className="border-b border-line-2 py-2.5 last:border-0">
                <div className="flex justify-between gap-3 text-sm"><span><b>{l.name}</b><span className="block text-xs muted">{sizeLabel(l.variant)} · {money(l.price, currency)}</span>{optionSummary(l.options) && <span className="block text-xs muted">{optionSummary(l.options)}</span>}{l.options?.message && <span className="block text-xs muted">“{l.options.message}”</span>}</span><b className="num">{money(l.price * l.qty, currency)}</b></div>
                <div className="mt-1.5 flex items-center justify-between">
                  <Qty small value={l.qty} max={product ? stockLeft(product, l.id) : 50} onChange={(qty) => setQty(l, qty)} label={`Quantity of ${l.name}`} />
                  <span className="flex items-center gap-1">
                    {l.custom && product && <button className="btn btn-o btn-xs" onClick={() => setEditing({ product, line: l })}>Edit</button>}
                    <button className="iconbtn !h-8 !w-8" aria-label={`Remove ${l.name}`} onClick={() => remove(l)}><Trash2 size={15} /></button>
                  </span>
                </div>
              </div>
              );
            })}
          </div>
        )}

        <div className="sumline tot"><span>Total</span><span className="num">{money(total, currency)}</span></div>

        <Field label="Customer name (optional)" htmlFor="pos-customer"><input id="pos-customer" className="in" maxLength={120} value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></Field>

        <div>
          <span className="lbl">Payment</span>
          <div className="seggrp">{METHODS.map((m) => <button key={m.id} type="button" aria-pressed={method === m.id} className={cn('seg', method === m.id && 'on')} onClick={() => setMethod(m.id)}>{m.label}</button>)}</div>
        </div>

        {method === 'cash' && (
          <Field label="Cash received (optional)" htmlFor="pos-cash" error={cashShort ? 'This is less than the total.' : ''} help={cash != null && !cashShort ? `Change: ${money(cash - total, currency)}` : ''}>
            <input id="pos-cash" type="number" inputMode="decimal" min="0" step="0.05" className={cn('in', cashShort && 'err')} value={tendered} onChange={(e) => setTendered(e.target.value)} />
          </Field>
        )}

        {error && <p className="errbox" role="alert">{error}</p>}

        <button className="btn btn-p btn-lg w-full" disabled={busy || !cart.length || cashShort} onClick={complete}>{busy ? <Spinner /> : <Printer size={17} />} Complete sale & print</button>
        <button className="btn btn-ghost btn-sm" disabled={busy || !cart.length} onClick={resetSale}>Clear sale</button>

        {lastSale && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-ok-bg px-3.5 py-2.5 text-sm" role="status">
            <span><b>{lastSale.order.orderNumber}</b> · {money(lastSale.order.total, currency)}{lastSale.tendered != null && <span className="block text-xs">Change {money(lastSale.tendered - lastSale.order.total, currency)}</span>}</span>
            <button className="btn btn-o btn-xs" onClick={() => printReceipt(lastSale, settings)}>Reprint</button>
          </div>
        )}
      </aside>
    </div>
  );
}