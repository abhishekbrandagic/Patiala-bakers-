import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Eye, Plus, Search, Trash2 } from "lucide-react";
import { api, apiError, assetUrl } from "../../api/client.js";
import { useFetch } from "../../hooks/useFetch.js";
import {
  Badge,
  EmptyState,
  ErrorState,
  Field,
  Modal,
  PageLoader,
  Skeleton,
  Spinner,
} from "../../components/ui.jsx";
import CustomCakeForm from "../../components/CustomCakeForm.jsx";
import DiscountInput from "../../components/admin/DiscountInput.jsx";
import {
  discountAmount,
  discountError,
  discountPayload,
} from "../../utils/discount.js";
import { useSettings } from "../../context/SettingsContext.jsx";
import {
  cn,
  fmtDate,
  fmtLong,
  fmtStamp,
  money,
  t12,
} from "../../utils/format.js";

const TABS = [
  "all",
  "New",
  "Quoted",
  "Awaiting Payment",
  "Confirmed",
  "Converted",
  "Declined",
];

// The quote as the customer sees it, with the deposit and what is left to pay at pickup
function QuoteView({ open, onClose, e }) {
  const q = e.quote;
  const deposit = (q.total * (q.depositPercent || 0)) / 100;
  return (
    <Modal open={open} onClose={onClose} title={`Quote ${e.reference}`}>
      <div className="flex flex-col gap-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{q.sentAt ? "Sent" : "Draft"}</Badge>
          <span className="muted">
            {q.sentAt
              ? `Emailed to ${e.email} on ${fmtStamp(q.sentAt)}`
              : "Not sent to the customer yet"}
          </span>
        </div>
        <div className="grid gap-x-3.5 gap-y-1.5 [grid-template-columns:110px_1fr]">
          <span className="font-semibold muted">Customer</span>
          <span>
            <b>{e.name}</b> · {e.phone}
          </span>
          <span className="font-semibold muted">Cake</span>
          <span>
            {e.occasion} · {e.size || "—"} · {e.servings} serves
          </span>
          <span className="font-semibold muted">Needed</span>
          <span>
            {fmtLong(e.requiredDate)}
            {e.pickupTime ? ` at ${t12(e.pickupTime)}` : ""}
          </span>
          {e.diet?.length > 0 && (
            <>
              <span className="font-semibold muted">Dietary</span>
              <span>{e.diet.join(", ")}</span>
            </>
          )}
        </div>
        <div className="rounded-xl border border-line-2 px-4 py-2">
          {q.lines.map((l, i) => (
            <div key={i} className="sumline !py-1.5">
              <span>{l.label}</span>
              <span className="num">{money(l.amount)}</span>
            </div>
          ))}
          <div className="sumline tot !mt-1 !pt-2.5 !text-base">
            <span>Total</span>
            <span className="num">{money(q.total)}</span>
          </div>
        </div>
        <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
          <div className="rounded-xl bg-cream p-3">
            <span className="block text-xs font-bold muted">
              Deposit ({q.depositPercent || 0}%)
            </span>
            <b className="num text-lg">{money(deposit)}</b>
            <span className="block text-xs muted">Confirms the booking</span>
          </div>
          <div className="rounded-xl bg-cream p-3">
            <span className="block text-xs font-bold muted">
              Balance at pickup
            </span>
            <b className="num text-lg">{money(q.total - deposit)}</b>
            <span className="block text-xs muted">Paid when collecting</span>
          </div>
        </div>
        {q.note && (
          <p className="rounded-xl bg-gold-bg p-3">
            <span className="block text-xs font-bold muted">
              Note to customer
            </span>
            {q.note}
          </p>
        )}
        {e.finalPrice > 0 && Math.abs(e.finalPrice - q.total) >= 0.005 && (
          <p className="text-xs muted">
            The final agreed price was {money(e.finalPrice)}.
          </p>
        )}
      </div>
    </Modal>
  );
}

function Detail({ id, onChanged }) {
  const { settings } = useSettings();
  const [e, setE] = useState(null);
  const [note, setNote] = useState("");
  const [quote, setQuote] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [slots, setSlots] = useState([]);
  const [busy, setBusy] = useState("");
  const [viewQuote, setViewQuote] = useState(false);

  useEffect(() => {
    setE(null);
    setQuote(null);
    setConfirm(null);
    api
      .get(`/admin/enquiries/${id}`)
      .then(({ data }) => {
        setE(data.enquiry);
        // Starts from the quote and the pickup time the customer asked for
        setConfirm({
          finalPrice: data.enquiry.quote?.total ?? "",
          pickupDate: data.enquiry.requiredDate,
          pickupTime: data.enquiry.pickupTime || "",
          depositPaid: false,
          discount: { mode: "%", value: "" },
        });
      })
      .catch((er) => toast.error(apiError(er).message));
  }, [id]);
  useEffect(() => {
    if (confirm?.pickupDate)
      api
        .get("/availability", { params: { date: confirm.pickupDate } })
        .then(({ data }) => setSlots(data.slots))
        .catch(() => setSlots([]));
  }, [confirm?.pickupDate]);
  if (!e) return <PageLoader />;

  const run = async (key, fn, msg) => {
    setBusy(key);
    try {
      const { data } = await fn();
      setE(data.enquiry);
      onChanged();
      if (msg) toast.success(msg);
      return data;
    } catch (er) {
      toast.error(apiError(er).message);
      return null;
    } finally {
      setBusy("");
    }
  };
  const qTotal = quote
    ? quote.lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
    : 0;
  // The confirmed price after any discount
  const agreed = Number(confirm?.finalPrice) || 0;
  const discountOff = confirm ? discountAmount(agreed, confirm.discount) : 0;
  const discountBad = confirm
    ? Boolean(discountError(agreed, confirm.discount))
    : false;
  const confirmTotal = Math.round((agreed - discountOff) * 100) / 100;
  const locked = e.status === "Converted";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h2 className="font-sans text-xl font-extrabold">
            {e.reference} · {e.occasion}
          </h2>
          <p className="text-sm muted">Received {fmtStamp(e.createdAt)}</p>
        </div>
        <Badge>{e.status}</Badge>
        {!locked && (
          <select
            className="sel"
            aria-label="Change status"
            value={e.status}
            onChange={(ev) =>
              run(
                "status",
                () =>
                  api.patch(`/admin/enquiries/${id}`, {
                    status: ev.target.value,
                  }),
                "Status updated",
              )
            }
          >
            {TABS.slice(1)
              .filter((s) => s !== "Converted")
              .map((s) => (
                <option key={s}>{s}</option>
              ))}
          </select>
        )}
      </div>
      <div className="grid gap-x-3.5 gap-y-2 text-sm [grid-template-columns:120px_1fr]">
        <span className="font-semibold muted">Customer</span>
        <span>
          <b>{e.name}</b> · <a href={`tel:${e.phone}`}>{e.phone}</a> ·{" "}
          <a href={`mailto:${e.email}`}>{e.email}</a>
        </span>
        <span className="font-semibold muted">Needed</span>
        <span>
          <b>{fmtLong(e.requiredDate)}</b>
          {e.pickupTime && (
            <>
              {" "}
              at <b>{t12(e.pickupTime)}</b>
            </>
          )}
        </span>
        {e.finalPrice > 0 && (
          <>
            <span className="font-semibold muted">Agreed price</span>
            <span>
              <b>{money(e.finalPrice)}</b>
            </span>
          </>
        )}
        <span className="font-semibold muted">Size</span>
        <span>
          {e.size || "—"} · {e.servings} serves
          {e.budget ? ` · budget ${e.budget}` : ""}
        </span>
        <span className="font-semibold muted">Dietary</span>
        <span>{e.diet?.length ? e.diet.join(", ") : "—"}</span>
        {e.orderNumber && (
          <>
            <span className="font-semibold muted">Order</span>
            <span>
              <Link
                to={`/admin/orders?q=${e.orderNumber}`}
                className="font-bold"
              >
                {e.orderNumber}
              </Link>
            </span>
          </>
        )}
      </div>
      <p className="whitespace-pre-wrap rounded-xl bg-cream p-4 text-[14.5px]">
        {e.description}
      </p>
      {e.referenceImages?.length > 0 && (
        <div className="flex flex-wrap gap-2.5">
          {e.referenceImages.map((im) => (
            <a
              key={im.url}
              href={assetUrl(im.url)}
              target="_blank"
              rel="noreferrer"
            >
              <img
                src={assetUrl(im.url)}
                alt="Customer reference"
                className="h-28 w-28 rounded-xl border border-line object-cover"
              />
            </a>
          ))}
        </div>
      )}

      <section className="rounded-[14px] border border-line-2 bg-white p-4">
        <div className="flex items-center gap-2">
          <h3 className="flex-1 text-sm font-extrabold">Quote</h3>
          {!locked && !quote && (
            <button
              className="btn btn-o btn-sm"
              onClick={() =>
                setQuote({
                  lines: e.quote?.lines?.length
                    ? e.quote.lines.map((l) => ({ ...l }))
                    : [
                        {
                          label: `${e.size || ""} ${e.occasion} cake`.trim(),
                          amount: "",
                        },
                      ],
                  depositPercent:
                    e.quote?.depositPercent ??
                    settings?.payments?.depositPercent ??
                    50,
                  note: e.quote?.note || "Quote valid for 7 days.",
                })
              }
            >
              {e.quote?.lines?.length ? "Edit quote" : "Create quote"}
            </button>
          )}
        </div>
        {quote ? (
          <div className="mt-3 flex flex-col gap-2">
            {quote.lines.map((l, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="in in-sm flex-1"
                  aria-label="Line description"
                  value={l.label}
                  onChange={(ev) =>
                    setQuote({
                      ...quote,
                      lines: quote.lines.map((x, j) =>
                        j === i ? { ...x, label: ev.target.value } : x,
                      ),
                    })
                  }
                />
                <input
                  className="in in-sm !w-28"
                  type="number"
                  min="0"
                  step="0.01"
                  aria-label="Amount"
                  value={l.amount}
                  onChange={(ev) =>
                    setQuote({
                      ...quote,
                      lines: quote.lines.map((x, j) =>
                        j === i ? { ...x, amount: ev.target.value } : x,
                      ),
                    })
                  }
                />
                <button
                  className="iconbtn !h-9 !w-9"
                  aria-label="Remove line"
                  onClick={() =>
                    setQuote({
                      ...quote,
                      lines: quote.lines.filter((_, j) => j !== i),
                    })
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <button
              className="btn btn-ghost btn-xs self-start"
              onClick={() =>
                setQuote({
                  ...quote,
                  lines: [...quote.lines, { label: "", amount: "" }],
                })
              }
            >
              <Plus size={13} /> Add line
            </button>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Deposit %" htmlFor="qd" className="w-24">
                <input
                  id="qd"
                  type="number"
                  min="0"
                  max="100"
                  className="in in-sm"
                  value={quote.depositPercent}
                  onChange={(ev) =>
                    setQuote({ ...quote, depositPercent: ev.target.value })
                  }
                />
              </Field>
              <Field label="Note to customer" htmlFor="qn" className="flex-1">
                <input
                  id="qn"
                  className="in in-sm"
                  value={quote.note}
                  onChange={(ev) =>
                    setQuote({ ...quote, note: ev.target.value })
                  }
                />
              </Field>
            </div>
            <p className="text-sm">
              Total <b className="num">{money(qTotal)}</b> · deposit{" "}
              <b className="num">
                {money((qTotal * Number(quote.depositPercent || 0)) / 100)}
              </b>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                className="btn btn-o btn-sm"
                onClick={() => setQuote(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-o btn-sm"
                disabled={!!busy}
                onClick={async () => {
                  if (
                    await run(
                      "quote",
                      () =>
                        api.post(`/admin/enquiries/${id}/quote`, {
                          ...quote,
                          lines: quote.lines.map((l) => ({
                            label: l.label,
                            amount: Number(l.amount) || 0,
                          })),
                          send: false,
                        }),
                      "Quote saved",
                    )
                  )
                    setQuote(null);
                }}
              >
                Save draft
              </button>
              <button
                className="btn btn-p btn-sm"
                disabled={!!busy || !quote.lines.length}
                onClick={async () => {
                  const d = await run("quote", () =>
                    api.post(`/admin/enquiries/${id}/quote`, {
                      ...quote,
                      lines: quote.lines.map((l) => ({
                        label: l.label,
                        amount: Number(l.amount) || 0,
                      })),
                      send: true,
                    }),
                  );
                  if (d) {
                    setQuote(null);
                    toast.success(
                      d.emailed
                        ? "Quote emailed to customer"
                        : "Quote saved (email not configured — contact the customer directly)",
                    );
                  }
                }}
              >
                {busy === "quote" && <Spinner />} Save & email quote
              </button>
            </div>
          </div>
        ) : e.quote?.lines?.length ? (
          <div className="mt-2 text-sm">
            {e.quote.lines.map((l, i) => (
              <div key={i} className="sumline !py-1">
                <span>{l.label}</span>
                <span className="num">{money(l.amount)}</span>
              </div>
            ))}
            <div className="sumline tot !text-base">
              <span>Total</span>
              <span className="num">{money(e.quote.total)}</span>
            </div>
            <p className="text-xs muted">
              {e.quote.depositPercent}% deposit ·{" "}
              {e.quote.sentAt
                ? `sent ${fmtStamp(e.quote.sentAt)}`
                : "draft, not sent"}
            </p>
            <button
              type="button"
              className="btn btn-o btn-sm mt-3"
              onClick={() => setViewQuote(true)}
            >
              <Eye size={15} aria-hidden="true" /> View quote
            </button>
          </div>
        ) : (
          <p className="mt-2 text-sm muted">No quote yet.</p>
        )}
      </section>

      {!locked && confirm && (
        <section className="rounded-[14px] border-2 border-line bg-white p-4">
          <h3 className="text-sm font-extrabold">Confirm order</h3>
          <p className="mb-3 text-xs muted">
            Once confirmed, the cake goes to Orders and Production as Confirmed.
          </p>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(170px,100%),1fr))]">
            <Field
              label="Final price agreed ($)"
              htmlFor="cf-price"
              help={
                e.quote?.total
                  ? `Quote was ${money(e.quote.total)}`
                  : "No quote sent"
              }
            >
              <input
                id="cf-price"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.5"
                className="in"
                value={confirm.finalPrice}
                onChange={(ev) =>
                  setConfirm({ ...confirm, finalPrice: ev.target.value })
                }
              />
            </Field>
            <Field label="Pickup date" htmlFor="cf-date">
              <input
                id="cf-date"
                type="date"
                className="in"
                value={confirm.pickupDate}
                onChange={(ev) =>
                  setConfirm({
                    ...confirm,
                    pickupDate: ev.target.value,
                    pickupTime: "",
                  })
                }
              />
            </Field>
            <Field label="Pickup time" htmlFor="cf-time">
              <select
                id="cf-time"
                className="in"
                value={confirm.pickupTime}
                onChange={(ev) =>
                  setConfirm({ ...confirm, pickupTime: ev.target.value })
                }
              >
                <option value="">
                  {slots.length ? "Choose…" : "Closed this day"}
                </option>
                {slots.map((sl) => (
                  <option
                    key={sl.time}
                    value={sl.time}
                    disabled={!sl.available}
                  >
                    {t12(sl.time)} ·{" "}
                    {sl.available ? `${sl.remaining} left` : sl.reason}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {agreed > 0 && (
            <div className="mt-3 grid items-end gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr))]">
              <DiscountInput
                id="cf-discount"
                base={agreed}
                value={confirm.discount}
                onChange={(d) => setConfirm({ ...confirm, discount: d })}
              />
              <div className="rounded-xl bg-cream px-3.5 py-2.5">
                <span className="block text-xs font-bold muted">
                  {discountOff > 0 ? "New price after discount" : "Order total"}
                </span>
                <b className="num text-lg">{money(confirmTotal)}</b>
                {discountOff > 0 && (
                  <span className="ml-2 text-sm muted line-through">
                    {money(agreed)}
                  </span>
                )}
              </div>
            </div>
          )}
          {agreed > 0 && (
            <label className="check mt-2">
              <input
                type="checkbox"
                checked={confirm.depositPaid}
                onChange={(ev) =>
                  setConfirm({ ...confirm, depositPaid: ev.target.checked })
                }
              />{" "}
              Deposit received (
              {money(
                (confirmTotal *
                  (e.quote?.depositPercent ??
                    settings?.payments?.depositPercent ??
                    50)) /
                  100,
              )}
              )
            </label>
          )}
          <button
            className="btn btn-p mt-3"
            disabled={
              !(agreed > 0) || discountBad || !confirm.pickupTime || !!busy
            }
            onClick={async () => {
              const d = await run("confirm", () =>
                api.post(`/admin/enquiries/${id}/convert`, {
                  finalPrice: agreed,
                  pickupDate: confirm.pickupDate,
                  pickupTime: confirm.pickupTime,
                  depositPaid: confirm.depositPaid,
                  ...discountPayload(agreed, confirm.discount),
                }),
              );
              if (d)
                toast.success(
                  `Order ${d.order.orderNumber} confirmed. It's now in Orders and Production.`,
                );
            }}
          >
            {busy === "confirm" && <Spinner />} Confirm order
          </button>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-sm font-extrabold">Internal notes</h3>
        {e.internalNotes?.map((n, i) => (
          <div key={i} className="mb-2 rounded-lg bg-gold-bg px-3 py-2 text-sm">
            {n.text}
            <span className="block text-[11px] muted">
              {n.by} · {fmtStamp(n.at)}
            </span>
          </div>
        ))}
        <form
          className="flex gap-2"
          onSubmit={async (ev) => {
            ev.preventDefault();
            if (
              note.trim() &&
              (await run(
                "note",
                () => api.post(`/admin/enquiries/${id}/notes`, { text: note }),
                "Note added",
              ))
            )
              setNote("");
          }}
        >
          <label className="sr-only" htmlFor="en">
            Add note
          </label>
          <input
            id="en"
            className="in in-sm flex-1"
            value={note}
            onChange={(ev) => setNote(ev.target.value)}
            placeholder="Add a note for the team"
          />
          <button className="btn btn-o btn-sm" disabled={!note.trim()}>
            Add
          </button>
        </form>
      </section>
      {e.quote?.lines?.length > 0 && (
        <QuoteView open={viewQuote} onClose={() => setViewQuote(false)} e={e} />
      )}
      <section>
        <h3 className="mb-3 text-sm font-extrabold">History</h3>
        <div className="hist">
          {[...e.history].reverse().map((h, i) => (
            <div key={i} className="h">
              {h.text}
              <span className="block text-[11.5px] muted">
                {fmtStamp(h.at)}
                {h.by ? ` · ${h.by}` : ""}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function Enquiries() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") || "all";
  const sel = params.get("open") || "";
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const { data, error, reload } = useFetch("/admin/enquiries", {
    status,
    q: q || undefined,
  });
  const set = (k, v) => {
    const n = new URLSearchParams(params);
    if (!v || v === "all") n.delete(k);
    else n.set(k, v);
    setParams(n, { replace: true });
  };
  useEffect(() => {
    if (!sel && data?.items?.length && window.innerWidth >= 1024)
      set("open", data.items[0]._id);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {TABS.map((t) => (
          <button
            key={t}
            className={cn("tab", status === t && "on")}
            onClick={() => set("status", t)}
          >
            {t === "all" ? "All" : t}
            {t !== "all" && data?.counts?.[t] ? (
              <span className="cnt">{data.counts[t]}</span>
            ) : null}
          </button>
        ))}
        <span className="flex-1" />
        <button
          type="button"
          className="btn btn-p btn-sm"
          onClick={() => setAdding(true)}
        >
          <Plus size={15} aria-hidden="true" /> Add custom order
        </button>
        <div className="relative w-full max-w-[280px]">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-mute"
            aria-hidden="true"
          />
          <label className="sr-only" htmlFor="eq">
            Search enquiries
          </label>
          <input
            id="eq"
            className="in !min-h-[38px] !pl-9"
            placeholder="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <Skeleton className="h-96" />
      ) : !data.items.length ? (
        <EmptyState title="No enquiries here" />
      ) : (
        <div className="grid items-start gap-5 lg:[grid-template-columns:minmax(300px,380px)_1fr]">
          <div className="card overflow-hidden">
            {data.items.map((e) => (
              <button
                key={e._id}
                className={cn(
                  "flex w-full flex-col gap-1 border-b border-line-2 px-4 py-3.5 text-left last:border-0 hover:bg-[#FCF7EF]",
                  sel === e._id &&
                    "bg-[#FFF8E8] shadow-[inset_3px_0_0_#6E1630]",
                )}
                onClick={() => set("open", e._id)}
              >
                <span className="flex items-center gap-2">
                  <b className="text-sm text-wine">{e.reference}</b>
                  <span className="flex-1 truncate text-sm font-bold">
                    {e.name}
                  </span>
                  <Badge>{e.status}</Badge>
                </span>
                <span className="text-xs muted">
                  {e.occasion} · {e.servings} serves · needed{" "}
                  {fmtDate(e.requiredDate)}
                </span>
              </button>
            ))}
          </div>
          {sel ? (
            <div className="card card-b">
              <Detail
                key={sel}
                id={sel}
                onChanged={() => reload({ silent: true })}
              />
            </div>
          ) : (
            <div className="empty hidden lg:block">Select an enquiry</div>
          )}
        </div>
      )}
      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add a custom cake order"
        wide
      >
        <p className="mb-5 text-sm muted">
          For a cake ordered over the phone or at the counter. It is saved as an
          enquiry, so you can enter the final price and confirm it here.
        </p>
        <CustomCakeForm
          staff
          onCancel={() => setAdding(false)}
          onDone={(d) => {
            setAdding(false);
            toast.success(`Custom order ${d.reference} added`);
            const n = new URLSearchParams(params);
            n.delete("status");
            n.set("open", d.id);
            setParams(n, { replace: true });
            reload({ silent: true });
          }}
        />
      </Modal>
    </>
  );
}
