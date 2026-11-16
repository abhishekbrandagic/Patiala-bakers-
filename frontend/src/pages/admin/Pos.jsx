import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChefHat,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Pencil,
  Printer,
  RefreshCw,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { api, apiError } from "../../api/client.js";
import {
  EmptyState,
  ErrorState,
  Field,
  PageLoader,
  Qty,
  Spinner,
} from "../../components/ui.jsx";
import ProductImage from "../../components/ProductImage.jsx";
import DiscountInput from "../../components/admin/DiscountInput.jsx";
import {
  discountAmount,
  discountError,
  discountPayload,
} from "../../utils/discount.js";
import {
  ReferenceImageList,
  ReferenceImagesInput,
} from "../../components/ReferenceImages.jsx";
import { useSettings } from "../../context/SettingsContext.jsx";
import {
  cn,
  fmtLong,
  fmtStamp,
  money,
  sizeLabel,
  t12,
  todayISO,
  uid,
} from "../../utils/format.js";

const METHODS = [
  { id: "cash", label: "Cash" },
  { id: "card_in_store", label: "Card" },
  { id: "bank_transfer", label: "Bank transfer" },
];
const methodLabel = (id) => METHODS.find((m) => m.id === id)?.label || id;

const priceOf = (list, name) => list?.find((o) => o.name === name)?.price || 0;
const round2 = (n) => Math.round(n * 100) / 100;

// Same sums as the server's priceItems. The server still recalculates the price of every sale.
function unitPrice(product, variant, options, cakeOptions) {
  let unit = variant.price;
  if (options.vegan && !product.dietary?.vegan)
    unit += variant.veganUpcharge || 0;
  if (options.glutenFree && !product.dietary?.glutenFree)
    unit += variant.gfUpcharge || 0;
  if (product.customisable) {
    unit +=
      priceOf(cakeOptions?.sponges, options.sponge) +
      priceOf(cakeOptions?.fillings, options.filling) +
      priceOf(cakeOptions?.finishes, options.finish);
    for (const addon of options.addons || [])
      unit += priceOf(cakeOptions?.addons, addon);
  }
  return round2(unit);
}

const canUpgrade = (product, variant, kind) =>
  product.upgrades?.[kind] &&
  (kind === "vegan" ? variant.veganUpcharge : variant.gfUpcharge) != null;
const needsOptions = (product) =>
  product.customisable ||
  product.variants.length > 1 ||
  product.variants.some(
    (v) =>
      canUpgrade(product, v, "vegan") || canUpgrade(product, v, "glutenFree"),
  );

// Same labels as the server's priceBreakdown, so the sale and the printed bill agree
function buildBreakdown(product, variant, options, cakeOptions) {
  const rows = [
    { label: `${product.name} · ${variant.key}`, amount: variant.price },
  ];
  const paid = (label, amount) => {
    if (amount) rows.push({ label, amount });
  };
  if (options.vegan && !product.dietary?.vegan)
    paid("Vegan upgrade", variant.veganUpcharge);
  if (options.glutenFree && !product.dietary?.glutenFree)
    paid("Gluten-free upgrade", variant.gfUpcharge);
  if (product.customisable) {
    paid(
      `${options.sponge} sponge`,
      priceOf(cakeOptions?.sponges, options.sponge),
    );
    paid(
      `${options.filling} filling`,
      priceOf(cakeOptions?.fillings, options.filling),
    );
    paid(
      `${options.finish} finish`,
      priceOf(cakeOptions?.finishes, options.finish),
    );
    for (const addon of options.addons || [])
      paid(addon, priceOf(cakeOptions?.addons, addon));
  }
  return rows;
}

// One bill row per choice: the item on the left, its price on the right (0 means included)
function billRows({ variant, options = {}, priceBreakdown = [] }) {
  const charge = (label) =>
    priceBreakdown.slice(1).find((r) => r.label === label)?.amount || 0;
  const rows = [
    { label: sizeLabel(variant), amount: priceBreakdown[0]?.amount ?? 0 },
  ];
  for (const [field, word] of [
    ["sponge", "sponge"],
    ["filling", "filling"],
    ["finish", "finish"],
  ]) {
    if (options[field])
      rows.push({
        label: `${options[field]} ${word}`,
        amount: charge(`${options[field]} ${word}`),
      });
  }
  if (options.vegan)
    rows.push({ label: "Vegan", amount: charge("Vegan upgrade") });
  if (options.glutenFree)
    rows.push({ label: "Gluten-free", amount: charge("Gluten-free upgrade") });
  for (const addon of options.addons || [])
    rows.push({ label: addon, amount: charge(addon) });
  return rows;
}

// Customer details checks. The server checks the phone and email again.
const validPhone = (value) => /^\d{10}$/.test(value);
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

// Prints from a hidden frame, so pop-up blockers can't stop it and the admin page stays open
function printReceipt(sale, settings) {
  const { order, tendered } = sale;
  const b = settings?.business || {};
  const cur = (n) => esc(money(n, settings?.currency));
  const rows = order.items
    .map((i) => {
      const notes = [
        i.options?.message && `Message: ${i.options.message}`,
        i.options?.instructions && `Note: ${i.options.instructions}`,
      ].filter(Boolean);
      return `<tr class="item"><td colspan="2">${esc(i.qty)} × ${esc(i.name)}</td></tr>
      ${billRows(i)
        .map(
          (r) =>
            `<tr class="sub"><td>${esc(r.label)}</td><td class="r">${r.amount ? cur(r.amount) : "Included"}</td></tr>`,
        )
        .join("")}
      ${notes.map((n) => `<tr class="sub"><td colspan="2">${esc(n)}</td></tr>`).join("")}
      <tr class="line"><td>${i.qty > 1 ? `Item total (${esc(i.qty)} × ${cur(i.unitPrice)})` : "Item total"}</td><td class="r">${cur(i.lineTotal)}</td></tr>`;
    })
    .join("");
  const off = order.discount?.amount > 0 ? order.discount : null;
  const fees =
    (order.fees > 0 || off
      ? `<tr><td>Subtotal</td><td class="r">${cur(order.subtotal)}</td></tr>`
      : "") +
    (order.fees > 0
      ? `<tr><td>${esc(settings?.fees?.serviceFeeLabel || "Service fee")}</td><td class="r">${cur(order.fees)}</td></tr>`
      : "") +
    (off
      ? `<tr><td>Discount${off.mode === "%" ? ` (${esc(off.value)}%)` : ""}</td><td class="r">-${cur(off.amount)}</td></tr>`
      : "");
  const cash =
    tendered == null
      ? ""
      : `<tr><td>Cash received</td><td class="r">${cur(tendered)}</td></tr><tr><td>Change</td><td class="r">${cur(tendered - order.total)}</td></tr>`;
  const toMake = order.source !== "POS";
  const paid = order.amountPaid || 0;
  const payment = toMake
    ? `<tr><td>Paid</td><td class="r">${cur(paid)}</td></tr><tr><td>Balance due</td><td class="r">${cur(Math.max(0, order.total - paid))}</td></tr>`
    : `<tr><td>Paid by</td><td class="r">${esc(methodLabel(order.paymentMethod))}</td></tr>`;
  const pickup = toMake
    ? `<tr><td>Pickup</td><td class="r">${esc(fmtLong(order.pickupDate))}, ${esc(t12(order.pickupTime))}</td></tr>`
    : "";
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${esc(order.orderNumber)}</title><style>
    @page { size: 80mm auto; margin: 4mm; }
    body { font: 12px/1.4 Arial, Helvetica, sans-serif; color: #000; margin: 0; }
    h1 { font-size: 18px; margin: 0; text-align: center; } p { margin: 2px 0; text-align: center; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; border-top: 1px dashed #000; } td { padding: 3px 0; vertical-align: top; }
    .r { text-align: right; white-space: nowrap; padding-left: 8px; } .t td { font-size: 15px; font-weight: 700; }
    .item td { padding-top: 7px; font-weight: 700; } .sub td { padding: 1px 0 1px 10px; font-size: 11px; } .sub .r { padding-left: 8px; } .line td { padding: 2px 0 5px; font-weight: 700; border-bottom: 1px dotted #000; }
    </style></head><body>
    <h1>${esc(b.name || "Patiala Bakers")}</h1>
    ${b.address ? `<p>${esc(b.address)}</p>` : ""}${b.phone ? `<p>${esc(b.phone)}</p>` : ""}${b.abn ? `<p>ABN ${esc(b.abn)}</p>` : ""}
    <table><tr><td>Receipt</td><td class="r">${esc(order.orderNumber)}</td></tr><tr><td>Date</td><td class="r">${esc(fmtStamp(order.createdAt))}</td></tr><tr><td>Customer</td><td class="r">${esc(order.customer.name)}</td></tr>${pickup}</table>
    <table>${rows}</table>
    <table>${fees}<tr class="t"><td>Total</td><td class="r">${cur(order.total)}</td></tr>${payment}${cash}</table>
    <p style="margin-top:12px">Thank you!</p></body></html>`;

  const frame = document.createElement("iframe");
  frame.title = "Receipt";
  frame.style.cssText =
    "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
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

// Styles for the POS screen, kept in this file so nothing else needs changing
const POS_CSS = `
.pos-layout { display: grid; gap: 20px; align-items: start; }
@media (min-width: 1240px) { .pos-layout { grid-template-columns: minmax(0, 1fr) 390px; } .pos-side { position: sticky; top: 16px; max-height: calc(100vh - 32px); } }

.pos-search { display: flex; gap: 10px; }
.pos-searchbox { flex: 1; display: flex; min-width: 0; background: #fff; border: 1px solid #CFE2F5; border-radius: 12px; overflow: hidden; transition: border-color .15s, box-shadow .15s; }
.pos-searchbox:focus-within { border-color: #0B6BCB; box-shadow: 0 0 0 3px rgba(11,107,203,.1); }
.pos-searchbox input { flex: 1; min-width: 0; padding: 0 14px; height: 44px; background: transparent; outline: none; }
.pos-searchicon { flex: none; display: flex; align-items: center; justify-content: center; width: 48px; background: #0B6BCB; color: #FFFFFF; }
.pos-refresh { flex: none; display: flex; align-items: center; justify-content: center; width: 46px; height: 46px; border: 1px solid #CFE2F5; border-radius: 12px; background: #fff; color: #0B6BCB; transition: background .15s; }
.pos-refresh:hover { background: #E3F0FC; }

.pos-cats-wrap { display: flex; align-items: center; gap: 8px; min-width: 0; }
.pos-cats { flex: 1; min-width: 0; display: flex; gap: 10px; overflow-x: auto; padding: 2px; scroll-behavior: smooth; scrollbar-width: none; }
.pos-cats::-webkit-scrollbar { display: none; }
.pos-arrow { flex: none; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border: 1px solid #CFE2F5; border-radius: 50%; background: #fff; color: #0B6BCB; box-shadow: 0 1px 4px rgba(15,42,74,.1); transition: background .15s, opacity .15s; }
.pos-arrow:hover:not(:disabled) { background: #E3F0FC; }
.pos-arrow:disabled { opacity: .35; box-shadow: none; }
.pos-cat { flex: none; display: flex; flex-direction: column; align-items: center; gap: 7px; width: 112px; padding: 10px 8px; background: #FFFFFF; border: 1px solid #DCEAF8; border-bottom: 3px solid #DCEAF8; border-radius: 14px; font-size: 12.5px; font-weight: 700; line-height: 1.2; text-align: center; color: #0F2A4A; transition: background .15s, border-color .15s; }
.pos-cat:hover { background: #EEF6FD; }
.pos-cat.on { background: #E3F0FC; border-color: #9CC8F0; border-bottom-color: #0B6BCB; color: #0F2A4A; }
.pos-cat-img { width: 52px; height: 52px; border-radius: 50%; overflow: hidden; object-fit: cover; background: #E3F0FC; display: flex; align-items: center; justify-content: center; color: #0B6BCB; }

.pc-grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(196px, 1fr)); }
.pc { display: flex; flex-direction: column; width: 100%; min-width: 0; padding: 0; text-align: left; background: #FFFFFF; border: 1px solid #DCEAF8; border-radius: 16px; overflow: hidden; transition: border-color .18s, box-shadow .18s; }
.pc:hover { border-color: #9CC8F0; box-shadow: 0 10px 26px rgba(15,42,74,.1); }
.pc.has { border-color: #0B6BCB; }
.pc:focus-visible { outline-offset: 2px; }
.pc-media { position: relative; width: 100%; aspect-ratio: 5 / 4; background: #E3F0FC; overflow: hidden; }
.pc-img { width: 100%; height: 100%; object-fit: cover; transition: transform .35s cubic-bezier(.2,.8,.2,1); }
.pc:hover .pc-img { transform: scale(1.04); }
.pc-tag { position: absolute; left: 8px; bottom: 8px; padding: 2px 8px; border-radius: 7px; background: rgba(255,255,255,.94); color: #3D5673; font-size: 11px; font-weight: 700; }
.pc-tag.low { background: #FAEDD2; color: #8A5506; }
.pc-count { position: absolute; top: 8px; right: 8px; display: flex; align-items: center; justify-content: center; min-width: 26px; height: 26px; padding: 0 7px; border-radius: 13px; background: #0B6BCB; color: #FFFFFF; font-size: 12.5px; font-weight: 800; box-shadow: 0 2px 8px rgba(15,42,74,.3); }
.pc-info { flex: 1; display: flex; flex-direction: column; gap: 10px; width: 100%; padding: 12px 14px 13px; }
.pc-name { font-size: 14.5px; font-weight: 800; line-height: 1.25; color: #0F2A4A; }
.pc-foot { margin-top: auto; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.pc-price { font-size: 16px; font-weight: 700; color: #0F2A4A; font-variant-numeric: tabular-nums; }
.pc-price small { display: block; font-size: 11px; font-weight: 600; color: #5F748C; }
.pc-add { flex: none; display: inline-flex; align-items: center; gap: 5px; height: 32px; padding: 0 11px; border-radius: 999px; background: #fff; box-shadow: 0 1px 6px rgba(15,42,74,.14); color: #0B6BCB; font-size: 12.5px; font-weight: 800; transition: background .15s, color .15s; }
.pc:hover .pc-add { background: #0B6BCB; color: #FFFFFF; }

.pos-side { display: flex; flex-direction: column; gap: 12px; padding: 16px; background: #FFFFFF; border: 1px solid #DCEAF8; border-radius: 16px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #CFE2F5 transparent; }
.pos-type { padding: 11px 12px 12px; border: 1px solid #CFE2F5; border-radius: 12px; }
.pos-type-title { display: block; margin-bottom: 8px; font-size: 13px; font-weight: 700; }
.pos-types { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.pp-radio { display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 6px 10px; text-align: left; background: #F3F8FD; border: 1px solid transparent; border-radius: 10px; font-size: 13px; font-weight: 600; line-height: 1.2; color: #0F2A4A; transition: background .15s, border-color .15s; }
.pp-radio:hover { background: #E3F0FC; }
.pp-radio::before { content: ''; flex: none; width: 16px; height: 16px; border-radius: 50%; border: 1.5px solid #B4C9DE; background: #fff; transition: border .15s; }
.pp-radio.on { background: #E3F0FC; border-color: #0B6BCB; }
.pp-radio.on::before { border: 5px solid #0B6BCB; }
.pp-radio.check::before { border-radius: 5px; }
.pp-radio.check.on::before { border: 0; background: #0B6BCB url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M4 8.2l2.7 2.7L12 5.4' fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/100% no-repeat; }
.pp-radio-text { min-width: 0; flex: 1; }
.pp-radio-price { display: block; margin-top: 1px; font-size: 12px; font-weight: 700; color: #0B6BCB; font-variant-numeric: tabular-nums; }

.pos-table-head, .pos-line-top { display: grid; grid-template-columns: minmax(0, 1fr) 92px 70px; gap: 6px; align-items: center; }
.pos-table-head { padding: 7px 10px; border-radius: 8px; background: #E3F0FC; font-size: 12.5px; font-weight: 700; color: #3D5673; }
.pos-table-head span:nth-child(2) { text-align: center; }
.pos-table-head span:last-child, .pos-line-total { text-align: right; }
.pos-lines { flex: 1 1 auto; min-height: 150px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #CFE2F5 transparent; }
.pos-empty { padding: 26px 0; text-align: center; color: #5F748C; font-size: 13.5px; }
.pos-line { padding: 10px; border-bottom: 1px solid #E6F0FA; }
.pos-line:last-child { border-bottom: 0; }
.pos-line-name { font-size: 13.5px; font-weight: 700; line-height: 1.25; }
.pos-line-total { font-size: 13.5px; font-weight: 800; font-variant-numeric: tabular-nums; }
.pos-line .qty { justify-self: center; }
.pos-rows { margin-top: 6px; display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: #5F748C; }
.pos-row { display: flex; justify-content: space-between; gap: 10px; }
.pos-row span:last-child { flex: none; font-variant-numeric: tabular-nums; }
.pos-line-actions { display: flex; gap: 12px; margin-top: 6px; }
.pos-line-action { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; color: #0B6BCB; }
.pos-line-action:hover { text-decoration: underline; text-underline-offset: 2px; }
.pos-totals { padding-top: 8px; border-top: 1px solid #CFE2F5; font-size: 13.5px; }
.pos-total-row { display: flex; justify-content: space-between; padding: 3px 0; color: #3D5673; font-variant-numeric: tabular-nums; }
.pos-discount { padding: 8px 0 6px; }
.pos-total-row.big { margin-top: 2px; font-size: 19px; font-weight: 800; color: #0F2A4A; }
.pos-type-note { margin-top: 8px; font-size: 12.5px; line-height: 1.4; color: #8A5506; }
.pp-radio:disabled { opacity: .5; cursor: not-allowed; }
.pos-sug { position: relative; }
.pos-sug-list { position: absolute; z-index: 30; top: calc(100% + 4px); left: 0; width: max(100%, 250px); max-height: 232px; margin: 0; padding: 4px; overflow-y: auto; list-style: none; background: #fff; border: 1px solid #CFE2F5; border-radius: 12px; box-shadow: 0 12px 30px rgba(15,42,74,.18); }
.pos-sug-item { display: block; width: 100%; padding: 7px 10px; border-radius: 8px; cursor: pointer; text-align: left; }
.pos-sug-item.on, .pos-sug-item:hover { background: #E3F0FC; }
.pos-sug-name { display: block; font-size: 13.5px; font-weight: 700; color: #0F2A4A; overflow-wrap: anywhere; }
.pos-sug-info { display: block; margin-top: 1px; font-size: 12px; color: #3D5673; overflow-wrap: anywhere; }

.pp { position: fixed; inset: 0; z-index: 95; display: flex; align-items: center; justify-content: center; padding: 16px; }
.pp-scrim { position: absolute; inset: 0; background: rgba(15,42,74,.38); backdrop-filter: blur(3px); animation: pp-fade .18s ease-out; }
.pp-box { position: relative; display: flex; flex-direction: column; width: min(640px, 100%); max-height: min(88vh, 760px); background: #FFFFFF; border-radius: 18px; box-shadow: 0 24px 60px rgba(15,42,74,.3); overflow: hidden; outline: none; animation: pp-rise .22s cubic-bezier(.2,.85,.25,1); }
.pp.closing .pp-scrim { animation: pp-fade .13s ease-in reverse forwards; }
.pp.closing .pp-box { animation: pp-sink .13s ease-in forwards; }
@keyframes pp-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes pp-rise { from { opacity: 0; transform: translateY(14px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes pp-sink { to { opacity: 0; transform: translateY(8px) scale(.98); } }
.pp-head { display: flex; align-items: flex-start; gap: 14px; padding: 16px 14px 14px 18px; border-bottom: 1px solid #DCEAF8; }
.pp-thumb { flex: none; width: 84px; height: 84px; border-radius: 13px; overflow: hidden; object-fit: cover; background: #E3F0FC; }
.pp-head-text { flex: 1; min-width: 0; }
.pp-title { font-family: 'Manrope', system-ui, sans-serif; font-size: 17px; font-weight: 800; line-height: 1.25; color: #0F2A4A; }
.pp-desc { margin-top: 3px; font-size: 12.5px; line-height: 1.4; color: #5F748C; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.pp-each { margin-top: 5px; font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; }
.pp-close { flex: none; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%; color: #5F748C; transition: background .15s, color .15s; }
.pp-close:hover { background: #E3F0FC; color: #0B6BCB; }
.pp-body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 14px 18px; display: flex; flex-direction: column; gap: 14px; scrollbar-width: thin; scrollbar-color: #CFE2F5 transparent; }
.pp-qty { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 600; }
.pp-label { display: block; margin-bottom: 7px; font-size: 14px; font-weight: 700; color: #0F2A4A; }
.pp-grid { display: grid; gap: 7px; grid-template-columns: repeat(auto-fill, minmax(168px, 1fr)); }
.pp-input { display: block; width: 100%; padding: 8px 12px; border: 1px solid #CFE2F5; border-radius: 10px; background: #fff; font-size: 13.5px; transition: border-color .15s, box-shadow .15s; resize: vertical; }
.pp-input:focus { outline: none; border-color: #0B6BCB; box-shadow: 0 0 0 3px rgba(11,107,203,.1); }
.pp-foot { padding: 12px 18px 14px; border-top: 1px solid #DCEAF8; background: #F3F8FD; }
.pp-add { width: 100%; min-height: 48px; font-size: 15px; font-variant-numeric: tabular-nums; }
.pp-foot-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 10px; }

@media (max-width: 560px) {
  .pp { align-items: flex-end; padding: 0; }
  .pp-box { width: 100%; max-height: 90vh; border-radius: 18px 18px 0 0; }
  .pp-thumb { width: 64px; height: 64px; }
  .pp-input { font-size: 16px; }
  .pc-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .pos-cat { width: 96px; }
}
@media (prefers-reduced-motion: reduce) {
  .pp-scrim, .pp-box, .pp.closing .pp-scrim, .pp.closing .pp-box { animation-duration: .01ms; }
  .pos-cats { scroll-behavior: auto; }
  .pc-img { transition: none; } .pc:hover .pc-img { transform: none; }
}
`;

// Shared popup frame: smooth open and close, Esc to close, and a footer that stays in view
function Popup({ label, head, footer, onClose, children }) {
  const [closing, setClosing] = useState(false);
  const box = useRef(null);
  const leave = (done) => {
    if (closing) return;
    setClosing(true);
    setTimeout(done, 130);
  };
  const close = () => leave(onClose);
  useEffect(() => {
    box.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });
  return (
    <div
      className={cn("pp", closing && "closing")}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div className="pp-scrim" onClick={close} />
      <div className="pp-box" ref={box} tabIndex={-1}>
        <header className="pp-head">
          <div className="pp-head-text flex-1">{head}</div>
          <button
            type="button"
            className="pp-close"
            onClick={close}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>
        <div className="pp-body">{children}</div>
        <footer className="pp-foot">{footer(leave)}</footer>
      </div>
    </div>
  );
}

function Choice({
  on,
  check,
  price,
  currency,
  plus = true,
  onClick,
  children,
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={cn("pp-radio", check && "check", on && "on")}
      onClick={onClick}
    >
      <span className="pp-radio-text">
        {children}
        {price > 0 && (
          <span className="pp-radio-price">
            {plus ? "+" : ""}
            {money(price, currency)}
          </span>
        )}
      </span>
    </button>
  );
}

// Size, quantity, cake options and add-ons for one line of the sale
function CakeOptionsModal({
  editing,
  cakeOptions,
  currency,
  maxQty,
  onSave,
  onClose,
}) {
  const { product, line } = editing;
  const first = (list, chosen) =>
    list?.some((o) => o.name === chosen) ? chosen : list?.[0]?.name || "";
  const [variantKey, setVariantKey] = useState(
    line?.variant || editing.variant,
  );
  const [qty, setQty] = useState(line?.qty || 1);
  const [options, setOptions] = useState(() => ({
    sponge: first(
      cakeOptions?.sponges,
      line?.options?.sponge ?? product.defaults?.sponge,
    ),
    filling: first(
      cakeOptions?.fillings,
      line?.options?.filling ?? product.defaults?.filling,
    ),
    finish: first(
      cakeOptions?.finishes,
      line?.options?.finish ?? product.defaults?.finish,
    ),
    addons: line?.options?.addons || [],
    message: line?.options?.message || "",
    instructions: line?.options?.instructions || "",
    vegan: Boolean(line?.options?.vegan),
    glutenFree: Boolean(line?.options?.glutenFree),
    referenceImages: line?.options?.referenceImages || [],
  }));
  const [uploading, setUploading] = useState(false);
  const set = (patch) => setOptions((current) => ({ ...current, ...patch }));
  const toggleAddon = (name) =>
    set({
      addons: options.addons.includes(name)
        ? options.addons.filter((a) => a !== name)
        : [...options.addons, name],
    });
  const variant =
    product.variants.find((v) => v.key === variantKey) || product.variants[0];

  // Only send what applies to this product and size
  const veganOk = canUpgrade(product, variant, "vegan");
  const gfOk = canUpgrade(product, variant, "glutenFree");
  const clean = {
    ...(product.customisable
      ? {
          sponge: options.sponge || undefined,
          filling: options.filling || undefined,
          finish: options.finish || undefined,
          addons: options.addons,
          message: options.message.trim(),
          ...(options.referenceImages.length
            ? { referenceImages: options.referenceImages }
            : {}),
        }
      : {}),
    instructions: options.instructions.trim(),
    ...(veganOk && options.vegan ? { vegan: true } : {}),
    ...(gfOk && options.glutenFree ? { glutenFree: true } : {}),
  };
  const price = unitPrice(product, variant, clean, cakeOptions);

  const single = (label, list, field) =>
    list?.length > 0 && (
      <div>
        <span className="pp-label">{label}</span>
        <div className="pp-grid">
          {list.map((o) => (
            <Choice
              key={o.name}
              on={options[field] === o.name}
              price={o.price}
              currency={currency}
              onClick={() => set({ [field]: o.name })}
            >
              {o.name}
            </Choice>
          ))}
        </div>
      </div>
    );

  return (
    <Popup
      label={product.name}
      onClose={onClose}
      head={
        <div className="flex gap-3.5">
          <ProductImage
            src={product.images?.[0]?.url}
            alt=""
            name=""
            category={product.category}
            className="pp-thumb"
          />
          <div className="min-w-0 flex-1">
            <h3 className="pp-title">{product.name}</h3>
            {product.description && (
              <p className="pp-desc">{product.description}</p>
            )}
            <p className="pp-each">{money(price, currency)}</p>
          </div>
        </div>
      }
      footer={(leave) => (
        <button
          type="button"
          className="btn btn-p pp-add"
          disabled={uploading}
          onClick={() => leave(() => onSave(variant, clean, price, qty))}
        >
          {line ? "Update sale" : "Add to sale"} -{" "}
          {money(price * qty, currency)}
        </button>
      )}
    >
      <div className="pp-qty">
        Quantity{" "}
        <Qty small value={qty} max={Math.max(1, maxQty)} onChange={setQty} />
      </div>
      {product.variants.length > 1 && (
        <div>
          <span className="pp-label">Size</span>
          <div className="pp-grid">
            {product.variants.map((v) => (
              <Choice
                key={v.key}
                on={v.key === variant.key}
                price={v.price}
                plus={false}
                currency={currency}
                onClick={() => setVariantKey(v.key)}
              >
                {sizeLabel(v.key)}
              </Choice>
            ))}
          </div>
        </div>
      )}
      {(veganOk || gfOk) && (
        <div>
          <span className="pp-label">Dietary</span>
          <div className="pp-grid">
            {veganOk && (
              <Choice
                check
                on={options.vegan}
                price={variant.veganUpcharge}
                currency={currency}
                onClick={() => set({ vegan: !options.vegan })}
              >
                Vegan
              </Choice>
            )}
            {gfOk && (
              <Choice
                check
                on={options.glutenFree}
                price={variant.gfUpcharge}
                currency={currency}
                onClick={() => set({ glutenFree: !options.glutenFree })}
              >
                Gluten-free
              </Choice>
            )}
          </div>
        </div>
      )}
      {product.customisable && (
        <>
          {single("Sponge", cakeOptions?.sponges, "sponge")}
          {single("Filling", cakeOptions?.fillings, "filling")}
          {single("Finish & decoration", cakeOptions?.finishes, "finish")}
          {cakeOptions?.addons?.length > 0 && (
            <div>
              <span className="pp-label">Add-ons</span>
              <div className="pp-grid">
                {cakeOptions.addons.map((a) => (
                  <Choice
                    key={a.name}
                    check
                    on={options.addons.includes(a.name)}
                    price={a.price}
                    currency={currency}
                    onClick={() => toggleAddon(a.name)}
                  >
                    {a.name}
                  </Choice>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="pp-label" htmlFor="pos-message">
              Message on the cake
            </label>
            <input
              id="pos-message"
              className="pp-input"
              placeholder="Happy Birthday Aarav"
              maxLength={Math.min(cakeOptions?.maxMessageLength || 40, 80)}
              value={options.message}
              onChange={(e) => set({ message: e.target.value })}
            />
          </div>
          <ReferenceImagesInput
            id="pos-ref-photos"
            value={options.referenceImages}
            onChange={(referenceImages) => set({ referenceImages })}
            onBusy={setUploading}
          />
        </>
      )}
      <div>
        <label className="pp-label" htmlFor="pos-notes">
          Special instructions
        </label>
        <textarea
          id="pos-notes"
          className="pp-input"
          rows={2}
          placeholder="Colours, allergies, anything the bakers should know"
          maxLength={500}
          value={options.instructions}
          onChange={(e) => set({ instructions: e.target.value })}
        />
      </div>
    </Popup>
  );
}

// A name or phone box that suggests past customers while typing
function CustomerInput({ id, value, onPick, ...inputProps }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const focused = useRef(false);
  const justPicked = useRef(false);

  useEffect(() => {
    const q = value.trim();
    if (!focused.current || justPicked.current || q.length < 2) {
      setItems([]);
      setOpen(false);
      return undefined;
    }
    let current = true;
    const timer = setTimeout(() => {
      api
        .get("/admin/pos/customers", { params: { q } })
        .then(({ data }) => {
          if (!current || !focused.current) return;
          setItems(data.items);
          setActive(-1);
          setOpen(data.items.length > 0);
        })
        .catch(() => {});
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [value]);

  const pick = (customer) => {
    justPicked.current = true;
    setOpen(false);
    onPick(customer);
  };
  const onKeyDown = (e) => {
    if (!open) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (a + step + items.length) % items.length);
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
    }
  };
  const listId = `${id}-suggestions`;

  return (
    <div className="pos-sug">
      <input
        {...inputProps}
        id={id}
        value={value}
        onChange={(e) => {
          justPicked.current = false;
          inputProps.onChange(e);
        }}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={(e) => {
          focused.current = false;
          setOpen(false);
          inputProps.onBlur?.(e);
        }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul className="pos-sug-list" id={listId} role="listbox">
          {items.map((c, i) => (
            <li
              key={`${c.phone}-${c.email}-${i}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={cn("pos-sug-item", i === active && "on")}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(c);
              }}
            >
              <span className="pos-sug-name">{c.name}</span>
              <span className="pos-sug-info">
                {[
                  c.phone,
                  c.email,
                  c.orders
                    ? `${c.orders} order${c.orders === 1 ? "" : "s"}`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// The customer form for every POS order. Dine-in is paid now and has no pickup time.
// Notice period in words, e.g. "5 days" or "4 hours"
const noticeText = (hours) =>
  hours >= 24
    ? `${Math.ceil(hours / 24)} day${Math.ceil(hours / 24) === 1 ? "" : "s"}`
    : `${hours} hour${hours === 1 ? "" : "s"}`;

function SendToProductionModal({
  dineIn,
  leadHours = 0,
  total,
  discountBody = {},
  saleKey,
  items,
  currency,
  settings,
  onDone,
  onClose,
}) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    source: "In store",
    notes: "",
    payment: "none",
    method: "cash",
    deposit: "",
    cash: "",
  });
  const [date, setDate] = useState(todayISO());
  const [slots, setSlots] = useState(null);
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState({});
  const [tried, setTried] = useState(false);
  const set = (patch) => setForm((current) => ({ ...current, ...patch }));
  const touch = (field) => () =>
    setTouched((current) => ({ ...current, [field]: true }));

  const [earliest, setEarliest] = useState("");

  // Start on the first day with pickup times left, after any notice the cakes need
  useEffect(() => {
    if (dineIn) return;
    api
      .get("/availability", { params: { days: 30, leadHours } })
      .then(({ data }) => {
        const next = data.dates?.find((d) => d.available);
        if (next) {
          setDate(next.date);
          setEarliest(next.date);
        }
      })
      .catch(() => {});
  }, [dineIn, leadHours]);
  useEffect(() => {
    if (dineIn) return;
    setSlots(null);
    setTime("");
    if (date)
      api
        .get("/availability", { params: { date, leadHours } })
        .then(({ data }) => setSlots(data.slots))
        .catch(() => setSlots([]));
  }, [date, dineIn, leadHours]);

  const open = (slots || []).filter((s) => s.available);
  const emptyLabel =
    slots === null
      ? "Loading…"
      : !slots.length
        ? "Closed this day"
        : "No times left on this day";
  const deposit = Number(form.deposit) || 0;
  const paidNow = dineIn
    ? total
    : form.payment === "full"
      ? total
      : form.payment === "deposit"
        ? deposit
        : 0;
  const depositBad =
    !dineIn && form.payment === "deposit" && (deposit <= 0 || deposit >= total);
  const cash = form.cash === "" ? null : Number(form.cash);
  const cashShort =
    dineIn && form.method === "cash" && cash != null && cash < total;
  const percent = settings?.payments?.depositPercent;
  const problems = {
    name: form.name.trim().length < 2 ? "Enter the customer's name." : "",
    phone: !form.phone.trim()
      ? "Enter a phone number."
      : !validPhone(form.phone.trim())
        ? "Enter a 10-digit phone number."
        : "",
    email:
      form.email.trim() && !validEmail(form.email.trim())
        ? "Enter a valid email, like name@example.com."
        : "",
    time: !dineIn && !time ? "Choose a pickup time." : "",
  };
  const showProblem = (field) =>
    tried || touched[field] ? problems[field] : "";
  const hasProblem =
    Object.values(problems).some(Boolean) || depositBad || cashShort;
  const pickCustomer = (customer) => {
    set({
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
    });
    setTouched((current) => ({ ...current, name: true, phone: true }));
  };

  const submit = async () => {
    setTried(true);
    if (hasProblem || busy) return;
    setBusy(true);
    setError("");
    try {
      const customer = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
      };
      const { data } = dineIn
        ? await api.post("/admin/pos/sales", {
            idempotencyKey: saleKey,
            items,
            customer,
            notes: form.notes,
            paymentMethod: form.method,
            ...discountBody,
            ...(form.method === "cash" && cash != null
              ? { cashTendered: cash }
              : {}),
          })
        : await api.post("/admin/pos/orders", {
            idempotencyKey: saleKey,
            items,
            customer,
            pickupDate: date,
            pickupTime: time,
            notes: form.notes,
            source: form.source,
            payment: form.payment,
            ...(form.payment !== "none" ? { paymentMethod: form.method } : {}),
            ...(form.payment === "deposit" ? { depositAmount: deposit } : {}),
            ...discountBody,
          });
      onDone(data.order, dineIn && form.method === "cash" ? cash : null);
    } catch (e) {
      const ae = apiError(e);
      setError(
        ae.issues?.[0]?.message || Object.values(ae.fields)[0] || ae.message,
      );
      setBusy(false);
    }
  };

  return (
    <Popup
      label={dineIn ? "Dine-in order" : "Take away order"}
      onClose={busy ? () => {} : onClose}
      head={
        <h3 className="pp-title">
          {dineIn ? "Dine-in order" : "Take away order"}
        </h3>
      }
      footer={(leave) => (
        <div className="pp-foot-row">
          <span className="mr-auto text-sm">
            Total <b className="num">{money(total, currency)}</b>, balance{" "}
            <b className="num">
              {money(Math.max(0, total - paidNow), currency)}
            </b>
          </span>
          <button
            className="btn btn-o"
            onClick={() => leave(onClose)}
            disabled={busy}
          >
            Cancel
          </button>
          <button className="btn btn-p" disabled={busy} onClick={submit}>
            {busy ? <Spinner /> : <ChefHat size={17} />} Confirm Order
          </button>
        </div>
      )}
    >
      <div className="flex flex-col gap-5">
        {error && (
          <p className="errbox" role="alert">
            {error}
          </p>
        )}
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
          <Field
            label="Customer name"
            htmlFor="po-name"
            error={showProblem("name")}
          >
            <CustomerInput
              id="po-name"
              className={cn("in", showProblem("name") && "err")}
              maxLength={120}
              autoComplete="off"
              value={form.name}
              onBlur={touch("name")}
              onChange={(e) => set({ name: e.target.value })}
              onPick={pickCustomer}
            />
          </Field>
          <Field label="Phone" htmlFor="po-phone" error={showProblem("phone")}>
            <CustomerInput
              id="po-phone"
              type="tel"
              inputMode="numeric"
              className={cn("in", showProblem("phone") && "err")}
              maxLength={10}
              placeholder="0400000000"
              autoComplete="off"
              value={form.phone}
              onBlur={touch("phone")}
              onChange={(e) =>
                set({ phone: e.target.value.replace(/\D/g, "").slice(0, 10) })
              }
              onPick={pickCustomer}
            />
          </Field>
          <Field
            label="Email (optional)"
            htmlFor="po-email"
            error={showProblem("email")}
          >
            <input
              id="po-email"
              type="email"
              className={cn("in", showProblem("email") && "err")}
              maxLength={160}
              autoComplete="off"
              value={form.email}
              onBlur={touch("email")}
              onChange={(e) => set({ email: e.target.value })}
            />
          </Field>
          {!dineIn && (
            <>
              <Field
                label="Pickup date"
                htmlFor="po-date"
                help={
                  leadHours > 0 && earliest
                    ? `Needs ${noticeText(leadHours)} notice. Earliest ${fmtLong(earliest)}.`
                    : ""
                }
              >
                <input
                  id="po-date"
                  type="date"
                  min={earliest || todayISO()}
                  className="in"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <Field
                label="Pickup time"
                htmlFor="po-time"
                error={showProblem("time")}
              >
                <select
                  id="po-time"
                  className={cn("in", showProblem("time") && "err")}
                  value={time}
                  onBlur={touch("time")}
                  onChange={(e) => setTime(e.target.value)}
                >
                  <option value="">
                    {open.length ? "Choose…" : emptyLabel}
                  </option>
                  {open.map((s) => (
                    <option key={s.time} value={s.time}>
                      {t12(s.time)} · {s.remaining} left
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Source" htmlFor="po-source">
                <select
                  id="po-source"
                  className="in"
                  value={form.source}
                  onChange={(e) => set({ source: e.target.value })}
                >
                  <option>In store</option>
                  <option>Phone</option>
                </select>
              </Field>
            </>
          )}
        </div>
        <Field label="Notes (optional)" htmlFor="po-notes">
          <textarea
            id="po-notes"
            className="in !min-h-[70px]"
            maxLength={1000}
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value })}
          />
        </Field>
        {!dineIn && (
          <div>
            <span className="lbl">Payment</span>
            <div className="seggrp">
              {[
                ["none", "Pay at pickup"],
                ["full", "Paid in full"],
                ["deposit", "Deposit"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={form.payment === id}
                  className={cn("seg", form.payment === id && "on")}
                  onClick={() => set({ payment: id })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        {(dineIn || form.payment !== "none") && (
          <div className="flex flex-wrap items-start gap-4">
            <div>
              <span className="lbl">Paid by</span>
              <div className="seggrp">
                {METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={form.method === m.id}
                    className={cn("seg", form.method === m.id && "on")}
                    onClick={() => set({ method: m.id })}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            {dineIn && form.method === "cash" && (
              <Field
                label="Cash received (optional)"
                htmlFor="po-cash"
                className="min-w-[200px]"
                error={cashShort ? "This is less than the total." : ""}
                help={
                  cash != null && !cashShort
                    ? `Change: ${money(cash - total, currency)}`
                    : ""
                }
              >
                <input
                  id="po-cash"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.05"
                  className={cn("in", cashShort && "err")}
                  value={form.cash}
                  onChange={(e) => set({ cash: e.target.value })}
                />
              </Field>
            )}
            {!dineIn && form.payment === "deposit" && (
              <Field
                label="Deposit received"
                htmlFor="po-deposit"
                className="min-w-[200px]"
                error={
                  form.deposit !== "" && depositBad
                    ? "Enter an amount less than the total."
                    : ""
                }
                help={
                  percent
                    ? `${percent}% would be ${money((total * percent) / 100, currency)}`
                    : ""
                }
              >
                <input
                  id="po-deposit"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.05"
                  className={cn(
                    "in",
                    form.deposit !== "" && depositBad && "err",
                  )}
                  value={form.deposit}
                  onChange={(e) => set({ deposit: e.target.value })}
                />
              </Field>
            )}
          </div>
        )}
      </div>
    </Popup>
  );
}

export default function Pos() {
  const { settings, categories } = useSettings();
  const currency = settings?.currency;
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [cart, setCart] = useState([]);
  const [lastSale, setLastSale] = useState(null);
  const [editing, setEditing] = useState(null);
  const [sending, setSending] = useState(false);
  const [orderType, setOrderType] = useState("now");
  const [discount, setDiscountState] = useState({ mode: "%", value: "" });
  // One key per sale. It survives a retry of the same cart, so a lost response can't charge twice.
  const saleKey = useRef(uid());
  const catsRef = useRef(null);
  const [catArrows, setCatArrows] = useState({ left: false, right: false });

  const updateCatArrows = useCallback(() => {
    const el = catsRef.current;
    if (!el) return;
    setCatArrows({
      left: el.scrollLeft > 2,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
    });
  }, []);
  const scrollCats = (direction) => {
    const el = catsRef.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.75 });
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const { data } = await api.get("/admin/pos/products");
      setProducts(data.items);
    } catch (e) {
      setLoadError(apiError(e).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) =>
        (category === "all" || p.category === category) &&
        (!q || p.name.toLowerCase().includes(q)),
    );
  }, [products, category, search]);

  const total = useMemo(
    () =>
      Math.round(cart.reduce((sum, l) => sum + l.price * l.qty, 0) * 100) / 100,
    [cart],
  );

  const changeCart = (next) => {
    saleKey.current = uid();
    setCart(next);
  };
  // How many more of a product this line can hold, counting the other lines in the sale
  const stockLeft = (p, lineId) =>
    p.stockQty == null
      ? 50
      : Math.min(
          50,
          p.stockQty -
            cart
              .filter((l) => l.productId === p._id && l.id !== lineId)
              .reduce((sum, l) => sum + l.qty, 0),
        );

  const add = (p, v) => {
    if (needsOptions(p)) {
      if (stockLeft(p, null) < 1) {
        toast.error(`No more ${p.name} available.`);
        return;
      }
      setEditing({ product: p, variant: v.key, line: null });
      return;
    }
    const line = cart.find((l) => l.productId === p._id && l.variant === v.key);
    const max = stockLeft(p, line?.id);
    if ((line?.qty || 0) >= max) {
      toast.error(`Only ${max} × ${p.name} available.`);
      return;
    }
    if (line)
      changeCart(cart.map((l) => (l === line ? { ...l, qty: l.qty + 1 } : l)));
    else
      changeCart([
        ...cart,
        {
          id: uid(),
          productId: p._id,
          variant: v.key,
          name: p.name,
          price: v.price,
          qty: 1,
          options: {},
          priceBreakdown: buildBreakdown(p, v, {}, settings?.cakeOptions),
        },
      ]);
  };
  const saveOptions = (variant, options, price, qty) => {
    const { product, line } = editing;
    const priceBreakdown = buildBreakdown(
      product,
      variant,
      options,
      settings?.cakeOptions,
    );
    if (line) {
      changeCart(
        cart.map((l) =>
          l.id === line.id
            ? {
                ...l,
                variant: variant.key,
                options,
                price,
                qty,
                priceBreakdown,
              }
            : l,
        ),
      );
    } else {
      // The same item with the same choices just adds to its existing line
      const same = cart.find(
        (l) =>
          l.productId === product._id &&
          l.variant === variant.key &&
          JSON.stringify(l.options) === JSON.stringify(options),
      );
      if (same)
        changeCart(
          cart.map((l) =>
            l === same ? { ...l, qty: Math.min(50, l.qty + qty) } : l,
          ),
        );
      else
        changeCart([
          ...cart,
          {
            id: uid(),
            productId: product._id,
            variant: variant.key,
            name: product.name,
            price,
            qty,
            options,
            priceBreakdown,
            custom: true,
          },
        ]);
    }
    setEditing(null);
  };
  const setQty = (line, qty) =>
    changeCart(cart.map((l) => (l === line ? { ...l, qty } : l)));
  const remove = (line) => changeCart(cart.filter((l) => l !== line));
  const resetSale = () => {
    saleKey.current = uid();
    setCart([]);
    setDiscountState({ mode: "%", value: "" });
    setOrderType("now");
  };

  const orderDone = (order, tendered = null) => {
    setLastSale({ order, tendered });
    toast.success(`Order ${order.orderNumber} placed successfully`);
    setSending(false);
    resetSale();
    load();
  };
  const serviceFee = settings?.fees?.serviceFee || 0;

  // Custom cakes have to be baked, so they always need a pickup date and their notice period
  const aheadProducts = [
    ...new Set(
      cart
        .map((l) => products.find((p) => p._id === l.productId))
        .filter((p) => p?.needsMaking),
    ),
  ];
  const mustOrderAhead = aheadProducts.length > 0;
  const makeLead = Math.max(0, ...aheadProducts.map((p) => p.leadHours || 0));
  const aheadNames = aheadProducts.map((p) => p.name).join(", ");
  useEffect(() => {
    if (mustOrderAhead) setOrderType("production");
  }, [mustOrderAhead]);
  const toMake = orderType === "production";
  const shownTotal = toMake
    ? Math.round((total + serviceFee) * 100) / 100
    : total;
  // A changed discount is a different sale, so it gets a new key
  const setDiscount = (next) => {
    saleKey.current = uid();
    setDiscountState(next);
  };
  const discountOff = discountAmount(shownTotal, discount);
  const discountBad = Boolean(discountError(shownTotal, discount));
  const finalTotal = Math.round((shownTotal - discountOff) * 100) / 100;
  const shownCategories = (categories || []).filter((c) =>
    products.some((p) => p.category === c.id),
  );
  const editingProduct = editing?.product;

  // Keep the arrows right when the screen size or category list changes
  useEffect(() => {
    updateCatArrows();
    window.addEventListener("resize", updateCatArrows);
    return () => window.removeEventListener("resize", updateCatArrows);
  }, [updateCatArrows, shownCategories.length]);

  return (
    <div className="pos-layout">
      <style>{POS_CSS}</style>
      {sending && (
        <SendToProductionModal
          dineIn={!toMake}
          leadHours={toMake ? makeLead : 0}
          total={finalTotal}
          discountBody={discountPayload(shownTotal, discount)}
          saleKey={saleKey.current}
          items={cart.map(({ id, productId, variant, qty, options }) => ({
            id,
            productId,
            variant,
            qty,
            options,
          }))}
          currency={currency}
          settings={settings}
          onDone={orderDone}
          onClose={() => setSending(false)}
        />
      )}
      {editing && (
        <CakeOptionsModal
          editing={editing}
          cakeOptions={settings?.cakeOptions}
          currency={currency}
          maxQty={stockLeft(editingProduct, editing.line?.id)}
          onSave={saveOptions}
          onClose={() => setEditing(null)}
        />
      )}

      <section className="flex min-w-0 flex-col gap-4">
        <div className="pos-search">
          <div className="pos-searchbox">
            <label className="sr-only" htmlFor="pos-search">
              Search products
            </label>
            <input
              id="pos-search"
              placeholder="Search by product name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="pos-searchicon" aria-hidden="true">
              <Search size={19} />
            </span>
          </div>
          <button
            type="button"
            className="pos-refresh"
            onClick={load}
            disabled={loading}
            aria-label="Refresh products"
            title="Refresh products"
          >
            <RefreshCw size={17} />
          </button>
        </div>

        <div className="pos-cats-wrap">
          {(catArrows.left || catArrows.right) && (
            <button
              type="button"
              className="pos-arrow"
              onClick={() => scrollCats(-1)}
              disabled={!catArrows.left}
              aria-label="Show previous categories"
            >
              <ChevronLeft size={19} aria-hidden="true" />
            </button>
          )}
          <div
            className="pos-cats"
            role="tablist"
            aria-label="Category"
            ref={catsRef}
            onScroll={updateCatArrows}
          >
            <button
              type="button"
              role="tab"
              aria-selected={category === "all"}
              className={cn("pos-cat", category === "all" && "on")}
              onClick={() => setCategory("all")}
            >
              <span className="pos-cat-img">
                <LayoutGrid size={23} aria-hidden="true" />
              </span>
              All items
            </button>
            {shownCategories.map((c) => {
              const sample =
                products.find(
                  (p) => p.category === c.id && p.images?.[0]?.url,
                ) || products.find((p) => p.category === c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={category === c.id}
                  className={cn("pos-cat", category === c.id && "on")}
                  onClick={() => setCategory(c.id)}
                >
                  <ProductImage
                    src={sample?.images?.[0]?.url}
                    alt=""
                    name=""
                    category={c.id}
                    className="pos-cat-img"
                  />
                  {c.name}
                </button>
              );
            })}
          </div>
          {(catArrows.left || catArrows.right) && (
            <button
              type="button"
              className="pos-arrow"
              onClick={() => scrollCats(1)}
              disabled={!catArrows.right}
              aria-label="Show more categories"
            >
              <ChevronRight size={19} aria-hidden="true" />
            </button>
          )}
        </div>

        {loading && !products.length ? (
          <PageLoader label="Loading products…" />
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={load} />
        ) : !visible.length ? (
          <EmptyState title="No products to sell">
            Check the search, or make sure products are available in Products &
            Inventory.
          </EmptyState>
        ) : (
          <div className="pc-grid">
            {visible.map((p) => {
              const inSale = cart.reduce(
                (sum, l) => (l.productId === p._id ? sum + l.qty : sum),
                0,
              );
              const tag =
                p.stockQty != null
                  ? `${p.stockQty} in stock`
                  : p.stockStatus === "Made to order"
                    ? "Made to order"
                    : p.stockStatus === "Low stock"
                      ? "Low stock"
                      : "";
              const from = Math.min(...p.variants.map((v) => v.price));
              return (
                <button
                  key={p._id}
                  type="button"
                  className={cn("pc", inSale > 0 && "has")}
                  onClick={() => add(p, p.variants[0])}
                  aria-label={`Add ${p.name}, ${money(from, currency)}`}
                >
                  <span className="pc-media">
                    <ProductImage
                      src={p.images?.[0]?.url}
                      alt=""
                      name={p.name}
                      category={p.category}
                      className="pc-img"
                    />
                    {tag && (
                      <span
                        className={cn(
                          "pc-tag",
                          p.stockStatus === "Low stock" && "low",
                        )}
                      >
                        {tag}
                      </span>
                    )}
                    {inSale > 0 && <span className="pc-count">{inSale}</span>}
                  </span>
                  <span className="pc-info">
                    <span className="pc-name">{p.name}</span>
                    <span className="pc-foot">
                      <span className="pc-price">
                        {p.variants.length > 1 && <small>From</small>}
                        {money(from, currency)}
                      </span>
                      <span className="pc-add">
                        <ShoppingBag size={14} aria-hidden="true" /> Add
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <aside className="pos-side">
        {lastSale && (
          <div
            className="flex items-center justify-between gap-3 rounded-xl bg-ok-bg px-3.5 py-2.5 text-sm"
            role="status"
          >
            <span>
              <span className="block text-xs font-semibold">Order placed</span>
              <b>{lastSale.order.orderNumber}</b>,{" "}
              {money(lastSale.order.total, currency)}
              {lastSale.tendered != null && (
                <span className="block text-xs">
                  Change{" "}
                  {money(lastSale.tendered - lastSale.order.total, currency)}
                </span>
              )}
            </span>
            <button
              type="button"
              className="btn btn-p btn-sm"
              onClick={() => printReceipt(lastSale, settings)}
            >
              <Printer size={15} aria-hidden="true" /> Print receipt
            </button>
          </div>
        )}
        <div className="pos-type" role="group" aria-label="Order type">
          <span className="pos-type-title">Order type</span>
          <div className="pos-types">
            <button
              type="button"
              aria-pressed={!toMake}
              className={cn("pp-radio", !toMake && "on")}
              disabled={mustOrderAhead}
              title={
                mustOrderAhead
                  ? "Made-to-order items can't be dine-in"
                  : undefined
              }
              onClick={() => setOrderType("now")}
            >
              Dine-in
            </button>
            <button
              type="button"
              aria-pressed={toMake}
              className={cn("pp-radio", toMake && "on")}
              onClick={() => setOrderType("production")}
            >
              Take Away
            </button>
          </div>
          {mustOrderAhead && (
            <p className="pos-type-note">
              {aheadNames} {aheadProducts.length > 1 ? "need" : "needs"}{" "}
              {noticeText(makeLead)} notice, so this is a Take Away order with a
              pickup date.
            </p>
          )}
        </div>

        <div className="pos-table-head">
          <span>Item</span>
          <span>Qty</span>
          <span>Price</span>
        </div>
        <div className="pos-lines">
          {!cart.length ? (
            <p className="pos-empty">Add products to start a sale.</p>
          ) : (
            cart.map((l) => {
              const product = products.find((p) => p._id === l.productId);
              return (
                <div key={l.id} className="pos-line">
                  <div className="pos-line-top">
                    <span className="pos-line-name">{l.name}</span>
                    <Qty
                      small
                      value={l.qty}
                      max={product ? stockLeft(product, l.id) : 50}
                      onChange={(qty) => setQty(l, qty)}
                      label={`Quantity of ${l.name}`}
                    />
                    <span className="pos-line-total">
                      {money(l.price * l.qty, currency)}
                    </span>
                  </div>
                  <div className="pos-rows">
                    {billRows(l).map((r) => (
                      <div key={r.label} className="pos-row">
                        <span className="min-w-0">{r.label}</span>
                        <span>
                          {r.amount ? money(r.amount, currency) : "Included"}
                        </span>
                      </div>
                    ))}
                    {l.options?.message && (
                      <div className="min-w-0">
                        Message: “{l.options.message}”
                      </div>
                    )}
                    {l.options?.instructions && (
                      <div className="min-w-0">
                        Note: {l.options.instructions}
                      </div>
                    )}
                    {l.options?.referenceImages?.length > 0 && (
                      <div className="mt-1">
                        <ReferenceImageList
                          images={l.options.referenceImages}
                          size={40}
                        />
                      </div>
                    )}
                  </div>
                  <div className="pos-line-actions">
                    {l.custom && product && (
                      <button
                        type="button"
                        className="pos-line-action"
                        onClick={() => setEditing({ product, line: l })}
                      >
                        <Pencil size={12} aria-hidden="true" /> Edit
                      </button>
                    )}
                    <button
                      type="button"
                      className="pos-line-action"
                      aria-label={`Remove ${l.name}`}
                      onClick={() => remove(l)}
                    >
                      <Trash2 size={12} aria-hidden="true" /> Remove
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="pos-totals">
          <div className="pos-total-row">
            <span>Subtotal</span>
            <span>{money(total, currency)}</span>
          </div>
          {toMake && serviceFee > 0 && (
            <div className="pos-total-row">
              <span>{settings?.fees?.serviceFeeLabel || "Service fee"}</span>
              <span>{money(serviceFee, currency)}</span>
            </div>
          )}
          {cart.length > 0 && (
            <div className="pos-discount">
              <DiscountInput
                id="pos-discount"
                base={shownTotal}
                value={discount}
                onChange={setDiscount}
                currency={currency}
              />
            </div>
          )}
          {discountOff > 0 && (
            <div className="pos-total-row">
              <span>
                Discount
                {discount.mode === "%" ? ` (${Number(discount.value)}%)` : ""}
              </span>
              <span className="text-ok">−{money(discountOff, currency)}</span>
            </div>
          )}
          <div className="pos-total-row big">
            <span>Total</span>
            <span>{money(finalTotal, currency)}</span>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-p btn-lg w-full"
          disabled={!cart.length || discountBad}
          onClick={() => setSending(true)}
        >
          <ChefHat size={17} /> Add Customer details
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={!cart.length}
          onClick={resetSale}
        >
          Clear sale
        </button>
      </aside>
    </div>
  );
}
