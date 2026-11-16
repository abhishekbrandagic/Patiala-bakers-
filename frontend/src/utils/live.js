import { useEffect, useState } from 'react';

// On/off switch for live updates on an admin page, remembered in this browser
const KEY = (page) => `pb-live:${page}`;

export function isLive(page) {
  try { return localStorage.getItem(KEY(page)) !== 'off'; } catch { return true; }
}

export function setLive(page, on) {
  try { localStorage.setItem(KEY(page), on ? 'on' : 'off'); } catch { /* stays on for this visit */ }
  window.dispatchEvent(new CustomEvent('admin:live', { detail: { page, on } }));
}

export function useLive(page) {
  const [on, setOn] = useState(() => isLive(page));
  useEffect(() => {
    setOn(isLive(page));
    const sync = () => setOn(isLive(page));
    window.addEventListener('admin:live', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('admin:live', sync); window.removeEventListener('storage', sync); };
  }, [page]);
  return on;
}