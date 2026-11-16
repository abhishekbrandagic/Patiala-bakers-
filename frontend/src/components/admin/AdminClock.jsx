import { useEffect, useState } from 'react';
import { setLive, useLive } from '../../utils/live.js';
import { useSettings } from '../../context/SettingsContext.jsx';

const CSS = `
.ac { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.2; white-space: nowrap; }
.ac-time { font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums; color: #0F2A4A; }
.ac-date { font-size: 11.5px; font-weight: 600; color: #5F748C; }
.live { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border: 2px solid #00C853; border-radius: 999px; color: #00C853; font-size: 12px; font-weight: 800; letter-spacing: .06em; line-height: 1; }
.live-dot { width: 9px; height: 9px; border-radius: 50%; background: #00C853; animation: live-blink 1s ease-in-out infinite; }
.live.off { border-color: #9AA5B1; color: #8A96A3; }
.live.off .live-dot { background: #9AA5B1; animation: none; }
.live-wrap { display: inline-flex; align-items: center; gap: 10px; }
.live-sw { border: 0; padding: 0; cursor: pointer; width: 42px; height: 24px; border-radius: 999px; background: #C4CDD6; position: relative; flex: none; transition: background .2s; }
.live-sw::after { content: ''; position: absolute; left: 3px; top: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.25); transition: transform .2s; }
.live-sw.on { background: #00C853; }
.live-sw.on::after { transform: translateX(18px); }
.live-sw:focus-visible { outline: 2px solid #0B6BCB; outline-offset: 2px; }
@keyframes live-blink { 0%, 100% { opacity: 1; } 50% { opacity: .12; } }
@media (prefers-reduced-motion: reduce) { .live-dot { animation: none; } }
`;

function read(timeZone, date) {
  const zone = timeZone ? { timeZone } : {};
  try {
    const shortName = new Intl.DateTimeFormat('en-AU', { ...zone, timeZoneName: 'short' }).formatToParts(date).find((p) => p.type === 'timeZoneName')?.value || '';
    return {
      time: date.toLocaleTimeString('en-AU', { ...zone, hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }),
      day: date.toLocaleDateString('en-AU', { ...zone, weekday: 'short', day: 'numeric', month: 'short' }),
      shortName,
    };
  } catch { return read(undefined, date); }
}

// The current time at the bakery, updated every second
export default function AdminClock() {
  const { settings } = useSettings();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const { time, day, shortName } = read(settings?.timezone, now);
  return (
    <div className="ac" title={settings?.timezone}>
      <style>{CSS}</style>
      <span className="ac-time">{time}</span>
      <span className="ac-date">{day}{shortName ? `, ${shortName}` : ''}</span>
    </div>
  );
}

export function LiveBadge({ on = true }) {
  return (
    <span className={on ? 'live' : 'live off'}>
      <style>{CSS}</style>
      <span className="live-dot" aria-hidden="true" />
      LIVE
    </span>
  );
}

// LIVE badge with an on/off switch. Off pauses the automatic refresh on that page.
export function LiveControl({ page }) {
  const on = useLive(page);
  return (
    <span className="live-wrap">
      <LiveBadge on={on} />
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={on ? 'Live updates on' : 'Live updates off'}
        title={on ? 'Live updates on. Click to pause.' : 'Live updates paused. Click to turn on.'}
        className={on ? 'live-sw on' : 'live-sw'}
        onClick={() => setLive(page, !on)}
      />
    </span>
  );
}