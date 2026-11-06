import { useMemo } from 'react';

const BAKERY_ZONE = 'Australia/Melbourne';
// Some browsers still list these places under their old names
const CURRENT_NAMES = { 'Asia/Calcutta': 'Asia/Kolkata', 'Asia/Katmandu': 'Asia/Kathmandu', 'Asia/Rangoon': 'Asia/Yangon', 'Asia/Saigon': 'Asia/Ho_Chi_Minh', 'Europe/Kiev': 'Europe/Kyiv' };

function offsetOf(timeZone) {
  try {
    const part = new Intl.DateTimeFormat('en', { timeZone, timeZoneName: 'longOffset' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName');
    return part?.value === 'GMT' ? 'GMT+00:00' : part?.value || '';
  } catch { return ''; }
}

const label = (timeZone) => `(${offsetOf(timeZone)}) ${timeZone.replace(/_/g, ' ')}`;

// Every time zone the browser knows, with the bakery's own zone first
export default function TimeZoneSelect({ id, value, onChange, disabled }) {
  const zones = useMemo(() => {
    const all = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
    return [...new Set([...all.map((z) => CURRENT_NAMES[z] || z), 'UTC', ...(value ? [value] : [])])].filter((z) => z !== BAKERY_ZONE).sort();
  }, [value]);
  return (
    <select id={id} className="in" value={value || BAKERY_ZONE} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <optgroup label="Belmont, Victoria">
        <option value={BAKERY_ZONE}>{label(BAKERY_ZONE)}</option>
      </optgroup>
      <optgroup label="All time zones">
        {zones.map((z) => <option key={z} value={z}>{label(z)}</option>)}
      </optgroup>
    </select>
  );
}