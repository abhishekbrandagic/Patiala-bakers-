import toast from "react-hot-toast";
import { api, apiError } from "../../api/client.js";
import { useFetch } from "../../hooks/useFetch.js";
import { EmptyState, ErrorState, PageLoader } from "../../components/ui.jsx";
import { cn, fmtStamp } from "../../utils/format.js";

export default function Messages() {
  const { data, error, reload } = useFetch("/admin/messages");

  const markHandled = async (id) => {
    try {
      await api.post(`/admin/messages/${id}/handled`);
      reload({ silent: true });
    } catch (e) {
      toast.error(apiError(e).message);
    }
  };

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <PageLoader />;
  if (!data.items.length)
    return <EmptyState title="No messages from the website yet" />;

  return (
    <div className="card card-b">
      {data.items.map((m) => (
        <div
          key={m._id}
          className={cn(
            "border-b border-line-2 py-3.5 last:border-0",
            m.handled && "opacity-60",
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <b>{m.name}</b>
            <a href={`mailto:${m.email}`} className="text-sm">
              {m.email}
            </a>
            {m.phone && <span className="text-sm muted">{m.phone}</span>}
            <span className="flex-1 text-right text-xs muted">
              {fmtStamp(m.createdAt)}
            </span>
            {!m.handled && (
              <button
                type="button"
                className="btn btn-o btn-xs"
                onClick={() => markHandled(m._id)}
              >
                Mark handled
              </button>
            )}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm">{m.message}</p>
        </div>
      ))}
    </div>
  );
}
