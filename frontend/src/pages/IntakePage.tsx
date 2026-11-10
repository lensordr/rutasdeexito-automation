/**
 * IntakePage — Option A: Dispatcher quick-entry form
 * The dispatcher reads a WhatsApp message and fills this structured form
 * in ~30 seconds. The raw WhatsApp text is saved as audit trail.
 */
import { FormEvent, useEffect, useState } from "react";
import { api, type Client } from "../api";
import { Button, Card, ErrorBox, Field, PageHeader, inputClass } from "../ui";

const TRAILER_TYPES = ["curtainsider", "flatbed", "aluminium", "low-loader", "tanker", "tipper"];
const INTAKE_TOKEN = "rutas2024"; // change via DISPATCH_INTAKE_TOKEN in .env

const emptyForm = {
  client_id: "",
  product: "",
  tonnage: "",
  pickup_location_id: "",
  dropoff_location_id: "",
  pickup_date: "",
  dropoff_date: "",
  trailer_type_required: "",
  route_type: "local",
  whatsapp_raw: "",
  details: "",
};

export default function IntakePage() {
  const [clients, setClients]     = useState<Client[]>([]);
  const [form, setForm]           = useState(emptyForm);
  const [distPreview, setDistPreview] = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState<string | null>(null);
  const [busy, setBusy]           = useState(false);

  useEffect(() => {
    api.listClients()
      .then((c) => { setClients(c); })
      .catch((e) => setError(String(e)));
  }, []);

  // Live distance preview
  useEffect(() => {
    if (!form.pickup_location_id || !form.dropoff_location_id) {
      setDistPreview(null);
      return;
    }
    api.calcDistance(Number(form.pickup_location_id), Number(form.dropoff_location_id))
      .then((r) => setDistPreview(r.distance_km != null ? `${r.distance_km} km` : "Sin coordenadas"))
      .catch(() => setDistPreview(null));
  }, [form.pickup_location_id, form.dropoff_location_id]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.product.trim() || !form.pickup_location_id || !form.dropoff_location_id) {
      setError("Mercancía, origen y destino son obligatorios.");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const order = await api.createOrder({
        client_id: form.client_id ? Number(form.client_id) : null,
        product: form.product,
        tonnage: Number(form.tonnage) || 0,
        pickup_location_id: Number(form.pickup_location_id),
        dropoff_location_id: Number(form.dropoff_location_id),
        pickup_date: form.pickup_date ? new Date(form.pickup_date).toISOString() : null,
        dropoff_date: form.dropoff_date ? new Date(form.dropoff_date).toISOString() : null,
        trailer_type_required: form.trailer_type_required || null,
        route_type: form.route_type,
        details: [
          form.details,
          form.whatsapp_raw ? `📱 Mensaje original:\n${form.whatsapp_raw}` : "",
        ].filter(Boolean).join("\n\n") || null,
        source: "whatsapp",
      });
      setSuccess(`✓ Pedido #${order.id} creado correctamente.`);
      setForm(emptyForm);
      setDistPreview(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  // Expose the client link for copying
  const clientLink = `${window.location.origin}/pedido?t=${INTAKE_TOKEN}`;

  function locLabel(c: Client) {
    return `[${c.postal_code}] ${c.name}${c.city ? ` — ${c.city}` : ""}`;
  }

  return (
    <div>
      <PageHeader
        title="Entrada rápida de pedidos"
        subtitle="Convierte un mensaje de WhatsApp en un pedido estructurado en 30 segundos."
        actions={
          <button
            onClick={() => navigator.clipboard.writeText(clientLink)}
            className="rounded-lg border border-green-700 bg-green-700/20 px-4 py-2 text-xs font-semibold text-green-300 hover:bg-green-700/40 transition"
          >
            📋 Copiar enlace para clientes
          </button>
        }
      />

      {error   && <ErrorBox message={error} />}
      {success && (
        <div className="mb-4 rounded-lg border border-emerald-700/50 bg-emerald-900/30 px-4 py-3 text-sm font-medium text-emerald-300">
          {success}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* ── Left: WhatsApp paste area ── */}
        <div className="col-span-1">
          <Card className="h-full">
            <p className="mb-2 text-sm font-semibold text-slate-300">📱 Pega el mensaje de WhatsApp</p>
            <p className="mb-3 text-xs text-slate-500">
              Copia el texto tal cual del móvil. Se guardará en el pedido como referencia.
            </p>
            <textarea
              className={`${inputClass} h-56 resize-none font-mono text-xs leading-relaxed`}
              placeholder={"Hola, necesito un camión para mañana.\nOrigen: Polígono Norte, 28001 Madrid\nDestino: Barcelona 08080\nMercancía: acero en rollos\n25 toneladas\nRemolque plataforma\nGracias"}
              value={form.whatsapp_raw}
              onChange={(e) => setForm({ ...form, whatsapp_raw: e.target.value })}
            />
            <div className="mt-4 rounded-lg border border-dashed border-slate-600 p-3">
              <p className="mb-1 text-xs font-semibold text-slate-400">Enlace para clientes</p>
              <p className="mb-2 text-xs text-slate-500 break-all">{clientLink}</p>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(clientLink)}
                className="w-full rounded-lg border border-green-700 bg-green-700/20 py-1.5 text-xs font-medium text-green-300 hover:bg-green-700/40 transition"
              >
                📋 Copiar enlace
              </button>
            </div>
          </Card>
        </div>

        {/* ── Right: Structured form ── */}
        <div className="col-span-2">
          <Card>
            <p className="mb-4 text-sm font-semibold text-slate-300">Datos del pedido</p>
            <form onSubmit={submit} className="grid grid-cols-2 gap-4">

              <div className="col-span-2">
                <Field label="Cliente">
                  <select className={inputClass} value={form.client_id}
                    onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
                    <option value="">— seleccionar o dejar en blanco —</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Mercancía *">
                <input className={inputClass} placeholder="acero, áridos, cereales…"
                  value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} />
              </Field>
              <Field label="Toneladas">
                <input className={inputClass} type="number" min="0" step="0.1"
                  value={form.tonnage} onChange={(e) => setForm({ ...form, tonnage: e.target.value })} />
              </Field>

              <Field label="Origen *">
                <select className={inputClass} value={form.pickup_location_id}
                  onChange={(e) => setForm({ ...form, pickup_location_id: e.target.value })}>
                  <option value="">— seleccionar ubicación —</option>
                  {clients.filter((c) => c.active).map((c) => (
                    <option key={c.id} value={c.id}>{locLabel(c)}</option>
                  ))}
                </select>
              </Field>
              <Field label="Destino *">
                <select className={inputClass} value={form.dropoff_location_id}
                  onChange={(e) => setForm({ ...form, dropoff_location_id: e.target.value })}>
                  <option value="">— seleccionar ubicación —</option>
                  {clients.filter((c) => c.active).map((c) => (
                    <option key={c.id} value={c.id}>{locLabel(c)}</option>
                  ))}
                </select>
              </Field>

              {distPreview && (
                <div className="col-span-2 -mt-1">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-brand-700 bg-brand-900/30 px-3 py-1.5 text-sm font-semibold text-brand-300">
                    📍 Distancia estimada: {distPreview}
                  </span>
                </div>
              )}

              <Field label="Fecha de carga">
                <input className={inputClass} type="date"
                  value={form.pickup_date} onChange={(e) => setForm({ ...form, pickup_date: e.target.value })} />
              </Field>
              <Field label="Fecha de descarga (estimada)">
                <input className={inputClass} type="date"
                  value={form.dropoff_date} onChange={(e) => setForm({ ...form, dropoff_date: e.target.value })} />
              </Field>

              <Field label="Tipo de ruta">
                <select className={inputClass} value={form.route_type}
                  onChange={(e) => setForm({ ...form, route_type: e.target.value })}>
                  <option value="local">Local</option>
                  <option value="international">Internacional</option>
                </select>
              </Field>

              <Field label="Observaciones">
                <input className={inputClass} placeholder="Referencia cliente, instrucciones…"
                  value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
              </Field>

              <div className="col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Tipo de remolque requerido
                </label>
                <div className="flex flex-wrap gap-2">
                  {TRAILER_TYPES.map((t) => (
                    <button key={t} type="button"
                      onClick={() => setForm({ ...form, trailer_type_required: form.trailer_type_required === t ? "" : t })}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                        form.trailer_type_required === t
                          ? "border-brand-500 bg-brand-600 text-white"
                          : "border-slate-600 bg-ink-700 text-slate-400 hover:border-slate-400"
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="col-span-2 flex gap-3 pt-2">
                <Button type="submit" disabled={busy}>
                  {busy ? "Guardando…" : "Crear pedido"}
                </Button>
                <Button variant="ghost" type="button"
                  onClick={() => { setForm(emptyForm); setDistPreview(null); setError(null); setSuccess(null); }}>
                  Limpiar
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
