import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CakeSlice, Clock, MapPin } from "lucide-react";

const CSS = `
/* same flat background as the reviews section below, so the two read as one */
.hl { position: relative; padding: 96px 0 32px; background: #F7F7F7; }

.hl-grid { position: relative; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr)); gap: 22px; }

.hl-card { position: relative; display: flex; flex-direction: column; gap: 14px; min-height: 250px; padding: 30px 28px 26px; border-radius: 22px; background: #fff; color: #111; text-decoration: none; overflow: hidden; isolation: isolate;
  box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 10px 30px rgba(0,0,0,.05);
  opacity: 0; transform: translateY(28px);
  transition: opacity .7s cubic-bezier(.2,.7,.2,1), transform .7s cubic-bezier(.2,.7,.2,1), box-shadow .35s; }
.hl-card.in { opacity: 1; transform: none; }
.hl-card:hover { transform: translateY(-6px); box-shadow: 0 2px 4px rgba(0,0,0,.05), 0 24px 48px rgba(0,0,0,.12); color: #111; }
/* black fill that rises from the bottom on hover */
.hl-card::before { content: ''; position: absolute; inset: 0; z-index: -1; background: #111; transform: translateY(110%); transition: transform .5s cubic-bezier(.7,0,.2,1); }
.hl-card:hover::before, .hl-card:focus-visible::before { transform: none; }
.hl-card:hover, .hl-card:focus-visible { color: #fff; }

.hl-num { position: absolute; right: 18px; top: 4px; font-size: 92px; font-weight: 800; line-height: 1; letter-spacing: -.04em; color: #F1F1F1; transition: color .4s, transform .5s; z-index: -1; }
.hl-card:hover .hl-num, .hl-card:focus-visible .hl-num { color: #262626; transform: translateY(6px); }

.hl-ico { width: 58px; height: 58px; display: flex; align-items: center; justify-content: center; border-radius: 18px; background: #111; color: #fff; transition: background .4s, color .4s, transform .5s cubic-bezier(.3,1.6,.5,1); }
.hl-ico svg { animation: hl-float 3.6s ease-in-out infinite; }
.hl-card:nth-child(2) .hl-ico svg { animation-delay: .6s; }
.hl-card:nth-child(3) .hl-ico svg { animation-delay: 1.2s; }
@keyframes hl-float { 50% { transform: translateY(-3px) rotate(-6deg); } }
.hl-card:hover .hl-ico, .hl-card:focus-visible .hl-ico { background: #fff; color: #111; transform: rotate(-8deg) scale(1.08); }

.hl-card h3 { margin-top: 8px; font-size: 21px; font-weight: 800; letter-spacing: -.01em; }
.hl-card p { flex: 1; font-size: 15px; line-height: 1.6; color: #5A5A5A; transition: color .4s; }
.hl-card:hover p, .hl-card:focus-visible p { color: #CFCFCF; }

.hl-go { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; font-size: 14px; font-weight: 800; }
.hl-go span { background: linear-gradient(currentColor, currentColor) 0 100% / 0 2px no-repeat; transition: background-size .35s; padding-bottom: 2px; }
.hl-card:hover .hl-go span, .hl-card:focus-visible .hl-go span { background-size: 100% 2px; }
.hl-go svg { transition: transform .35s; }
.hl-card:hover .hl-go svg, .hl-card:focus-visible .hl-go svg { transform: translate(3px, -3px); }

@media (prefers-reduced-motion: reduce) {
  .hl-ico svg { animation: none; }
  .hl-card { opacity: 1; transform: none; transition: none; }
  .hl-card::before { transition: none; }
}
`;

// Three reasons to order: each card fades up as it scrolls into view and fills black on hover
export default function Highlights({ address = "" }) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  // The stagger is only for the entrance; hover should react straight away
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!seen) return undefined;
    const t = setTimeout(() => setSettled(true), 1100);
    return () => clearTimeout(t);
  }, [seen]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (!("IntersectionObserver" in window)) {
      setSeen(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || "Patiala Bakers Belmont VIC")}`;
  const cards = [
    {
      Icon: CakeSlice,
      title: "Baked to order",
      text: "Cakes are baked for your pickup day, never frozen ahead.",
      go: "Browse cakes",
      to: "/shop?category=cakes",
    },
    {
      Icon: Clock,
      title: "Choose your pickup slot",
      text: "Pick a date and time at checkout. Full slots are hidden automatically.",
      go: "Start an order",
      to: "/shop",
    },
    {
      Icon: MapPin,
      title: "Pickup in Belmont",
      text: address || "Belmont, Geelong",
      go: "Get directions",
      href: maps,
    },
  ];

  return (
    <section className="hl" ref={ref}>
      <style>{CSS}</style>
      <div className="wrap">
        <div className="hl-grid">
          {cards.map(({ Icon, title, text, go, to, href }, i) => {
            const inner = (
              <>
                <span className="hl-num" aria-hidden="true">
                  0{i + 1}
                </span>
                <span className="hl-ico">
                  <Icon size={26} aria-hidden="true" />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
                <span className="hl-go">
                  <span>{go}</span>
                  <ArrowUpRight size={16} aria-hidden="true" />
                </span>
              </>
            );
            const props = {
              className: `hl-card${seen ? " in" : ""}`,
              style: {
                transitionDelay: seen && !settled ? `${i * 120}ms` : "0ms",
              },
            };
            return href ? (
              <a
                key={title}
                href={href}
                target="_blank"
                rel="noreferrer"
                {...props}
              >
                {inner}
              </a>
            ) : (
              <Link key={title} to={to} {...props}>
                {inner}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
