import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type Order, type Suggestion } from "../api";
import { Button, Card, ErrorBox, PageHeader, StatusPill } from "../ui";

export default function OrderDetailPage() {
  const { orderId } = useParams();
  const id = Number(orderId);
  const [order, setOrder] = useState<Order | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setOrder(await api.getOrder(id));
    } catch (e) {
      setError(String(e));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function getSuggestions() {
    setBusy(true);
    setError(null);
    try {
      setSuggestions(await api.getSuggestions(id));
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirm(s: Suggestion) {
    setBusy(true);
    setError(null);
    try {
      await api.confirm(id, {
        truck_id: s.truck_id,
        trailer_id: s.trailer_id ?? undefined,
        driver_id: s.driver_id ?? undefined,
      });
      setNote(`Assigned to ${s.truck_plate}. Order confirmed.`);
      setSuggestions(null);
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: Order["status"]) {
    setBusy(true);
    try {
      await api.setStatus(id, status);
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!order) return <div className="text-sm text-slate-500">Loading…</div>;

  const canAssign = order.status === "new" || order.status === "suggested";

  return (
    <div>
      <PageHeader
        title={`Order #${order.id}`}
        subtitle={`${order.product} · ${order.tonnage}t${order.volume_m3 ? ` · ${order.volume_m3}m³` : ""}`}
        actions={<StatusPill status={order.status} />}
      />

      {error && <ErrorBox message={error} />}
      {note && (
        <div className="mb-4 rounded-lg border border-emerald-700/50 bg-emerald-900/30 px-4 py-3 text-sm text-emerald-300">
          {note}
        </div>
      )}

      <Card className="mb-6">
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <Detail label="Pickup" value={order.pickup_location || "—"} />
          <Detail label="Dropoff" value={order.dropoff_location || "—"} />
          <Detail label="Source" value={`${order.source}${order.source_ref ? ` (${order.source_ref})` : ""}`} />
          <Detail label="Details" value={order.details || "—"} />
        </div>
      </Card>

      <div className="mb-6 flex items-center gap-3">
        {canAssign && (
          <Button onClick={getSuggestions} disabled={busy}>
            {busy ? "Scoring…" : "Get assignment suggestions"}
          </Button>
        )}
        {order.status === "assigned" && (
          <>
            <Button variant="ghost" onClick={() => setStatus("delivered")} disabled={busy}>
              Mark delivered
            </Button>
            <Button variant="danger" onClick={() => setStatus("cancelled")} disabled={busy}>
              Cancel
            </Button>
          </>
        )}
        {(order.status === "new" || order.status === "suggested") && (
          <Button variant="danger" onClick={() => setStatus("cancelled")} disabled={busy}>
            Cancel order
          </Button>
        )}
      </div>

      {suggestions && (
        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Ranked suggestions ({suggestions.length})
          </div>
          {suggestions.length === 0 && (
            <Card>
              <div className="text-sm text-slate-400">
                No valid truck/trailer can carry this order (capability or capacity).
                Adjust the fleet or the order, then try again.
              </div>
            </Card>
          )}
          <div className="space-y-3">
            {suggestions.map((s, i) => (
              <Card key={i}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="rounded bg-brand-900/50 px-2 py-0.5 text-xs font-semibold text-brand-200 ring-1 ring-brand-700/60">
                        score {s.score.toFixed(2)}
                      </span>
                      <span className="font-semibold text-white">{s.truck_plate}</span>
                      {s.trailer_identifier && (
                        <span className="text-sm text-slate-400">+ {s.trailer_identifier}</span>
                      )}
                      {s.driver_name && (
                        <span className="text-sm text-slate-400">· {s.driver_name}</span>
                      )}
                      {s.distance_km != null && (
                        <span className="text-xs text-slate-500">{s.distance_km} km</span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{s.reason}</div>
                  </div>
                  <Button onClick={() => confirm(s)} disabled={busy}>
                    Confirm
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-slate-200">{value}</div>
    </div>
  );
}
