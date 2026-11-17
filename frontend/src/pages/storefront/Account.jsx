import { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { ArrowLeft, LogOut, RotateCcw } from "lucide-react";
import { api, apiError } from "../../api/client.js";
import OrderView from "../../components/OrderView.jsx";
import { ReferenceImageList } from "../../components/ReferenceImages.jsx";
import {
  Badge,
  EmptyState,
  ErrorState,
  Field,
  PageLoader,
  Pagination,
  Spinner,
} from "../../components/ui.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useCart } from "../../context/CartContext.jsx";
import { useSettings } from "../../context/SettingsContext.jsx";
import {
  fmtDate,
  fmtLong,
  fmtShort,
  fmtStamp,
  money,
  t12,
} from "../../utils/format.js";
import { AddressInput, DobInput } from "../../components/ProfileFields.jsx";
import {
  addressFromForm,
  addressToForm,
  dobError,
  dobFromForm,
  dobToForm,
} from "../../utils/dob.js";

function useReorder() {
  const { items, replace, setOpen } = useCart();
  return async (orderNumber) => {
    try {
      const { data } = await api.post(`/account/orders/${orderNumber}/reorder`);
      if (!data.items.length) {
        toast.error("None of the items in that order are available right now.");
        return;
      }
      replace([...items, ...data.items]);
      toast.success(
        `Added ${data.items.length} item${data.items.length === 1 ? "" : "s"} to your cart${data.skipped.length ? ` · ${data.skipped.length} unavailable` : ""}`,
      );
      setOpen(true);
    } catch (e) {
      toast.error(apiError(e).message);
    }
  };
}

function Orders() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const reorder = useReorder();
  useEffect(() => {
    setData(null);
    api
      .get("/account/orders", { params: { page, limit: 10 } })
      .then(({ data: d }) => setData(d))
      .catch((e) => setError(apiError(e).message));
  }, [page]);
  if (error) return <ErrorState message={error} />;
  if (!data) return <PageLoader />;
  if (!data.items.length)
    return (
      <EmptyState
        title="No orders yet"
        action={
          <Link to="/shop" className="btn btn-p">
            Start an order
          </Link>
        }
      >
        Your orders will appear here.
      </EmptyState>
    );
  return (
    <>
      <div className="tblwrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Order</th>
              <th>Pickup</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.items.map((o) => (
              <tr key={o.orderNumber}>
                <td>
                  <Link
                    to={`/account/orders/${o.orderNumber}`}
                    className="font-extrabold"
                  >
                    {o.orderNumber}
                  </Link>
                  <div className="text-xs muted">{fmtShort(o.createdAt)}</div>
                </td>
                <td>
                  {fmtDate(o.pickupDate)} · {t12(o.pickupTime)}
                </td>
                <td className="max-w-[260px] truncate">
                  {o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
                </td>
                <td className="num font-bold">{money(o.total)}</td>
                <td>
                  <Badge>{o.status}</Badge>
                </td>
                <td>
                  <button
                    className="btn btn-o btn-xs"
                    onClick={() => reorder(o.orderNumber)}
                  >
                    <RotateCcw size={13} /> Reorder
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={data.page} pages={data.pages} onPage={setPage} />
    </>
  );
}

function OrderDetail() {
  const { orderNumber } = useParams();
  const { settings } = useSettings();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const reorder = useReorder();
  useEffect(() => {
    api
      .get(`/account/orders/${orderNumber}`)
      .then(({ data }) => setOrder(data.order))
      .catch((e) => setError(apiError(e).message));
  }, [orderNumber]);
  if (error) return <ErrorState message={error} />;
  if (!order) return <PageLoader />;
  return (
    <div className="card card-b">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link to="/account" className="btn btn-ghost btn-sm">
          <ArrowLeft size={15} /> All orders
        </Link>
        <h2 className="flex-1 font-sans text-xl font-extrabold">
          {order.orderNumber}
        </h2>
        <button
          className="btn btn-o btn-sm"
          onClick={() => reorder(order.orderNumber)}
        >
          <RotateCcw size={14} /> Order again
        </button>
      </div>
      <OrderView order={order} address={settings?.business?.address} />
    </div>
  );
}

function Enquiries() {
  const [items, setItems] = useState(null);
  useEffect(() => {
    api
      .get("/account/enquiries")
      .then(({ data }) => setItems(data.items))
      .catch(() => setItems([]));
  }, []);
  if (!items) return <PageLoader />;
  if (!items.length)
    return (
      <EmptyState
        title="No custom cake enquiries"
        action={
          <Link to="/custom-cakes" className="btn btn-p">
            Start an enquiry
          </Link>
        }
      />
    );
  return (
    <div className="tblwrap">
      <table className="tbl">
        <thead>
          <tr>
            <th>Reference</th>
            <th>Occasion</th>
            <th>Date needed</th>
            <th>Quote</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((e) => (
            <tr key={e.reference}>
              <td>
                <Link
                  to={`/account/enquiries/${e.reference}`}
                  className="font-extrabold"
                >
                  {e.reference}
                </Link>
              </td>
              <td>
                {e.occasion} · {e.servings} serves
              </td>
              <td>{fmtDate(e.requiredDate)}</td>
              <td>
                {e.finalPrice
                  ? money(e.finalPrice)
                  : e.quote?.sentAt && e.quote?.total
                    ? money(e.quote.total)
                    : "—"}
              </td>
              <td>
                <Badge>{e.progress?.label || e.status}</Badge>
                {e.orderNumber && (
                  <Link
                    className="ml-2 text-sm"
                    to={`/account/orders/${e.orderNumber}`}
                  >
                    {e.orderNumber}
                  </Link>
                )}
                {e.progress?.detail && (
                  <div className="mt-1 text-xs muted">{e.progress.detail}</div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// What the customer asked for, the photos they sent, and the bakery's quote
function EnquiryDetail() {
  const { reference } = useParams();
  const [e, setE] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    api
      .get(`/account/enquiries/${reference}`)
      .then(({ data }) => setE(data.enquiry))
      .catch((err) => setError(apiError(err).message));
  }, [reference]);
  if (error) return <ErrorState message={error} />;
  if (!e) return <PageLoader />;
  const rows = [
    ["Occasion", e.occasion],
    ["Size", e.size],
    ["Servings", e.servings ? `${e.servings} serves` : ""],
    [
      "Pickup",
      `${fmtLong(e.requiredDate)}${e.pickupTime ? ` at ${t12(e.pickupTime)}` : ""}`,
    ],
    ["Agreed price", e.finalPrice ? money(e.finalPrice) : ""],
    ["Dietary", e.diet?.join(", ")],
    ["Budget", e.budget],
    ["Contact", [e.name, e.phone, e.email].filter(Boolean).join(" · ")],
  ].filter(([, v]) => v);
  const deposit =
    e.quote?.total && e.quote.depositPercent
      ? (e.quote.total * e.quote.depositPercent) / 100
      : 0;
  return (
    <div className="card card-b flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/account/enquiries" className="btn btn-ghost btn-sm">
          <ArrowLeft size={15} /> All enquiries
        </Link>
        <h2 className="flex-1 font-sans text-xl font-extrabold">
          {e.reference}
        </h2>
        <Badge>{e.progress?.label || e.status}</Badge>
      </div>
      {e.progress?.detail && (
        <p className="-mt-2 text-sm muted">{e.progress.detail}</p>
      )}
      {e.orderNumber && (
        <p className="goldbox">
          This enquiry is now order{" "}
          <Link
            to={`/account/orders/${e.orderNumber}`}
            className="font-extrabold"
          >
            {e.orderNumber}
          </Link>
          .
        </p>
      )}
      <div className="grid gap-3 rounded-xl bg-cream p-4 text-sm [grid-template-columns:110px_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <span className="font-semibold muted">{k}</span>
            <span>{v}</span>
          </div>
        ))}
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
        {!e.quote ? (
          <p className="text-sm muted">
            We haven’t sent a quote yet. We usually reply within 24 hours.
          </p>
        ) : (
          <>
            {e.quote.lines.map((l, k) => (
              <div key={k} className="sumline">
                <span>{l.label}</span>
                <span className="num">{money(l.amount)}</span>
              </div>
            ))}
            <div className="sumline tot">
              <span>Total</span>
              <span className="num">{money(e.quote.total)}</span>
            </div>
            {deposit > 0 && (
              <p className="mt-2 text-sm">
                A {e.quote.depositPercent}% deposit of <b>{money(deposit)}</b>{" "}
                confirms your booking.
              </p>
            )}
            {e.quote.note && (
              <p className="mt-2 text-sm muted">{e.quote.note}</p>
            )}
          </>
        )}
      </div>
      {e.timeline?.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-extrabold">History</h3>
          <div className="hist">
            {e.timeline.map((h, k) => (
              <div key={k} className="h">
                {h.text}
                <span className="block text-[11.5px] muted">
                  {fmtStamp(h.at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Profile() {
  const { user, setUser } = useAuth();
  const p = useForm({
    defaultValues: {
      name: user.name,
      phone: user.phone || "",
      dietaryPref: user.dietaryPref || "",
    },
  });
  const pw = useForm({
    defaultValues: { currentPassword: "", newPassword: "" },
  });
  // Birthday, address and WhatsApp consent are kept in the customer profile the bakery sees
  const [extra, setExtra] = useState(null);
  useEffect(() => {
    api
      .get("/account/profile")
      .then(({ data }) =>
        setExtra({
          dob: dobToForm(data.profile?.dob),
          anniversary: dobToForm(data.profile?.anniversary),
          address: addressToForm(data.profile?.address),
          whatsappOptIn: Boolean(data.profile?.whatsapp?.optIn),
        }),
      )
      .catch(() =>
        setExtra({
          dob: dobToForm(null),
          anniversary: dobToForm(null),
          address: addressToForm(null),
          whatsappOptIn: false,
        }),
      );
  }, []);
  const save = p.handleSubmit(async (v) => {
    const dateProblem =
      extra && (dobError(extra.dob) || dobError(extra.anniversary));
    if (dateProblem) {
      toast.error(dateProblem);
      return;
    }
    const more = extra
      ? {
          dob: dobFromForm(extra.dob),
          anniversary: dobFromForm(extra.anniversary),
          address: addressFromForm(extra.address),
          whatsappOptIn: extra.whatsappOptIn,
        }
      : {};
    try {
      const { data } = await api.patch("/account/profile", { ...v, ...more });
      setUser(data.user);
      toast.success("Profile saved");
    } catch (e) {
      toast.error(apiError(e).message);
    }
  });
  const change = pw.handleSubmit(async (v) => {
    if (v.newPassword.length < 8) {
      pw.setError("newPassword", { message: "Use at least 8 characters" });
      return;
    }
    try {
      await api.post("/account/password", v);
      pw.reset();
      toast.success("Password updated");
    } catch (e) {
      const ae = apiError(e);
      Object.entries(ae.fields).forEach(([k, m]) =>
        pw.setError(k, { message: m }),
      );
      toast.error(ae.message);
    }
  });
  return (
    <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))]">
      <form className="card card-b flex flex-col gap-4" onSubmit={save}>
        <h2 className="font-sans text-lg font-extrabold">Profile</h2>
        <Field label="Email">
          <input className="in" value={user.email} disabled />
        </Field>
        <Field label="Name" htmlFor="pn">
          <input
            id="pn"
            className="in"
            {...p.register("name", { required: true, minLength: 2 })}
          />
        </Field>
        <Field label="Mobile" htmlFor="pp">
          <input id="pp" className="in" {...p.register("phone")} />
        </Field>
        <Field
          label="Dietary preference"
          htmlFor="pd"
          help="Shown to our team when you order."
        >
          <select id="pd" className="in" {...p.register("dietaryPref")}>
            <option value="">None</option>
            <option>Eggless</option>
            <option>Vegan</option>
            <option>Gluten-free</option>
            <option>Nut-free</option>
          </select>
        </Field>
        {extra && (
          <div className="flex flex-col gap-4 border-t border-line-2 pt-4">
            <p className="text-sm muted">
              Optional. Tell us your birthday or anniversary so we can send you
              something special on the day.
            </p>
            <DobInput
              idPrefix="pf-dob"
              value={extra.dob}
              onChange={(dob) => setExtra({ ...extra, dob })}
              help="The year is optional."
            />
            <DobInput
              idPrefix="pf-ann"
              label="Wedding anniversary"
              value={extra.anniversary}
              onChange={(anniversary) => setExtra({ ...extra, anniversary })}
              help="Optional. We’d love to help you celebrate."
            />
            <AddressInput
              idPrefix="pf-addr"
              value={extra.address}
              onChange={(address) => setExtra({ ...extra, address })}
            />
            <label className="check items-start !min-h-0">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={extra.whatsappOptIn}
                onChange={(e) =>
                  setExtra({ ...extra, whatsappOptIn: e.target.checked })
                }
              />
              <span className="text-sm">
                Send me birthday offers and special deals from Patiala Bakers on
                WhatsApp
                <span className="block text-xs muted">
                  You can turn this off here at any time, or reply STOP to any
                  message.
                </span>
              </span>
            </label>
          </div>
        )}
        <button
          className="btn btn-p self-start"
          disabled={p.formState.isSubmitting}
        >
          {p.formState.isSubmitting && <Spinner />} Save
        </button>
      </form>
      {user.googleLinked ? (
        <div className="card card-b flex flex-col gap-2">
          <h2 className="font-sans text-lg font-extrabold">Sign-in</h2>
          <p className="muted">
            You sign in with your Google account, so there's no password to
            manage here.
          </p>
        </div>
      ) : (
        <form className="card card-b flex flex-col gap-4" onSubmit={change}>
          <h2 className="font-sans text-lg font-extrabold">Change password</h2>
          <Field
            label="Current password"
            htmlFor="cp"
            error={pw.formState.errors.currentPassword?.message}
          >
            <input
              id="cp"
              type="password"
              autoComplete="current-password"
              className="in"
              {...pw.register("currentPassword", { required: "Required" })}
            />
          </Field>
          <Field
            label="New password"
            htmlFor="np"
            error={pw.formState.errors.newPassword?.message}
          >
            <input
              id="np"
              type="password"
              autoComplete="new-password"
              className="in"
              {...pw.register("newPassword")}
            />
          </Field>
          <button
            className="btn btn-o self-start"
            disabled={pw.formState.isSubmitting}
          >
            Update password
          </button>
        </form>
      )}
    </div>
  );
}

export default function Account() {
  const { user, logout, isStaff } = useAuth();
  const nav = useNavigate();
  const tab = ({ isActive }) => `tab ${isActive ? "on" : ""}`;
  return (
    <>
      <div className="pagehead">
        <div className="wrap flex flex-wrap items-end gap-4">
          <div className="flex-1">
            <p className="eyebrow">My account</p>
            <h1>Hi, {user.name.split(" ")[0]}</h1>
          </div>
          {isStaff && (
            <Link to="/admin" className="btn btn-p">
              Open admin
            </Link>
          )}
          <button
            className="btn btn-o"
            onClick={async () => {
              await logout();
              nav("/");
            }}
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </div>
      <div className="wrap py-8">
        <nav
          className="mb-6 flex flex-wrap gap-1.5"
          aria-label="Account sections"
        >
          <NavLink end to="/account" className={tab}>
            Orders
          </NavLink>
          <NavLink to="/account/enquiries" className={tab}>
            Custom cake enquiries
          </NavLink>
          <NavLink to="/account/profile" className={tab}>
            Profile
          </NavLink>
        </nav>
        <Routes>
          <Route index element={<Orders />} />
          <Route path="orders/:orderNumber" element={<OrderDetail />} />
          <Route path="enquiries" element={<Enquiries />} />
          <Route path="enquiries/:reference" element={<EnquiryDetail />} />
          <Route path="profile" element={<Profile />} />
        </Routes>
      </div>
    </>
  );
}
