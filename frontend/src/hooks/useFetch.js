import { useCallback, useEffect, useRef, useState } from "react";
import { api, apiError } from "../api/client.js";
import { isLive } from "../utils/live.js";

// Admin pages whose lists keep themselves up to date. NotificationBell sends the signal.
const LIVE_PAGES = [
  "/admin/dashboard",
  "/admin/orders",
  "/admin/production",
  "/admin/calendar",
  "/admin/products",
  "/admin/enquiries",
  "/admin/customers",
  "/admin/messages",
];

// Small data-loading hook: GET `url` with `params`, re-runs when the serialised params change.
export function useFetch(url, params) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(params || {});
  const seq = useRef(0);

  const load = useCallback(
    async ({ silent } = {}) => {
      if (!url) return;
      const n = ++seq.current;
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const { data: d } = await api.get(url, { params: JSON.parse(key) });
        if (n === seq.current) {
          setData(d);
          setError(null);
        }
      } catch (e) {
        // A background refresh that fails keeps what's on screen and tries again next time
        if (n === seq.current && !silent) setError(apiError(e).message);
      } finally {
        if (n === seq.current) setLoading(false);
      }
    },
    [url, key],
  );

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!LIVE_PAGES.includes(url)) return undefined;
    // Skip the refresh while live updates are switched off on the open page
    const refresh = () => {
      if (isLive(window.location.pathname)) load({ silent: true });
    };
    window.addEventListener("admin:refresh", refresh);
    return () => window.removeEventListener("admin:refresh", refresh);
  }, [url, load]);
  return { data, error, loading, reload: load, setData };
}
