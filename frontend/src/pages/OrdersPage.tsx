import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Client, type Order } from "../api";
import { Button, Card, ErrorBox, Field, PageHeader, cardHover, inputClass } from "../ui";

const TRAILER_TYPES = ["curtainsider", "flatbed", "aluminium", "low-loader", "tanker", "tipper"];

const emptyForm = {
  client_id: "",
  product: "",
  tonnage: "",
  volume_m3: "",
  pickup_location_id: "",
  dropoff_location_id: "",
  pickup_date: "",
  dropoff_date: "",
  trailer_type_required: "",
  route_type: "local",
  details: "",
};

const STATUS_COLOR: Record<string, string> = {
  new:       "bg-slate-600 text-slate-200",
  suggested: "bg-yellow-700 text-yellow-100",
  assigned:  "bg-blue-700 text-blue-100",
  delivered: "bg-green-700 text-green-100",
  cancelled: "bg-red-800 text-red-200",
};

export default function OrdersPage() {
  const [orders, setOrders]     = useState<Order[]>([]);
  const [clients, setClients]   = useState<Client[]>([]);
  const [error, setError]       = useState<string | null>(null);
  const [busy, setBusy]         = useState(false);
  const [form, setForm]         = useState(emptyForm);
  const [distPreview, setDistPreview] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  // Filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const navigate = useNavigate();

  async function load() {
    try {
      const [o, c] = await Promise.all([api.listOrders(), api.listClients()]);
      setOrders(o);
      setClients(c);
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => { load(); }, []);

  // Auto-preview distance when both locations selected
  useEffect(() => {
    if (!form.pickup_location_id || !form.dropoff_location_id) {
      setDistPreview(null);
      return;
    }
    api.calcDistance(Number(form.pickup_location_id), Number(form.dropoff_location_id))
      .then((r) => setDistPreview(r.distance_km != null ? `~${r.distance_km} km` : "Sin coordenadas"))
      .catch(() => setDistPreview(null));
  }, [form.pickup_location_id, form.dropoff_location_id]);

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
        pickup_location_id: form.pickup_location_id ? Number(form.pickup_location_id) : null,
        dropoff_location_id: form.dropoff_location_id ? Number(form.dropoff_location_id) : null,
        pickup_date: form.pickup_date ? new Date(form.pickup_date).toISOString() : null,
        dropoff_date: form.dropoff_date ? new Date(form.dropoff_date).toISOString() : null,
        trailer_type_required: form.trailer_type_required || null,
        route_type: form.route_type,
        details: form.details || null,
        source: "manual",
      });
      setForm(emptyForm);
      setDistPreview(null);
      setShowForm(false);
      await load();
    } catch (e) {
      setError(String(e));
    }
  }

  // Group locations by country for the select
  function locLabel(c: Client) {
    return `[${c.postal_code}] ${c.name}${c.city ? ` — ${c.city}` : ""} (${c.country})`;
  }

  function applyFilters(o: Order) {
    if (filterStatus && o.status !== filterStatus) return false;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      const haystack = [o.product, o.pickup_location, o.dropoff_location, String(o.id)].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  }

  return (
    <div>
      <PageHeader
        title="Pedidos"
        subtitle="Solicitudes de transporte. Crea manualmente o importa desde email."
        actions={
          <div className="flex gap-2">
            <Button onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Ocultar formulario" : "+ Nuevo pedido"}
            </Button>
            <Button variant="ghost" onClick={intake} disabled={busy}>
              {busy ? "Comprobando…" : "Importar email"}
            </Button>
          </div>
        }
      />

      {error && <ErrorBox message={error} />}

      {/* ── Filters ── */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          className={`${inputClass} max-w-xs`}
          placeholder="Buscar mercancía, origen, destino…"
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
        />
        <select className={`${inputClass} w-44`} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="new">Nuevo</option>
          <option value="suggested">Sugerido</option>
          <option value="assigned">Asignado</option>
          <option value="delivered">Entregado</option>
          <option value="cancelled">Cancelado</option>
        </select>
        {(filterSearch || filterStatus) && (
          <button onClick={() => { setFilterSearch(""); setFilterStatus(""); }}
            className="text-xs text-slate-400 hover:text-white transition">✕ Limpiar</button>
        )}
        <span className="ml-auto text-xs text-slate-500">
          {orders.filter(applyFilters).length} / {orders.length} pedidos
        </span>
      </div>

      {/* ── New order form ── */}
      {showForm && (
        <Card className="mb-6">
          <p className="mb-4 text-sm font-semibold text-slate-300">Nuevo pedido de transporte</p>
          <form onSubmit={createOrder} className="grid grid-cols-3 gap-4">

            {/* Product */}
            <Field label="Mercancía *">
              <input className={inputClass} placeholder="áridos, acero, cereales…"
                value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} />
            </Field>
            <Field label="Toneladas">
              <input className={inputClass} type="number" min="0" step="0.1"
                value={form.tonnage} onChange={(e) => setForm({ ...form, tonnage: e.target.value })} />
            </Field>
            <Field label="Volumen (m³)">
              <input className={inputClass} type="number" min="0" step="0.1"
                value={form.volume_m3} onChange={(e) => setForm({ ...form, volume_m3: e.target.value })} />
            </Field>

            {/* Locations */}
            <Field label="Origen (ubicación)">
              <select className={inputClass} value={form.pickup_location_id}
                onChange={(e) => setForm({ ...form, pickup_location_id: e.target.value })}>
                <option value="">— seleccionar —</option>
                {clients.filter((c) => c.active).map((c) => (
                  <option key={c.id} value={c.id}>{locLabel(c)}</option>
                ))}
              </select>
            </Field>
            <Field label="Destino (ubicación)">
              <select className={inputClass} value={form.dropoff_location_id}
                onChange={(e) => setForm({ ...form, dropoff_location_id: e.target.value })}>
                <option value="">— seleccionar —</option>
                {clients.filter((c) => c.active).map((c) => (
                  <option key={c.id} value={c.id}>{locLabel(c)}</option>
                ))}
              </select>
            </Field>

            {/* Distance preview */}
            <div className="flex items-end pb-1">
              {distPreview ? (
                <div className="rounded-lg border border-brand-700 bg-brand-900/30 px-4 py-2 text-sm font-semibold text-brand-300">
                  📍 Distancia: {distPreview}
                </div>
              ) : (
                <div className="rounded-lg border border-slate-700 bg-ink-700 px-4 py-2 text-sm text-slate-500">
                  Selecciona origen y destino
                </div>
              )}
            </div>

            {/* Dates */}
            <Field label="Fecha de carga">
              <input className={inputClass} type="date"
                value={form.pickup_date} onChange={(e) => setForm({ ...form, pickup_date: e.target.value })} />
            </Field>
            <Field label="Fecha de descarga (estimada)">
              <input className={inputClass} type="date"
                value={form.dropoff_date} onChange={(e) => setForm({ ...form, dropoff_date: e.target.value })} />
            </Field>

            {/* Route type */}
            <Field label="Tipo de ruta">
              <select className={inputClass} value={form.route_type}
                onChange={(e) => setForm({ ...form, route_type: e.target.value })}>
                <option value="local">Local</option>
                <option value="international">Internacional</option>
              </select>
            </Field>

            {/* Trailer type */}
            <div className="col-span-3">
              <label className="mb-2 block text-xs font-medium text-slate-400">
                Tipo de remolque requerido
              </label>
              <div className="flex flex-wrap gap-2">
                {TRAILER_TYPES.map((t) => (
                  <button key={t} type="button"
                    onClick={() => setForm({ ...form, trailer_type_required: form.trailer_type_required === t ? "" : t })}
                    className={`rounded-lg border px-3 py-1 text-xs font-medium transition ${
                      form.trailer_type_required === t
                        ? "border-brand-500 bg-brand-600 text-white"
                        : "border-slate-600 bg-ink-700 text-slate-400 hover:border-slate-400"
                    }`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Details */}
            <div className="col-span-3">
              <Field label="Observaciones">
                <input className={inputClass} placeholder="Instrucciones especiales, referencia cliente…"
                  value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
              </Field>
            </div>

            <div className="col-span-3 flex gap-2">
              <Button type="submit">Crear pedido</Button>
              <Button variant="ghost" type="button" onClick={() => { setForm(emptyForm); setShowForm(false); }}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* ── Orders list ── */}
      <div className="space-y-3">
        {orders.filter(applyFilters).map((o) => {
          const pickupLoc = clients.find((l) => l.id === o.pickup_location_id);
          const dropoffLoc = clients.find((l) => l.id === o.dropoff_location_id);
          const origin = pickupLoc ? `[${pickupLoc.postal_code}] ${pickupLoc.name}` : o.pickup_location || "—";
          const dest   = dropoffLoc ? `[${dropoffLoc.postal_code}] ${dropoffLoc.name}` : o.dropoff_location || "—";

          return (
            <Card key={o.id} className={cardHover}>
              <div onClick={() => navigate(`/orders/${o.id}`)} className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-white capitalize">{o.product}</span>
                    <span className="text-sm text-slate-400">
                      {o.tonnage}t{o.volume_m3 ? ` · ${o.volume_m3}m³` : ""}
                    </span>
                    {o.trailer_type_required && (
                      <span className="rounded bg-ink-600 px-2 py-0.5 text-xs text-slate-300">
                        {o.trailer_type_required}
                      </span>
                    )}
                    {o.route_type && (
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                        o.route_type === "international" ? "bg-purple-800 text-purple-200" : "bg-blue-900 text-blue-200"
                      }`}>
                        {o.route_type === "international" ? "Internacional" : "Local"}
                      </span>
                    )}
                    {o.distance_km && (
                      <span className="text-xs text-slate-500">📍 {o.distance_km} km</span>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-slate-400">
                    {origin} → {dest}
                  </div>
                  {o.pickup_date && (
                    <div className="mt-0.5 text-xs text-slate-500">
                      Carga: {new Date(o.pickup_date).toLocaleDateString("es-ES")}
                      {o.dropoff_date && ` · Descarga: ${new Date(o.dropoff_date).toLocaleDateString("es-ES")}`}
                    </div>
                  )}
                </div>
                <div className="ml-4 flex items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_COLOR[o.status] ?? "bg-slate-600 text-white"}`}>
                    {o.status}
                  </span>
                </div>
              </div>
            </Card>
          );
        })}
        {orders.filter(applyFilters).length === 0 && (
          <div className="py-8 text-center text-sm text-slate-500">
            No hay pedidos. Crea uno con el botón de arriba.
          </div>
        )}
      </div>
    </div>
  );
}
