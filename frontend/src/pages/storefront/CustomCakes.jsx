import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import CustomCakeForm from '../../components/CustomCakeForm.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { fmtLong } from '../../utils/format.js';

export default function CustomCakes() {
  const { settings } = useSettings();
  const days = Math.ceil((settings?.prepHours?.['custom-cakes'] ?? 120) / 24);
  const [done, setDone] = useState(null);

  if (done) {
    return (
      <div className="wrap max-w-2xl py-16 text-center">
        <div className="mx-auto mb-4 flex h-[84px] w-[84px] items-center justify-center rounded-full bg-ok-bg text-ok"><Check size={40} strokeWidth={2.5} /></div>
        <h1 className="text-[44px] text-wine-ink">Enquiry received</h1>
        <p className="mt-2 text-ink-2">Your reference is</p>
        <span className="ordno mt-3">{done.reference}</span>
        <p className="mt-4 muted">We’ll be in touch with a quote, usually within 24 hours, for your cake on {fmtLong(done.requiredDate)}. A {settings?.payments?.depositPercent}% deposit confirms the booking.</p>
        <div className="mt-6 flex justify-center gap-3"><Link to="/shop" className="btn btn-p">Browse the menu</Link><button className="btn btn-o" onClick={() => setDone(null)}>Send another enquiry</button></div>
      </div>
    );
  }

  return (
    <>
      <section className="pagehead">
        <div className="wrap grid items-center gap-10 [grid-template-columns:repeat(auto-fit,minmax(min(400px,100%),1fr))]">
          <div>
            <p className="eyebrow">Custom cakes</p>
            <h1>Tell us about your dream cake</h1>
            <p className="mt-3 max-w-lg text-ink-2">Tiered wedding cakes, themed birthday cakes and corporate logos — every custom cake is eggless and quoted to order. We need at least {days} days notice.</p>
            <p className="mt-4"><Link to="/product/celebration-tiered-cake" className="font-bold">Prefer to order a tiered cake straight away? →</Link></p>
          </div>
          <img src="/images/custom cake.png" alt="Custom celebration cake with gold leaf and florals" className="mx-auto max-h-[320px] rounded-3xl shadow-2" />
        </div>
      </section>
      <div className="wrap max-w-4xl py-10">
        <CustomCakeForm onDone={(d) => { setDone(d); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
      </div>
    </>
  );
}