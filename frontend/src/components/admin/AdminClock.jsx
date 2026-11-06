import { useEffect, useState } from 'react';
import { useSettings } from '../../context/SettingsContext.jsx';

const CSS = `
.ac { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.2; white-space: nowrap; }
.ac-time { font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums; color: #0F2A4A; }
.ac-date { font-size: 11.5px; font-weight: 600; color: #5F748C; }
.live { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border: 2px solid #00C853; border-radius: 999px; color: #00C853; font-size: 12px; font-weight: 800; letter-spacing: .06em; line-height: 1; }
.live-dot { width: 9px; height: 9px; border-radius: 50%; background: #00C853; animation: live-blink 1s ease-in-out infinite; }
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

export function LiveBadge() {
  return (
    <span className="live">
      <style>{CSS}</style>
      <span className="live-dot" aria-hidden="true" />
      LIVE
    </span>
  );
}