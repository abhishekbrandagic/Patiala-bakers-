import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Star } from "lucide-react";

/*
 * Customer reviews. Put REAL reviews here (copied from Google, Facebook or messages customers sent),
 * with the customer's permission. Leave `when` empty if you don't know it.
 * The "Sample reviews" tag shows until SAMPLE is set to false.
 */
export const REVIEWS = [
  {
    text: "The rasmalai cake was the star of my mum’s 60th. Nobody believed it was eggless.",
    name: "Harpreet K.",
    when: "",
    stars: 5,
    about: "Birthday cake",
  },
  {
    text: "Ordered online, picked up exactly on time, and the samosas were still warm. Our office Friday tradition now.",
    name: "Jack T.",
    when: "",
    stars: 5,
    about: "Snacks & meals",
  },
  {
    text: "They turned a Pinterest photo into the most beautiful two-tier engagement cake. Quoted the same day.",
    name: "Simran G.",
    when: "",
    stars: 5,
    about: "Custom cake",
  },
  {
    text: "The barfi and ladoo box for Diwali was gone in minutes. Tastes just like home.",
    name: "Priya S.",
    when: "",
    stars: 5,
    about: "Indian sweets",
  },
  {
    text: "Picked a slot at checkout and the cake was boxed and ready when I walked in. So easy.",
    name: "Daniel M.",
    when: "",
    stars: 5,
    about: "Online order",
  },
  {
    text: "Finally an eggless chocolate cake that’s actually rich and moist. My kids loved it.",
    name: "Neha R.",
    when: "",
    stars: 5,
    about: "Birthday cake",
  },
  {
    text: "Great chai biscuits and nankhatai. We grab a box every weekend.",
    name: "Gurpreet S.",
    when: "",
    stars: 5,
    about: "Breads & biscuits",
  },
  {
    text: "Friendly team who helped me pick a vegan cake for a work farewell. Everyone asked where it was from.",
    name: "Emily W.",
    when: "",
    stars: 5,
    about: "Vegan cake",
  },
  {
    text: "Samosa chaat on a cold Geelong evening — perfect. Generous portions too.",
    name: "Arjun P.",
    when: "",
    stars: 4,
    about: "Snacks & meals",
  },
];
const SAMPLE = true;

/*
 * Rating summary shown under the heading, e.g. "4.9/5 · Google · Based on 120 reviews".
 * Only fill this in with your real numbers from Google (or wherever the reviews are); it stays hidden while rating is null.
 */
const SUMMARY = { rating: null, count: null, source: "Google", url: "" };

const AUTOPLAY_MS = 2000;

const CSS = `
.tm { padding: 32px 0 84px; background: #F7F7F7; }
.tm-head { text-align: center; margin-bottom: 48px; }
.tm-head h2 { font-size: clamp(34px, 4.4vw, 52px); line-height: 1.08; color: #111; font-weight: 500; }
.tm-head h2 b { font-weight: 800; display: block; }
.tm-sum { margin-top: 18px; display: inline-flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px 16px; color: #404040; font-size: 15px; }
.tm-sum .src { display: inline-flex; align-items: center; gap: 6px; font-weight: 800; font-size: 19px; color: #111; text-decoration: none; }
.tm-body { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 40px; align-items: start; }
.tm-side .mark { display: block; width: 72px; height: 58px; color: #A3A3A3; }
.tm-side h3 { margin-top: 18px; font-size: 30px; line-height: 1.2; font-weight: 500; color: #111; }
.tm-nav { margin-top: 26px; display: flex; align-items: center; gap: 12px; }
.tm-nav button { width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; color: #111; }
.tm-nav button:hover:not(:disabled) { background: #EAEAEA; }
.tm-nav button:disabled { color: #BDBDBD; cursor: default; }
.tm-bar { position: relative; flex: none; width: 110px; height: 2px; background: #BDBDBD; border-radius: 2px; }
.tm-bar i { position: absolute; top: -1px; height: 4px; border-radius: 4px; background: #111; transition: left .25s, width .25s; }
.tm-track { display: flex; gap: 22px; overflow-x: auto; scroll-snap-type: x mandatory; scroll-behavior: smooth; padding: 4px 4px 8px; margin: -4px -4px 0; scrollbar-width: none; }
.tm-track::-webkit-scrollbar { display: none; }
.tm-item { flex: 0 0 min(300px, 82%); scroll-snap-align: start; display: flex; flex-direction: column; }
/* square bottom-left corner so the tail joins the card; drop-shadow also shades the tail */
.tm-card { position: relative; flex: 1; display: flex; flex-direction: column; gap: 18px; background: #fff; border-radius: 16px 16px 16px 0; padding: 26px 28px 22px; filter: drop-shadow(0 2px 6px rgba(0,0,0,.05)); }
/* the little speech-bubble tail under the card */
.tm-card::after { content: ''; position: absolute; left: 0; bottom: -23px; width: 30px; height: 24px; background: #fff; clip-path: polygon(0 0, 100% 0, 0 100%); }
.tm-card p { flex: 1; font-size: 15px; line-height: 1.6; color: #333; }
.tm-stars { display: flex; gap: 3px; color: #111; }
.tm-who { display: flex; align-items: center; gap: 12px; padding: 20px 0 0 26px; }
.tm-who .tm-av { width: 44px; height: 44px; flex: none; border-radius: 50%; background: #111; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; }
.tm-who b { display: block; font-size: 16px; font-weight: 600; color: #111; line-height: 1.2; }
.tm-who > span:last-child > span { display: block; font-size: 12px; color: #6B6B6B; }
.tm-tag { display: inline-block; margin-top: 14px; padding: 4px 10px; border-radius: 999px; background: #EAEAEA; font-size: 12px; font-weight: 700; color: #404040; }
@media (max-width: 860px) {
  .tm-body { grid-template-columns: 1fr; gap: 24px; }
  .tm-side { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 20px; }
  .tm-side .mark { display: none; }
  .tm-side h3 { margin: 0; flex: 1; font-size: 24px; }
  .tm-nav { margin: 0; }
}
`;

const initials = (name) =>
  (name.match(/\b[A-Za-z]/g) || ["?"]).join("").slice(0, 2).toUpperCase();

export default function Testimonials({ reviews = REVIEWS }) {
  const track = useRef(null);
  const [pos, setPos] = useState({
    start: 0,
    size: 1,
    atStart: true,
    atEnd: false,
  });

  // Keeps the progress bar and arrows in step with the scroll position
  const measure = () => {
    const el = track.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setPos({
      start: max > 0 ? el.scrollLeft / el.scrollWidth : 0,
      size: el.scrollWidth ? el.clientWidth / el.scrollWidth : 1,
      atStart: el.scrollLeft <= 8,
      atEnd: el.scrollLeft >= max - 8,
    });
  };
  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [reviews.length]);

  // One card left or right; past the last card it goes back to the first, and the other way round
  const step = (dir) => {
    const el = track.current;
    const card = el?.querySelector(".tm-item");
    if (!el || !card) return;
    const max = el.scrollWidth - el.clientWidth;
    if (dir > 0 && el.scrollLeft >= max - 8)
      el.scrollTo({ left: 0, behavior: "smooth" });
    else if (dir < 0 && el.scrollLeft <= 8)
      el.scrollTo({ left: max, behavior: "smooth" });
    else
      el.scrollBy({
        left: dir * (card.getBoundingClientRect().width + 22),
        behavior: "smooth",
      });
  };

  // Slides right to left on its own every few seconds; stops while someone is reading or using it
  const [paused, setPaused] = useState(false);
  const resumeAt = useRef(0);
  useEffect(() => {
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced || paused || reviews.length < 2) return undefined;
    const timer = setInterval(() => {
      if (Date.now() >= resumeAt.current && !document.hidden) step(1);
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [paused, reviews.length]); // eslint-disable-line react-hooks/exhaustive-deps
  // After an arrow click or a swipe, wait a little before sliding again
  const nudge = (dir) => {
    resumeAt.current = Date.now() + AUTOPLAY_MS * 2;
    step(dir);
  };

  if (!reviews.length) return null;
  const showSummary = SUMMARY.rating != null;

  return (
    <section className="tm" aria-labelledby="tm-title">
      <style>{CSS}</style>
      <div className="wrap">
        <div className="tm-head">
          <h2 id="tm-title">
            Read reviews,<b>order with confidence.</b>
          </h2>
          {showSummary && (
            <div className="tm-sum">
              <span>{SUMMARY.rating}/5</span>
              {SUMMARY.url ? (
                <a
                  className="src"
                  href={SUMMARY.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Star size={22} fill="currentColor" aria-hidden="true" />
                  {SUMMARY.source}
                </a>
              ) : (
                <span className="src">
                  <Star size={22} fill="currentColor" aria-hidden="true" />
                  {SUMMARY.source}
                </span>
              )}
              {SUMMARY.count != null && (
                <span>Based on {SUMMARY.count} reviews</span>
              )}
            </div>
          )}
          {SAMPLE && (
            <div>
              <span className="tm-tag">Our Customers</span>
            </div>
          )}
        </div>

        <div className="tm-body">
          <div className="tm-side">
            {/* solid opening quote mark, like the design */}
            <svg
              className="mark"
              viewBox="0 0 72 58"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M30 6C17 9 6 20 6 36v14a6 6 0 0 0 6 6h14a6 6 0 0 0 6-6V36a6 6 0 0 0-6-6h-9c1-7 6-12 13-14z" />
              <path d="M68 6C55 9 44 20 44 36v14a6 6 0 0 0 6 6h14a6 6 0 0 0 6-6V36a6 6 0 0 0-6-6h-9c1-7 6-12 13-14z" />
            </svg>
            <h3>What our customers are saying</h3>
            <div className="tm-nav">
              <button
                type="button"
                onClick={() => nudge(-1)}
                aria-label="Previous reviews"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="tm-bar" aria-hidden="true">
                <i
                  style={{
                    left: `${pos.start * 100}%`,
                    width: `${Math.max(pos.size, 0.12) * 100}%`,
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => nudge(1)}
                aria-label="Next reviews"
              >
                <ArrowRight size={20} />
              </button>
            </div>
          </div>

          <div
            className="tm-track"
            ref={track}
            onScroll={measure}
            tabIndex={0}
            aria-label="Customer reviews"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
            onTouchStart={() => {
              resumeAt.current = Date.now() + AUTOPLAY_MS * 2;
            }}
          >
            {reviews.map((r) => (
              <figure key={r.name + r.text.slice(0, 20)} className="tm-item">
                <div className="tm-card">
                  <p>{r.text}</p>
                  <div
                    className="tm-stars"
                    aria-label={`${r.stars} out of 5 stars`}
                  >
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        size={16}
                        fill={i < r.stars ? "currentColor" : "none"}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                </div>
                <figcaption className="tm-who">
                  <span className="tm-av" aria-hidden="true">
                    {initials(r.name)}
                  </span>
                  <span>
                    <b>{r.name}</b>
                    <span>{[r.about, r.when].filter(Boolean).join(" · ")}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
