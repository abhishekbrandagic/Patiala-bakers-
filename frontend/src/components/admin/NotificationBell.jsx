import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast, { useToasterStore } from 'react-hot-toast';
import { AlertTriangle, Bell, CakeSlice, Clock, CreditCard, Mail, Package, ShoppingBag, XCircle } from 'lucide-react';
import { api, apiError } from '../../api/client.js';
import { cn } from '../../utils/format.js';
import { playAlert } from '../../utils/alertSound.js';

const ICONS = { new_order: ShoppingBag, cancelled: XCircle, late: AlertTriangle, due_soon: Clock, payment: CreditCard, enquiry: CakeSlice, stock: Package, message: Mail };
const REFRESH_EVERY = 15000;
const RANG_KEY = 'pb-rang-alerts';

// Remembers which late alerts have sounded, so reloading the page doesn't repeat them
function readRang() {
  try { return new Set(JSON.parse(localStorage.getItem(RANG_KEY)) || []); } catch { return new Set(); }
}
function saveRang(ids) {
  try { localStorage.setItem(RANG_KEY, JSON.stringify(ids)); } catch { /* the alert may sound again */ }
}

const CSS = `
.nb { position: relative; }
.nb-btn { position: relative; display: flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 50%; color: #0B6BCB; transition: background .15s; }
.nb-btn:hover, .nb-btn[aria-expanded="true"] { background: #E3F0FC; }
.nb-count { position: absolute; top: -2px; right: -3px; min-width: 10px; height: 16px; padding: 0 3px; border-radius: 9px; border: 2px solid #fff; box-sizing: content-box; background: #A12428; color: #fff; font-size: 10.5px; font-weight: 800; line-height: 16px; text-align: center; }
.nb-panel { position: absolute; z-index: 60; top: calc(100% + 10px); right: 0; display: flex; flex-direction: column; width: 390px; max-height: min(76vh, 560px); background: #fff; border: 1px solid #DCEAF8; border-radius: 16px; box-shadow: 0 20px 50px rgba(15,42,74,.2); overflow: hidden; animation: nb-in .16s cubic-bezier(.2,.85,.25,1); }
@keyframes nb-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
.nb-head { display: flex; align-items: center; gap: 10px; padding: 13px 14px 11px 16px; }
.nb-title { flex: 1; font-size: 16px; font-weight: 800; color: #0F2A4A; }
.nb-readall { font-size: 12.5px; font-weight: 700; color: #0B6BCB; }
.nb-readall:hover { text-decoration: underline; text-underline-offset: 2px; }
.nb-tabs { display: flex; gap: 6px; padding: 0 14px 10px 16px; border-bottom: 1px solid #E6F0FA; }
.nb-tab { min-height: 28px; padding: 0 11px; border-radius: 999px; font-size: 12.5px; font-weight: 700; color: #3D5673; transition: background .15s; }
.nb-tab:hover { background: #F3F8FD; }
.nb-tab.on { background: #E3F0FC; color: #0B6BCB; }
.nb-list { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: #CFE2F5 transparent; }
.nb-item { display: flex; gap: 11px; width: 100%; padding: 11px 16px; text-align: left; border-bottom: 1px solid #F1F6FB; transition: background .14s; }
.nb-item:last-child { border-bottom: 0; }
.nb-item:hover { background: #F3F8FD; }
.nb-item.unread { background: #F5FAFE; }
.nb-item.unread:hover { background: #EAF4FD; }
.nb-icon { flex: none; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 10px; }
.nb-icon.info { background: #E3F0FC; color: #0B6BCB; }
.nb-icon.warn { background: #FAEDD2; color: #8A5506; }
.nb-icon.bad { background: #F8E0DD; color: #A12428; }
.nb-text { flex: 1; min-width: 0; }
.nb-item-title { display: block; font-size: 13.5px; font-weight: 700; line-height: 1.3; color: #0F2A4A; }
.nb-body { display: block; margin-top: 1px; font-size: 12.5px; line-height: 1.35; color: #3D5673; overflow-wrap: anywhere; }
.nb-time { display: block; margin-top: 3px; font-size: 11.5px; color: #5F748C; }
.nb-dot { flex: none; width: 8px; height: 8px; margin-top: 5px; border-radius: 50%; background: #0B6BCB; }
.nb-empty { padding: 42px 20px; text-align: center; font-size: 13.5px; color: #5F748C; }
@media (max-width: 560px) { .nb-panel { position: fixed; top: 72px; left: 10px; right: 10px; width: auto; } }
@media (prefers-reduced-motion: reduce) { .nb-panel { animation: none; } }
`;

function timeAgo(iso) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export default function NotificationBell({ refreshKey = 0 }) {
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const box = useRef(null);
  const known = useRef(null);
  const soundOn = useRef(true);
  const { toasts } = useToasterStore();
  const heard = useRef(new Set(toasts.map((t) => t.id)));

  // Every pop-up message in the admin panel, including the POS, plays a sound
  useEffect(() => {
    const added = toasts.filter((t) => !heard.current.has(t.id));
    added.forEach((t) => heard.current.add(t.id));
    if (!added.length || !soundOn.current) return;
    playAlert(added.some((t) => t.sound === 'urgent') ? 'urgent' : 'chime');
  }, [toasts]);

  const load = useCallback(async () => {
    try {
      const { data: d } = await api.get('/admin/notifications');
      // Say so when something new arrives while staff are on another page
      const rang = readRang();
      const urgent = d.items.filter((n) => n.urgent && n.unread && !rang.has(n.id));
      const fresh = known.current ? d.items.filter((n) => !n.urgent && n.unread && !known.current.has(n.id)) : [];
      soundOn.current = d.sound !== false;
      if (urgent.length === 1) toast(urgent[0].title, { icon: '⚠️', duration: 8000, sound: 'urgent' });
      else if (urgent.length > 1) toast(`${urgent.length} orders are getting late`, { icon: '⚠️', duration: 8000, sound: 'urgent' });
      if (fresh.length === 1) toast(fresh[0].title, { icon: '🔔' });
      else if (fresh.length > 1) toast(`${fresh.length} new notifications`, { icon: '🔔' });
      saveRang(d.items.filter((n) => n.urgent).map((n) => n.id));
      known.current = new Set([...(known.current || []), ...d.items.map((n) => n.id)]);
      setData(d);
      setError('');
    } catch (e) { setError(apiError(e).message); }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => {
    // Keeps checking on a background tab, so the sound still plays there.
    // The page on screen updates its own list at the same time.
    const check = () => {
      load();
      if (!document.hidden) window.dispatchEvent(new Event('admin:refresh'));
    };
    const timer = setInterval(check, REFRESH_EVERY);
    const onFocus = () => check();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const readAll = async () => {
    setData((d) => d && { ...d, unread: 0, items: d.items.map((n) => ({ ...n, unread: false })) });
    try { await api.post('/admin/notifications/read'); } catch (e) { toast.error(apiError(e).message); load(); }
  };
  const go = (n) => { setOpen(false); nav(n.link); };

  const unread = data?.unread || 0;
  const shown = (data?.items || []).filter((n) => !onlyUnread || n.unread);

  return (
    <div className="nb" ref={box}>
      <style>{CSS}</style>
      <button type="button" className="nb-btn" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Bell size={20} aria-hidden="true" />
        {unread > 0 && <span className="nb-count">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="nb-panel" role="dialog" aria-label="Notifications">
          <div className="nb-head">
            <span className="nb-title">Notifications</span>
            {unread > 0 && <button type="button" className="nb-readall" onClick={readAll}>Mark all as read</button>}
          </div>
          <div className="nb-tabs">
            <button type="button" aria-pressed={!onlyUnread} className={cn('nb-tab', !onlyUnread && 'on')} onClick={() => setOnlyUnread(false)}>All</button>
            <button type="button" aria-pressed={onlyUnread} className={cn('nb-tab', onlyUnread && 'on')} onClick={() => setOnlyUnread(true)}>Unread{unread > 0 ? ` (${unread})` : ''}</button>
          </div>
          <div className="nb-list">
            {error && !data ? <p className="nb-empty">{error}</p>
              : !data ? <p className="nb-empty">Loading…</p>
              : !shown.length ? <p className="nb-empty">{onlyUnread ? 'No unread notifications.' : 'Nothing new right now.'}</p>
              : shown.map((n) => {
                const Icon = ICONS[n.type] || Bell;
                return (
                  <button key={n.id} type="button" className={cn('nb-item', n.unread && 'unread')} onClick={() => go(n)}>
                    <span className={cn('nb-icon', n.severity)}><Icon size={17} aria-hidden="true" /></span>
                    <span className="nb-text">
                      <span className="nb-item-title">{n.title}</span>
                      {n.body && <span className="nb-body">{n.body}</span>}
                      <span className="nb-time">{timeAgo(n.at)}</span>
                    </span>
                    {n.unread && <span className="nb-dot" aria-label="Unread" />}
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}