import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Cake,
  CakeSlice,
  ChefHat,
  ClipboardList,
  Heart,
  Plus,
} from "lucide-react";
import { useFetch } from "../../hooks/useFetch.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { Badge, ErrorState, Skeleton } from "../../components/ui.jsx";
import ProductImage from "../../components/ProductImage.jsx";
import CustomerCard from "../../components/admin/CustomerCard.jsx";
import { fmtDob, inDaysLabel, ordinal } from "../../utils/dob.js";
import {
  bakeryDate,
  fmtDate,
  fmtLong,
  fmtStamp,
  money,
  money0,
  sizeLabel,
  t12,
} from "../../utils/format.js";

function Kpi({ label, value, sub, to, tone }) {
  return (
    <Link to={to} className="kpi">
      <span className="l">{label}</span>
      <span className="v">{value}</span>
      {sub && (
        <span
          className={`text-xs font-semibold ${tone === "up" ? "text-ok" : tone === "down" ? "text-bad" : "text-mute"}`}
        >
          {sub}
        </span>
      )}
    </Link>
  );
}

const RANGES = [7, 15, 30];

// Customers with a birthday or wedding anniversary coming up, ready for a WhatsApp wish later
function Birthdays() {
  const [days, setDays] = useState(7);
  const { data, error } = useFetch("/admin/birthdays", { days });
  const [open, setOpen] = useState(null);
  return (
    <div className="card">
      <div className="card-h">
        <h3 className="flex-1">Upcoming birthdays & anniversaries</h3>
        <div className="seggrp" role="group" aria-label="How far ahead">
          {RANGES.map((n) => (
            <button
              key={n}
              type="button"
              className={`seg !min-h-[30px] !px-3 !text-xs ${days === n ? "on" : ""}`}
              aria-pressed={days === n}
              onClick={() => setDays(n)}
            >
              {n} days
            </button>
          ))}
        </div>
      </div>
      <div className="card-b max-h-[420px] overflow-y-auto">
        {data?.days === days && data.items.length > 0 && (
          <p className="mb-1 text-xs font-bold muted">
            {data.items.length} in the next {days} days
          </p>
        )}
        {error ? (
          <p className="text-sm text-bad">{error}</p>
        ) : !data || data.days !== days ? (
          <Skeleton className="h-24" />
        ) : !data.items.length ? (
          <p className="py-6 text-center text-sm muted">
            No birthdays or anniversaries in the next {days} days.
          </p>
        ) : (
          data.items.map((b) => (
            <button
              key={`${b.id}-${b.kind}`}
              type="button"
              className="mini"
              onClick={() => setOpen(b)}
            >
              <span className="w-[78px] flex-none text-[13px] font-extrabold">
                {inDaysLabel(b.inDays)}
                <span className="block text-[11.5px] font-semibold muted">
                  {fmtDob({
                    day: Number(b.date.slice(8)),
                    month: Number(b.date.slice(5, 7)),
                  })}
                </span>
              </span>
              <span
                className={
                  b.kind === "anniversary"
                    ? "flex-none text-[#C2185B]"
                    : "flex-none text-[#B7791F]"
                }
                title={
                  b.kind === "anniversary" ? "Wedding anniversary" : "Birthday"
                }
              >
                {b.kind === "anniversary" ? (
                  <Heart size={17} aria-label="Anniversary" />
                ) : (
                  <Cake size={17} aria-label="Birthday" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="nm block truncate text-sm font-bold">
                  {b.name || b.phone || b.email}
                </span>
                <span className="block truncate text-xs muted">
                  {[
                    b.kind === "anniversary"
                      ? b.years
                        ? `${ordinal(b.years)} anniversary`
                        : "Anniversary"
                      : b.years
                        ? `turns ${b.years}`
                        : "Birthday",
                    b.phone,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              {b.whatsapp.optIn ? (
                <Badge cls="b-ok">WhatsApp OK</Badge>
              ) : (
                <Badge cls="b-mute">No consent</Badge>
              )}
            </button>
          ))
        )}
      </div>
      <CustomerCard
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        email={open?.email}
        phone={open?.phone}
        name={open?.name}
      />
    </div>
  );
}

const delta = (a, b) =>
  !b
    ? a
      ? "New this week"
      : "—"
    : `${a >= b ? "+" : "−"}${Math.abs(((a - b) / b) * 100).toFixed(1)}% vs prior 7 days`;

function PickupList({ title, orders, date }) {
  return (
    <div className="card">
      <div className="card-h">
        <h3 className="flex-1">{title}</h3>
        <span className="text-xs font-bold muted">{fmtDate(date)}</span>
        <Link
          to={`/admin/calendar?date=${date}`}
          className="btn btn-ghost btn-xs"
        >
          Calendar
        </Link>
      </div>
      <div className="card-b">
        {!orders.length ? (
          <p className="py-6 text-center text-sm muted">No pickups booked.</p>
        ) : (
          orders.slice(0, 8).map((o) => (
            <Link
              key={o._id}
              to={`/admin/orders?open=${o._id}`}
              className="mini"
            >
              <span className="w-[72px] flex-none text-[13px] font-extrabold">
                {t12(o.pickupTime)}
                <span className="block text-[11.5px] font-semibold muted">
                  {o.orderNumber}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="nm block truncate text-sm font-bold">
                  {o.customer.name}
                </span>
                <span className="block truncate text-xs muted">
                  {o.items
                    .map((i) => `${i.qty}× ${i.name} ${sizeLabel(i.variant)}`)
                    .join(", ")}
                </span>
              </span>
              <Badge>{o.status}</Badge>
            </Link>
          ))
        )}
        {orders.length > 8 && (
          <Link
            to={`/admin/orders?date=${date}`}
            className="btn btn-ghost btn-sm mt-2 w-full"
          >
            View all {orders.length}
          </Link>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, can } = useAuth();
  const go = useNavigate();
  const { data: d, error, reload } = useFetch("/admin/dashboard");
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!d)
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-28" />
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(158px,1fr))]">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-[124px]" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  const k = d.kpis;
  const hour = bakeryDate().getHours();
  return (
    <>
      <section className="welcome flex flex-wrap items-center gap-4">
        <div className="relative z-10 flex-1">
          <h2 className="text-3xl text-[#FFF4E6]">
            Good {hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"},{" "}
            {user.name.split(" ")[0]}
          </h2>
          <p className="mt-1 text-[14.5px] text-[#EBD3BE]">
            {fmtLong(d.today)} ·{" "}
            {d.todayPickups.filter((o) => o.status !== "Collected").length}{" "}
            pickups still to go today · {d.production.length} orders to prepare
            for today and tomorrow
          </p>
        </div>
        <div className="relative z-10 flex flex-wrap gap-2">
          {can("orders") && (
            <Link to="/admin/orders?new=1" className="btn btn-gold btn-sm">
              <Plus size={15} /> Phone order
            </Link>
          )}
          {can("production") && (
            <Link to="/admin/production" className="btn btn-light btn-sm">
              <ChefHat size={15} /> Production board
            </Link>
          )}
        </div>
      </section>

      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(158px,100%),1fr))]">
        <Kpi
          label="Revenue · last 7 days"
          value={money0(k.revenue7d)}
          sub={delta(k.revenue7d, k.revenuePrev7d)}
          tone={k.revenue7d >= k.revenuePrev7d ? "up" : "down"}
          to="/admin/reports"
        />
        <Kpi
          label="Orders · last 7 days"
          value={k.orders7d}
          sub={`${k.totalOrders} all time`}
          to="/admin/orders"
        />
        <Kpi
          label="Pending / confirmed"
          value={k.pendingOrders}
          sub="Not yet in production"
          to="/admin/orders?status=Confirmed&date=upcoming"
        />
        <Kpi
          label="Upcoming pickups · 7 days"
          value={k.upcomingPickups}
          sub="Excludes collected"
          to="/admin/calendar?view=week"
        />
        <Kpi
          label="Outstanding payments"
          value={money(k.outstandingAmount)}
          sub={`${k.outstandingCount} orders`}
          tone={k.outstandingCount ? "down" : undefined}
          to="/admin/orders?payment=outstanding"
        />
      </div>

      <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr))]">
        <PickupList
          title="Today’s pickups"
          orders={d.todayPickups}
          date={d.today}
        />
        <PickupList
          title="Tomorrow’s pickups"
          orders={d.tomorrowPickups}
          date={d.tomorrow}
        />
      </div>

      <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))]">
        {can("customers") && <Birthdays />}
        <div className="card">
          <div className="card-h">
            <h3 className="flex-1">Production queue</h3>
            <Link to="/admin/production" className="btn btn-ghost btn-xs">
              Board <ArrowRight size={13} />
            </Link>
          </div>
          <div className="card-b">
            {!d.production.length ? (
              <p className="py-6 text-center text-sm muted">
                Nothing waiting to be made.
              </p>
            ) : (
              d.production.slice(0, 7).map((o) => (
                <Link
                  key={o._id}
                  to={`/admin/production?date=${o.pickupDate}`}
                  className="mini"
                >
                  <span className="min-w-0 flex-1">
                    <span className="nm block truncate text-sm font-bold">
                      {o.items[0].name} {sizeLabel(o.items[0].variant)}
                      {o.items.length > 1 ? ` +${o.items.length - 1}` : ""}
                    </span>
                    <span className="text-xs muted">
                      {o.orderNumber} · {fmtDate(o.pickupDate)}{" "}
                      {t12(o.pickupTime)}
                      {o.baker ? ` · ${o.baker}` : ""}
                    </span>
                  </span>
                  {o.priority === "High" && <Badge>High</Badge>}
                  <Badge>{o.status}</Badge>
                </Link>
              ))
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-h">
            <h3 className="flex-1">Popular products · 30 days</h3>
            <Link to="/admin/reports" className="btn btn-ghost btn-xs">
              Reports
            </Link>
          </div>
          <div className="card-b">
            {d.bestsellers.map((b) => (
              <div
                key={b.name}
                className="flex items-center gap-3 border-b border-line-2 py-2.5 last:border-0"
              >
                <ProductImage
                  src={b.image}
                  name={b.name}
                  category={b.category}
                  className="h-[42px] w-[42px] flex-none overflow-hidden rounded-[10px] object-cover"
                />
                <span className="flex-1 text-sm font-bold">
                  {b.name}
                  <span className="block text-xs font-semibold muted">
                    {b.qty} sold
                  </span>
                </span>
                <b className="text-sm num">{money0(b.revenue)}</b>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-h">
            <h3 className="flex-1">Needs attention</h3>
          </div>
          <div className="card-b flex flex-col gap-2.5">
            {d.newEnquiries.map((e) => (
              <Link
                key={e._id}
                to={`/admin/enquiries?open=${e._id}`}
                className="att"
              >
                <CakeSlice size={18} className="text-info" />
                <span className="flex-1 text-sm">
                  <b>{e.reference}</b> · new {e.occasion.toLowerCase()} enquiry
                  from {e.name}
                  <span className="block text-xs muted">
                    Needed {fmtDate(e.requiredDate)}
                  </span>
                </span>
              </Link>
            ))}
            {d.lowStock.map((p) => (
              <Link
                key={p._id}
                to={`/admin/products?edit=${p._id}`}
                className="att"
              >
                <AlertTriangle
                  size={18}
                  className={
                    p.stockStatus === "Low stock" ? "text-warn" : "text-bad"
                  }
                />
                <span className="flex-1 text-sm">
                  <b>{p.name}</b> ·{" "}
                  {p.available ? p.stockStatus : "Hidden from ordering"}
                  {p.stockQty != null ? ` (${p.stockQty} left)` : ""}
                </span>
              </Link>
            ))}
            {!d.newEnquiries.length && !d.lowStock.length && (
              <p className="py-6 text-center text-sm muted">All clear.</p>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h3 className="flex-1">Recent orders</h3>
          <Link to="/admin/orders" className="btn btn-ghost btn-xs">
            <ClipboardList size={13} /> All orders
          </Link>
        </div>
        <div className="card-b !pt-3">
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Placed</th>
                  <th>Customer</th>
                  <th>Pickup</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {d.recentOrders.map((o) => (
                  <tr
                    key={o._id}
                    className="click"
                    tabIndex={0}
                    onClick={() => go(`/admin/orders?open=${o._id}`)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && go(`/admin/orders?open=${o._id}`)
                    }
                  >
                    <td className="font-extrabold text-wine">
                      {o.orderNumber}
                    </td>
                    <td className="text-xs muted">{fmtStamp(o.createdAt)}</td>
                    <td>{o.customer.name}</td>
                    <td>
                      {fmtDate(o.pickupDate)} {t12(o.pickupTime)}
                    </td>
                    <td className="num font-bold">{money(o.total)}</td>
                    <td>
                      <Badge>{o.paymentStatus}</Badge>
                    </td>
                    <td>
                      <Badge>{o.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
