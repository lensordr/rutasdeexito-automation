import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Order } from "../api";
import { Button, Card, ErrorBox, Field, PageHeader, StatusPill, cardHover, inputClass } from "../ui";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    product: "",
    tonnage: "",
    volume_m3: "",
    pickup_location: "",
    dropoff_location: "",
    details: "",
  });
  const navigate = useNavigate();

  async function load() {
    try {
      setOrders(await api.listOrders());
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function intake() {
    setBusy(true);
    setError(null);
    try {
      await api.intakeEmail();
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function createOrder(e: FormEvent) {
    e.preventDefault();
    if (!form.product.trim()) return;
    try {
      await api.createOrder({
        product: form.product,
        tonnage: Number(form.tonnage) || 0,
        volume_m3: form.volume_m3 ? Number(form.volume_m3) : null,
        pickup_location: form.pickup_location,
        dropoff_location: form.dropoff_location,
        details: form.details,
        source: "manual",
      });
      setForm({ product: "", tonnage: "", volume_m3: "", pickup_location: "", dropoff_location: "", details: "" });
      await load();
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle="Client transport requests. Pull from email or add manually, then assign."
        actions={
          <Button onClick={intake} disabled={busy}>
            {busy ? "Checking inbox…" : "Pull from email"}
          </Button>
        }
      />

      {error && <ErrorBox message={error} />}

      <Card className="mb-6">
        <div className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
          New order (manual)
        </div>
        <form onSubmit={createOrder} className="grid grid-cols-3 gap-4">
          <Field label="Product">
            <input className={inputClass} value={form.product}
              onChange={(e) => setForm({ ...form, product: e.target.value })}
              placeholder="grain, fuel, cement…" />
          </Field>
          <Field label="Tonnage (t)">
            <input className={inputClass} type="number" value={form.tonnage}
              onChange={(e) => setForm({ ...form, tonnage: e.target.value })} />
          </Field>
          <Field label="Volume (m³)">
            <input className={inputClass} type="number" value={form.volume_m3}
              onChange={(e) => setForm({ ...form, volume_m3: e.target.value })} />
          </Field>
          <Field label="Pickup">
            <input className={inputClass} value={form.pickup_location}
              onChange={(e) => setForm({ ...form, pickup_location: e.target.value })} />
          </Field>
          <Field label="Dropoff">
            <input className={inputClass} value={form.dropoff_location}
              onChange={(e) => setForm({ ...form, dropoff_location: e.target.value })} />
          </Field>
          <Field label="Details">
            <input className={inputClass} value={form.details}
              onChange={(e) => setForm({ ...form, details: e.target.value })} />
          </Field>
          <div className="col-span-3">
            <Button type="submit">Create order</Button>
          </div>
        </form>
      </Card>

      <div className="space-y-3">
        {orders.map((o) => (
          <Card key={o.id} className={cardHover}>
            <div onClick={() => navigate(`/orders/${o.id}`)} className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-white capitalize">{o.product}</span>
                  <span className="text-sm text-slate-400">
                    {o.tonnage}t{o.volume_m3 ? ` · ${o.volume_m3}m³` : ""}
                  </span>
                  <span className="rounded bg-ink-700 px-2 py-0.5 text-xs text-slate-400">
                    {o.source}
                  </span>
                </div>
                <div className="mt-1 text-sm text-slate-400">
                  {o.pickup_location || "—"} → {o.dropoff_location || "—"}
                </div>
              </div>
              <StatusPill status={o.status} />
            </div>
          </Card>
        ))}
        {orders.length === 0 && (
          <div className="py-8 text-center text-sm text-slate-500">
            No orders yet. Pull from email or create one above.
          </div>
        )}
      </div>
    </div>
  );
}
