import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { apiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';

const SCRIPT = 'https://accounts.google.com/gsi/client';
let loading = null;

function loadGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const tag = document.createElement('script');
      tag.src = SCRIPT;
      tag.async = true;
      tag.onload = resolve;
      tag.onerror = () => { loading = null; reject(new Error('Could not load Google sign-in.')); };
      document.head.appendChild(tag);
    });
  }
  return loading;
}

// Shows nothing until GOOGLE_CLIENT_ID is set on the backend
export default function GoogleButton({ onError }) {
  const { settings } = useSettings();
  const { googleLogin } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const box = useRef(null);
  const clientId = settings?.googleClientId;
  const next = params.get('next');

  useEffect(() => {
    if (!clientId) return undefined;
    let cancelled = false;
    loadGoogle().then(() => {
      if (cancelled || !box.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          onError?.('');
          try {
            const { user, created } = await googleLogin(credential);
            toast.success(created ? 'Account created' : `Welcome back, ${user.name.split(' ')[0]}`);
            nav(next && next.startsWith('/') ? next : '/account', { replace: true });
          } catch (e) { onError?.(apiError(e).message); }
        },
      });
      window.google.accounts.id.renderButton(box.current, {
        type: 'standard', theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', logo_alignment: 'center',
        width: Math.min(box.current.clientWidth || 360, 400),
      });
    }).catch((e) => onError?.(e.message));
    return () => { cancelled = true; };
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!clientId) return null;
  return (
    <div className="mb-5">
      <div ref={box} className="flex min-h-[44px] w-full justify-center" />
      <div className="mt-5 flex items-center gap-3 text-xs muted"><span className="h-px flex-1 bg-line" />or use your email<span className="h-px flex-1 bg-line" /></div>
    </div>
  );
}