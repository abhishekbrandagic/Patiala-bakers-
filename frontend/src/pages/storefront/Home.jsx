// import { useEffect, useState } from 'react';
// import { Link } from 'react-router-dom';
// import { ArrowRight, Clock, Egg, Leaf, Sparkles, WheatOff } from 'lucide-react';
// import { api } from '../../api/client.js';
// import ProductCard, { ProductCardSkeleton } from '../../components/ProductCard.jsx';
// import ProductImage from '../../components/ProductImage.jsx';
// import Testimonials from '../../components/Testimonials.jsx';
// import Highlights from '../../components/Highlights.jsx';
// import { useSettings } from '../../context/SettingsContext.jsx';
// import { t12 } from '../../utils/format.js';

// const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// const CAT_IMG = {
//   cakes: '/images/categories/cakes.png',
//   'custom-cakes': '/images/categories/custom-cakes.png',
//   sweets: '/images/categories/sweets.png',
//   snacks: '/images/categories/snacks.png',
//   breads: '/images/categories/breads.png',
// };

// export default function Home() {
//   const { settings, categories } = useSettings();
//   const [best, setBest] = useState(null);
//   const [popular, setPopular] = useState(null);

//   useEffect(() => {
//     api.get('/products', { params: { category: 'cakes', limit: 4 } }).then(({ data }) => setBest(data.items)).catch(() => setBest([]));
//     api.get('/products', { params: { bestseller: '1', limit: 8 } }).then(({ data }) => setPopular(data.items.filter((p) => p.category !== 'cakes').slice(0, 4))).catch(() => setPopular([]));
//   }, []);

//   const today = new Date().getDay();
//   const s = settings;
//   const p = s?.prepHours;

//   return (
//     <>
//       {/* Hero */}
//       <section className="hero">
//         <div className="wrap grid items-center gap-12 pb-[72px] pt-16 [grid-template-columns:repeat(auto-fit,minmax(min(460px,100%),1fr))]">
//           <div>
//             <p className="eyebrow">Belmont · Geelong · Since 2016</p>
//             <h1 className="mt-4">Celebration cakes, <em>eggless</em> by default.</h1>
//             <p className="mt-6 max-w-[520px] text-lg text-ink-2">Punjabi-family recipes, desi ghee mithai and fresh-baked snacks. Order online, choose a pickup time, and we’ll have it boxed and ready.</p>
//             <div className="mt-8 flex flex-wrap gap-3">
//               <Link to="/shop?category=cakes" className="btn btn-p btn-lg">Order a cake <ArrowRight size={18} /></Link>
//               <Link to="/custom-cakes" className="btn btn-o btn-lg">Design a custom cake</Link>
//             </div>
//             <div className="mt-9 flex flex-wrap gap-x-6 gap-y-2.5 text-[13.5px] font-semibold text-ink-2">
//               {[[Egg, 'Eggless cakes'], [Leaf, 'Vegan options'], [WheatOff, 'Gluten-free upgrades'], [Clock, `${p?.cakes ?? 48}h notice`]].map(([I, t]) => (
//                 <span key={t} className="inline-flex items-center gap-2"><i className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-gold-bg text-gold-d"><I size={13} /></i>{t}</span>
//               ))}
//             </div>
//           </div>
//           <div className="relative min-h-[380px] sm:min-h-[520px]">
//             <div className="arch-ring" />
//            <div className="arch"><img src="/images/hero-main.png" alt="Celebration cake from Patiala Bakers" /></div>
// <div className="float bottom-[6%] left-[-2%]"><img src="/images/hero-left-ladoo.png" alt="Indian sweets from Patiala Bakers" /></div>
// <div className="float right-[-2%] top-[10%] !w-[34%]"><img src="/images/hero-right-samosa.png" alt="Fresh snacks from Patiala Bakers" /></div>
//             <div className="stamp"><b>100%</b><span>Eggless cakes</span></div>
//           </div>
//         </div>
//       </section>

//       {/* Categories */}
//       <section className="py-[84px]">
//         <div className="wrap">
//           <div className="mb-8 flex flex-wrap items-end gap-5">
//             <div className="flex-1"><p className="eyebrow">The menu</p><h2 className="sec-title">Something for every table</h2></div>
//             <Link to="/shop" className="btn btn-o">See the full menu <ArrowRight size={16} /></Link>
//           </div>
//           <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(min(250px,100%),1fr))]">
//             {categories.filter((c) => !['breads', 'biscuits'].includes(c.id)).concat([{ id: 'breads', name: 'Breads & Biscuits', blurb: 'Loaves, nankhatai and chai biscuits' }]).map((c) => (
//               <Link key={c.id} to={c.id === 'custom-cakes' ? '/custom-cakes' : `/shop?category=${c.id}`} className="catcard">
//                 <div className="aspect-[4/3] overflow-hidden"><ProductImage src={CAT_IMG[c.id]} name={c.name} category={c.id} className="h-full w-full object-cover" /></div>
//                 <div className="flex items-center gap-3 px-5 pb-5 pt-[18px]">
//                   <div className="flex-1"><h3 className="font-serif text-[26px] text-wine-ink">{c.name}</h3><p className="text-[13.5px] muted">{c.blurb}</p></div>
//                   <span className="arrow"><ArrowRight size={18} /></span>
//                 </div>
//               </Link>
//             ))}
//           </div>
//         </div>
//       </section>

//       {/* Featured cakes */}
//       <section className="pb-[84px]">
//         <div className="wrap">
//           <div className="mb-8 flex flex-wrap items-end gap-5">
//             <div className="flex-1"><p className="eyebrow">Bestselling cakes</p><h2 className="sec-title">Baked to order, eggless every time</h2></div>
//             <Link to="/shop?category=cakes" className="btn btn-o">All cakes <ArrowRight size={16} /></Link>
//           </div>
//           <div className="pgrid">{best ? best.map((x) => <ProductCard key={x._id} p={x} />) : Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />)}</div>
//         </div>
//       </section>

//       {/* Dietary band */}
//       <section className="band">
//         <div className="wrap relative grid items-center gap-10 py-[72px] [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
//           <div>
//             <p className="eyebrow !text-[#EED39A]">Dietary friendly</p>
//             <h2 className="mt-3 text-[clamp(38px,4.6vw,60px)] leading-none text-[#FFF4E6]">Everyone gets <em className="text-[#EED39A]">a slice.</em></h2>
//             <p className="mt-[18px] max-w-[520px] text-[17px] text-[#EBD6C2]">Our cakes are made without eggs. Where a vegan or gluten-free version is possible, you’ll see it as an option on the product page — with the allergens listed, so you always know what’s inside.</p>
//             <Link to="/shop?vegan=1" className="btn btn-gold btn-lg mt-7">Shop dietary options</Link>
//           </div>
//           <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
//             <div className="pt"><b>Eggless</b><span className="text-sm text-[#EAD8C6]">Every cake on the menu, at no extra cost.</span></div>
//             <div className="pt"><b>Vegan</b><span className="text-sm text-[#EAD8C6]">Dairy-free sponge and cream on selected cakes.</span></div>
//             <div className="pt"><b>Gluten-free</b><span className="text-sm text-[#EAD8C6]">GF sponge upgrade where listed. Kitchen handles wheat.</span></div>
//             <div className="pt"><b>Allergens listed</b><span className="text-sm text-[#EAD8C6]">Every product shows its allergen information.</span></div>
//           </div>
//         </div>
//       </section>

//       {/* Custom cakes */}
//       <section className="py-[84px]">
//         <div className="wrap grid items-center gap-14 [grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr))]">
//           <div className="relative aspect-[5/4] overflow-hidden rounded-3xl shadow-2">
//             <img src="/images/custom cake.png" alt="Custom celebration cake with gold leaf and florals" className="h-full w-full object-cover" />
//             <div className="absolute bottom-[18px] left-[18px] rounded-[14px] bg-paper/95 px-4 py-3 shadow-1"><p className="eyebrow">Custom cakes</p><b>Quotes within 24 hours</b></div>
//           </div>
//           <div>
//             <p className="eyebrow">Weddings · Engagements · Birthdays</p>
//             <h2 className="sec-title">Your idea, our bakers</h2>
//             <div className="my-7 flex flex-col gap-[18px]">
//               {[['Tell us the occasion', 'Servings, date, colours and any reference photos.'], ['Get a quote', 'We reply with an itemised quote, usually the same day.'], [`Confirm with a ${s?.payments?.depositPercent ?? 50}% deposit`, `Custom designs need at least ${Math.round((p?.['custom-cakes'] ?? 120) / 24)} days notice.`]].map(([h, t], i) => (
//                 <div key={h} className="flex items-start gap-4">
//                   <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full border-[1.5px] border-gold font-serif text-xl font-bold text-wine">{i + 1}</span>
//                   <div><h4 className="text-base font-extrabold">{h}</h4><p className="muted">{t}</p></div>
//                 </div>
//               ))}
//             </div>
//             <Link to="/custom-cakes" className="btn btn-p btn-lg"><Sparkles size={18} /> Start a custom cake enquiry</Link>
//           </div>
//         </div>
//       </section>

//       {/* Popular non-cake */}
//       <section className="pb-[84px]">
//         <div className="wrap">
//           <div className="mb-8 flex flex-wrap items-end gap-5">
//             <div className="flex-1"><p className="eyebrow">Popular right now</p><h2 className="sec-title">Mithai, samosas & more</h2></div>
//             <Link to="/shop" className="btn btn-o">Full menu <ArrowRight size={16} /></Link>
//           </div>
//           <div className="pgrid">{popular ? popular.map((x) => <ProductCard key={x._id} p={x} />) : Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />)}</div>
//         </div>
//       </section>

//       {/* Info */}
//       <Highlights address={settings?.business?.address || ''} />

//       <Testimonials />

//       {/* Location & hours */}
//       <section className="py-[84px]">
//         <div className="wrap grid gap-[22px] [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
//         <div className="relative min-h-[360px] overflow-hidden rounded-[20px] border border-line-2">
//   <iframe
//     title="Patiala Bakers on Google Maps"
//     src={`https://www.google.com/maps?q=${encodeURIComponent(settings?.business?.address || 'Patiala Bakers Belmont VIC')}&output=embed`}
//     className="absolute inset-0 h-full w-full border-0"
//     loading="lazy"
//     referrerPolicy="no-referrer-when-downgrade"
//     allowFullScreen
//   />
// </div>
//           <div className="card card-b">
//             <p className="eyebrow">Visit us</p>
//             <h2 className="sec-title">Pickup from Belmont</h2>
//             <p className="mt-2 text-ink-2">{settings?.business?.address}</p>
//             <div className="mt-6 flex flex-col">
//               {settings?.hours?.map((h, i) => (
//                 <div key={i} className={`flex justify-between border-b border-dashed border-line py-2.5 text-[14.5px] ${i === today ? 'font-extrabold text-wine' : ''}`}>
//                   <span>{WD[i]}{i === today ? ' (today)' : ''}</span><span>{h.closed ? 'Closed' : `${t12(h.open)} – ${t12(h.close)}`}</span>
//                 </div>
//               ))}
//             </div>
//             <div className="mt-6 flex flex-wrap gap-3"><Link to="/contact" className="btn btn-p">Contact & directions</Link><a className="btn btn-o" href={`tel:${settings?.business?.phone?.replace(/\s/g, '')}`}>Call {settings?.business?.phone}</a></div>
//           </div>
//         </div>
//       </section>
//     </>
//   );
// }

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, Egg, Leaf, Sparkles, WheatOff } from 'lucide-react';
import { api } from '../../api/client.js';
import ProductCard, { ProductCardSkeleton } from '../../components/ProductCard.jsx';
import ProductImage from '../../components/ProductImage.jsx';
import Testimonials from '../../components/Testimonials.jsx';
import Highlights from '../../components/Highlights.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { t12 } from '../../utils/format.js';

const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const CAT_IMG = {
  cakes: '/images/categories/cakes.png',
  'custom-cakes': '/images/categories/custom-cakes.png',
  sweets: '/images/categories/sweets.png',
  snacks: '/images/categories/snacks.png',
  breads: '/images/categories/breads.png',
};
const CAT_IMG = { cakes: '/images/rasmalai-cake.svg', 'custom-cakes': '/images/custom-cake.svg', sweets: '/images/ladoo.svg', snacks: '/images/samosa.svg' };

// ── Blog: ideas and guides, shown as a sliding row of cards below "Popular right now" ──
// Photos are from Unsplash (free to use under the Unsplash licence). Each card opens the menu page it talks about.
const unsplash = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=70`;
const BLOGS = [
  { title: 'How to choose the right cake size for your party', tags: ['Cakes', 'Planning'], date: 'Nov 16, 2026', mins: 4, img: unsplash('photo-1606983340126-99ab4feaa64a'), alt: 'Chocolate birthday cake with icing roses', to: '/shop?category=cakes' },
  { title: 'Why our cakes are eggless, and still soft and fluffy', tags: ['Cakes', 'Eggless'], date: 'Nov 12, 2026', mins: 3, img: unsplash('photo-1543773495-2cd9248a5bda'), alt: 'Slices of layered cake', to: '/shop?category=cakes' },
  { title: 'Planning a custom cake: what to tell your baker', tags: ['Custom cakes', 'Tips'], date: 'Nov 08, 2026', mins: 5, img: unsplash('photo-1558301211-0d8c8ddee6ec'), alt: 'Fondant cake on a cake stand', to: '/custom-cakes' },
  { title: 'Your Diwali mithai box: what to pick and how much', tags: ['Indian sweets', 'Festive'], date: 'Nov 05, 2026', mins: 4, img: unsplash('photo-1758910536889-43ce7b3199fd'), alt: 'Colourful Indian sweets in a shop display', to: '/shop?category=sweets' },
  { title: 'Jalebi, ladoo or barfi? Sweets for every occasion', tags: ['Indian sweets'], date: 'Oct 29, 2026', mins: 3, img: unsplash('photo-1778448806852-db6a837fa98f'), alt: 'Golden jalebi on a plate', to: '/shop?category=sweets' },
  { title: 'The perfect samosa platter for office lunches', tags: ['Snacks & meals', 'Entertaining'], date: 'Oct 22, 2026', mins: 3, img: unsplash('photo-1601050690597-df0568f70950'), alt: 'Golden samosas with green chilli', to: '/shop?category=snacks' },
  { title: 'Chai and biscuits: our favourite weekend ritual', tags: ['Biscuits', 'Chai'], date: 'Oct 15, 2026', mins: 2, img: unsplash('photo-1761483281417-778013dc0177'), alt: 'Chai being poured into small clay cups', to: '/shop?category=biscuits' },
  { title: 'Pastel cakes: this season’s favourite colours', tags: ['Cakes', 'Trends'], date: 'Oct 09, 2026', mins: 3, img: unsplash('photo-1761296152332-88ada22be48a'), alt: 'Pastel-coloured cake cut into slices', to: '/shop?category=cakes' },
  { title: 'Make it a moment: candles, sparklers and cake messages', tags: ['Birthdays', 'Tips'], date: 'Oct 02, 2026', mins: 4, img: unsplash('photo-1577998474517-7eeeed4e448a'), alt: 'Cake with a lit sparkler', to: '/shop?category=cakes' },
  { title: 'Ordering ahead: how pickup slots work', tags: ['How it works'], date: 'Sep 25, 2026', mins: 2, img: unsplash('photo-1621303837174-89787a7d4729'), alt: 'Pink and white cake on a plate', to: '/shop' },
];
// Set this to your blog page (for example '/blog') once you have one, and a "View all articles" button appears
const BLOG_INDEX = null;

const BLOG_CSS = `
.bl-head { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 20px; margin-bottom: 34px; }
.bl-track { display: flex; gap: 24px; overflow-x: auto; scroll-snap-type: x mandatory; scroll-padding: 0 16px; scroll-behavior: smooth; scrollbar-width: none; padding: 12px 16px 32px; margin: -12px -16px -18px; }
.bl-track::-webkit-scrollbar { display: none; }
.bl-card { position: relative; flex: 0 0 calc((100% - 48px) / 3); scroll-snap-align: start; display: flex; flex-direction: column; border-radius: 22px; overflow: hidden; background: #F4F4F4; color: #111; text-decoration: none; transition: transform .35s, box-shadow .35s; }
.bl-card { box-shadow: 0 1px 2px rgba(0,0,0,.04); }
.bl-card:hover { transform: translateY(-4px); box-shadow: 0 2px 4px rgba(0,0,0,.04), 0 16px 28px -12px rgba(0,0,0,.22); color: #111; }
.bl-img { position: relative; aspect-ratio: 2 / 1; overflow: hidden; background: linear-gradient(135deg, #E9E9E9, #D9D9D9); }
.bl-img img { width: 100%; height: 100%; object-fit: cover; transition: transform .6s; }
.bl-card:hover .bl-img img { transform: scale(1.06); }
.bl-tags { position: absolute; left: 14px; top: 14px; right: 14px; display: flex; flex-wrap: wrap; gap: 6px; }
.bl-tags span { padding: 4px 11px; border-radius: 999px; background: #fff; font-size: 13px; font-weight: 600; color: #222; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.bl-go { position: absolute; right: 18px; top: calc(50% - 30px); width: 58px; height: 58px; border-radius: 50%; background: #fff; color: #111; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 18px rgba(0,0,0,.15); opacity: 0; transform: scale(.7); transition: opacity .3s, transform .3s; }
.bl-card:hover .bl-go, .bl-card:focus-visible .bl-go { opacity: 1; transform: none; }
.bl-body { flex: 1; padding: 20px 24px 26px; }
.bl-meta { font-size: 14px; color: #555; }
.bl-body h3 { margin-top: 12px; font-size: 22px; line-height: 1.3; font-weight: 800; letter-spacing: -.01em; color: #111; }
.bl-dots { margin-top: 26px; display: flex; justify-content: center; gap: 8px; }
.bl-dots button { width: 8px; height: 8px; border-radius: 999px; background: #C9C9C9; transition: width .3s, background .3s; }
.bl-dots button.on { width: 22px; background: #111; }
@media (max-width: 1023px) { .bl-card { flex-basis: calc((100% - 24px) / 2); } }
@media (max-width: 640px) { .bl-card { flex-basis: 86%; } .bl-body h3 { font-size: 19px; } }
@media (prefers-reduced-motion: reduce) { .bl-track { scroll-behavior: auto; } .bl-card, .bl-img img { transition: none; } }
`;

function BlogCarousel() {
  const track = useRef(null);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);

  // Works out how many "pages" of cards there are and which one is showing
  const measure = () => {
    const el = track.current;
    const card = el?.querySelector('.bl-card');
    if (!el || !card) return;
    const perView = Math.max(1, Math.round(el.clientWidth / (card.getBoundingClientRect().width + 24)));
    const total = Math.max(1, Math.ceil(BLOGS.length / perView));
    const max = el.scrollWidth - el.clientWidth;
    setPages(total);
    setPage(max > 0 ? Math.round((el.scrollLeft / max) * (total - 1)) : 0);
  };
  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  const goTo = (i) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: ((el.scrollWidth - el.clientWidth) * i) / Math.max(1, pages - 1) });
  };

  return (
    <section className="pb-[84px]">
      <style>{BLOG_CSS}</style>
      <div className="wrap">
        <div className="bl-head">
          <div className="flex-1"><p className="eyebrow">From our kitchen</p><h2 className="sec-title">Easy ideas for you</h2></div>
          {BLOG_INDEX && <Link to={BLOG_INDEX} className="btn btn-o">View all articles <ArrowRight size={16} /></Link>}
        </div>
        <div className="bl-track" ref={track} onScroll={measure} aria-label="Articles">
          {BLOGS.map((b) => (
            <Link key={b.title} to={b.to} className="bl-card">
              <div className="bl-img">
                <img src={b.img} alt={b.alt} loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                <div className="bl-tags">{b.tags.map((t) => <span key={t}>{t}</span>)}</div>
                <span className="bl-go" aria-hidden="true"><ArrowRight size={22} /></span>
              </div>
              <div className="bl-body">
                <p className="bl-meta">{b.date} · {b.mins} min read</p>
                <h3>{b.title}</h3>
              </div>
            </Link>
          ))}
        </div>
        {pages > 1 && (
          <div className="bl-dots">
            {Array.from({ length: pages }, (_, i) => <button key={i} type="button" className={i === page ? 'on' : ''} aria-label={`Show articles, page ${i + 1}`} aria-current={i === page} onClick={() => goTo(i)} />)}
          </div>
        )}
      </div>
    </section>
  );
}

export default function Home() {
  const { settings, categories } = useSettings();
  const [best, setBest] = useState(null);
  const [popular, setPopular] = useState(null);

  useEffect(() => {
    api.get('/products', { params: { category: 'cakes', limit: 4 } }).then(({ data }) => setBest(data.items)).catch(() => setBest([]));
    api.get('/products', { params: { bestseller: '1', limit: 8 } }).then(({ data }) => setPopular(data.items.filter((p) => p.category !== 'cakes').slice(0, 4))).catch(() => setPopular([]));
  }, []);

  const today = new Date().getDay();
  const s = settings;
  const p = s?.prepHours;

  return (
    <>
      {/* Hero */}
      <section className="hero">
        <div className="wrap grid items-center gap-12 pb-[72px] pt-16 [grid-template-columns:repeat(auto-fit,minmax(min(460px,100%),1fr))]">
          <div>
            <p className="eyebrow">Belmont · Geelong · Since 2016</p>
            <h1 className="mt-4">Celebration cakes, <em>eggless</em> by default.</h1>
            <p className="mt-6 max-w-[520px] text-lg text-ink-2">Punjabi-family recipes, desi ghee mithai and fresh-baked snacks. Order online, choose a pickup time, and we’ll have it boxed and ready.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/shop?category=cakes" className="btn btn-p btn-lg">Order a cake <ArrowRight size={18} /></Link>
              <Link to="/custom-cakes" className="btn btn-o btn-lg">Design a custom cake</Link>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-2.5 text-[13.5px] font-semibold text-ink-2">
              {[[Egg, 'Eggless cakes'], [Leaf, 'Vegan options'], [WheatOff, 'Gluten-free upgrades'], [Clock, `${p?.cakes ?? 48}h notice`]].map(([I, t]) => (
                <span key={t} className="inline-flex items-center gap-2"><i className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-gold-bg text-gold-d"><I size={13} /></i>{t}</span>
              ))}
            </div>
          </div>
          <div className="relative min-h-[380px] sm:min-h-[520px]">
            <div className="arch-ring" />
            <div className="arch"><img src="/images/rasmalai-cake.svg" alt="Rasmalai cake topped with pistachio and saffron" /></div>
            <div className="float bottom-[6%] left-[-2%]"><img src="/images/ladoo.svg" alt="Motichoor ladoo" /></div>
            <div className="float right-[-2%] top-[10%] !w-[34%]"><img src="/images/samosa.svg" alt="Punjabi samosas with chutney" /></div>
            <div className="stamp"><b>100%</b><span>Eggless cakes</span></div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-[84px]">
        <div className="wrap">
          <div className="mb-8 flex flex-wrap items-end gap-5">
            <div className="flex-1"><p className="eyebrow">The menu</p><h2 className="sec-title">Something for every table</h2></div>
            <Link to="/shop" className="btn btn-o">See the full menu <ArrowRight size={16} /></Link>
          </div>
          <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(min(250px,100%),1fr))]">
            {categories.filter((c) => !['breads', 'biscuits'].includes(c.id)).concat([{ id: 'breads', name: 'Breads & Biscuits', blurb: 'Loaves, nankhatai and chai biscuits' }]).map((c) => (
              <Link key={c.id} to={c.id === 'custom-cakes' ? '/custom-cakes' : `/shop?category=${c.id}`} className="catcard">
                <div className="aspect-[4/3] overflow-hidden"><ProductImage src={CAT_IMG[c.id]} name={c.name} category={c.id} className="h-full w-full object-cover" /></div>
                <div className="flex items-center gap-3 px-5 pb-5 pt-[18px]">
                  <div className="flex-1"><h3 className="font-serif text-[26px] text-wine-ink">{c.name}</h3><p className="text-[13.5px] muted">{c.blurb}</p></div>
                  <span className="arrow"><ArrowRight size={18} /></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured cakes */}
      <section className="pb-[84px]">
        <div className="wrap">
          <div className="mb-8 flex flex-wrap items-end gap-5">
            <div className="flex-1"><p className="eyebrow">Bestselling cakes</p><h2 className="sec-title">Baked to order, eggless every time</h2></div>
            <Link to="/shop?category=cakes" className="btn btn-o">All cakes <ArrowRight size={16} /></Link>
          </div>
          <div className="pgrid">{best ? best.map((x) => <ProductCard key={x._id} p={x} />) : Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />)}</div>
        </div>
      </section>

      {/* Dietary band */}
      <section className="band">
        <div className="wrap relative grid items-center gap-10 py-[72px] [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
          <div>
            <p className="eyebrow !text-[#EED39A]">Dietary friendly</p>
            <h2 className="mt-3 text-[clamp(38px,4.6vw,60px)] leading-none text-[#FFF4E6]">Everyone gets <em className="text-[#EED39A]">a slice.</em></h2>
            <p className="mt-[18px] max-w-[520px] text-[17px] text-[#EBD6C2]">Our cakes are made without eggs. Where a vegan or gluten-free version is possible, you’ll see it as an option on the product page — with the allergens listed, so you always know what’s inside.</p>
            <Link to="/shop?vegan=1" className="btn btn-gold btn-lg mt-7">Shop dietary options</Link>
          </div>
          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
            <div className="pt"><b>Eggless</b><span className="text-sm text-[#EAD8C6]">Every cake on the menu, at no extra cost.</span></div>
            <div className="pt"><b>Vegan</b><span className="text-sm text-[#EAD8C6]">Dairy-free sponge and cream on selected cakes.</span></div>
            <div className="pt"><b>Gluten-free</b><span className="text-sm text-[#EAD8C6]">GF sponge upgrade where listed. Kitchen handles wheat.</span></div>
            <div className="pt"><b>Allergens listed</b><span className="text-sm text-[#EAD8C6]">Every product shows its allergen information.</span></div>
          </div>
        </div>
      </section>

      {/* Custom cakes */}
      <section className="py-[84px]">
        <div className="wrap grid items-center gap-14 [grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr))]">
          <div className="relative aspect-[5/4] overflow-hidden rounded-3xl shadow-2">
            <img src="/images/custom-cake.svg" alt="Custom celebration cake with gold leaf and florals" className="h-full w-full object-cover" />
            <div className="absolute bottom-[18px] left-[18px] rounded-[14px] bg-paper/95 px-4 py-3 shadow-1"><p className="eyebrow">Custom cakes</p><b>Quotes within 24 hours</b></div>
          </div>
          <div>
            <p className="eyebrow">Weddings · Engagements · Birthdays</p>
            <h2 className="sec-title">Your idea, our bakers</h2>
            <div className="my-7 flex flex-col gap-[18px]">
              {[['Tell us the occasion', 'Servings, date, colours and any reference photos.'], ['Get a quote', 'We reply with an itemised quote, usually the same day.'], [`Confirm with a ${s?.payments?.depositPercent ?? 50}% deposit`, `Custom designs need at least ${Math.round((p?.['custom-cakes'] ?? 120) / 24)} days notice.`]].map(([h, t], i) => (
                <div key={h} className="flex items-start gap-4">
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full border-[1.5px] border-gold font-serif text-xl font-bold text-wine">{i + 1}</span>
                  <div><h4 className="text-base font-extrabold">{h}</h4><p className="muted">{t}</p></div>
                </div>
              ))}
            </div>
            <Link to="/custom-cakes" className="btn btn-p btn-lg"><Sparkles size={18} /> Start a custom cake enquiry</Link>
          </div>
        </div>
      </section>

      {/* Popular non-cake */}
      <section className="pb-[84px]">
        <div className="wrap">
          <div className="mb-8 flex flex-wrap items-end gap-5">
            <div className="flex-1"><p className="eyebrow">Popular right now</p><h2 className="sec-title">Mithai, samosas & more</h2></div>
            <Link to="/shop" className="btn btn-o">Full menu <ArrowRight size={16} /></Link>
          </div>
          <div className="pgrid">{popular ? popular.map((x) => <ProductCard key={x._id} p={x} />) : Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />)}</div>
        </div>
      </section>

      {/* Blog */}
      <BlogCarousel />

      {/* Info */}
      <Highlights address={settings?.business?.address || ''} />

      <Testimonials />

      {/* Location & hours */}
      <section className="py-[84px]">
        <div className="wrap grid gap-[22px] [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
          <div className="relative min-h-[360px] overflow-hidden rounded-[20px] border border-line-2 bg-[#EFE6D6]" aria-hidden="true">
            <div className="absolute left-0 right-0 top-[40%] h-6 bg-cream" /><div className="absolute bottom-0 top-0 left-[48%] w-5 bg-cream" />
            <div className="absolute left-[8%] top-[18%] h-16 w-28 rounded-lg bg-[#E4D8C3]" /><div className="absolute bottom-[12%] right-[10%] h-20 w-32 rounded-lg bg-[#E4D8C3]" />
            <div className="absolute left-[52%] top-[44%] flex -translate-x-1/2 -translate-y-full flex-col items-center"><span className="whitespace-nowrap rounded-xl bg-wine px-3 py-2 text-[13px] font-extrabold text-white shadow-2">Patiala Bakers</span><span className="-mt-2 h-3.5 w-3.5 rotate-45 bg-wine" /></div>
            <span className="absolute left-[6%] top-[33%] text-[11px] font-bold uppercase tracking-widest text-[#9A8A7C]">High St</span>
          </div>
          <div className="card card-b">
            <p className="eyebrow">Visit us</p>
            <h2 className="sec-title">Pickup from Belmont</h2>
            <p className="mt-2 text-ink-2">{settings?.business?.address}</p>
            <div className="mt-6 flex flex-col">
              {settings?.hours?.map((h, i) => (
                <div key={i} className={`flex justify-between border-b border-dashed border-line py-2.5 text-[14.5px] ${i === today ? 'font-extrabold text-wine' : ''}`}>
                  <span>{WD[i]}{i === today ? ' (today)' : ''}</span><span>{h.closed ? 'Closed' : `${t12(h.open)} – ${t12(h.close)}`}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3"><Link to="/contact" className="btn btn-p">Contact & directions</Link><a className="btn btn-o" href={`tel:${settings?.business?.phone?.replace(/\s/g, '')}`}>Call {settings?.business?.phone}</a></div>
          </div>
        </div>
      </section>
    </>
  );
}