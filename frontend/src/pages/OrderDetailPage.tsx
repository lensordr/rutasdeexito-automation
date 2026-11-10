import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type Assignment, type Driver, type Order, type Suggestion, type Trailer, type Truck } from "../api";
import { Button, Card, ErrorBox, Field, PageHeader, StatusPill, inputClass } from "../ui";

export default function OrderDetailPage() {
  const { orderId } = useParams();
  const id = Number(orderId);

  const [order, setOrder]           = useState<Order | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [trucks, setTrucks]         = useState<Truck[]>([]);
  const [trailers, setTrailers]     = useState<Trailer[]>([]);
  const [drivers, setDrivers]       = useState<Driver[]>([]);
  const [error, setError]           = useState<string | null>(null);
  const [busy, setBusy]             = useState(false);
  const [note, setNote]             = useState<string | null>(null);

  // Pricing fields shown before confirming a suggestion
  const [pricing, setPricing] = useState<{ idx: number; price_per_km: string; price_total: string; notes: string } | null>(null);

  const printRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const [o, ass, tr, tl, dr] = await Promise.all([
        api.getOrder(id),
        api.listAssignments(id),
        api.listTrucks(),
        api.listTrailers(),
        api.listDrivers(),
      ]);
      setOrder(o);
      setAssignments(ass);
      setTrucks(tr);
      setTrailers(tl);
      setDrivers(dr);
    } catch (e) {
      setError(String(e));
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

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

  // Auto-calc total when per_km changes
  function handlePricingChange(field: string, val: string) {
    if (!pricing) return;
    const updated = { ...pricing, [field]: val };
    if (field === "price_per_km" && order?.distance_km) {
      const total = (parseFloat(val) || 0) * order.distance_km;
      updated.price_total = total > 0 ? total.toFixed(2) : updated.price_total;
    }
    setPricing(updated);
  }

  async function confirm(s: Suggestion, pricingData: typeof pricing) {
    setBusy(true);
    setError(null);
    try {
      await api.confirm(id, {
        truck_id: s.truck_id,
        trailer_id: s.trailer_id ?? null,
        driver_id: s.driver_id ?? null,
        price_per_km: pricingData?.price_per_km ? parseFloat(pricingData.price_per_km) : null,
        price_total: pricingData?.price_total ? parseFloat(pricingData.price_total) : null,
        dispatcher_notes: pricingData?.notes || null,
      });
      setNote(`✓ Asignado a ${s.truck_plate}.`);
      setSuggestions(null);
      setPricing(null);
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirmUnloading() {
    await api.updateOrder(id, { unloading_confirmed: true });
    await load();
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

  function printDoc() {
    const el = document.getElementById("dispatch-doc");
    if (!el) return;
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Hoja de ruta — Pedido #${order?.id}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: system-ui, -apple-system, Arial, sans-serif;
            font-size: 11pt;
            color: #111;
            background: white;
            padding: 2cm;
          }
          .doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e5e7eb; padding-bottom: 16px; margin-bottom: 20px; }
          .doc-header h2 { font-size: 20pt; font-weight: 700; }
          .doc-header p  { font-size: 9pt; color: #6b7280; margin-top: 4px; }
          .badge { display: inline-block; border: 1px solid #d1d5db; border-radius: 999px; padding: 2px 10px; font-size: 9pt; color: #374151; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 20px; }
          .section-title { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 10px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 10pt; }
          .row .lbl { color: #6b7280; }
          .row .val { font-weight: 500; text-align: right; max-width: 60%; }
          .row .val.bold { font-weight: 700; font-size: 11pt; }
          .divider { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }
          .obs { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; font-size: 10pt; color: #374151; white-space: pre-wrap; }
          .sigs { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 32px; }
          .sig-line { border-top: 1px solid #9ca3af; padding-top: 6px; font-size: 9pt; color: #6b7280; }
          @media print { body { padding: 1.5cm; } @page { size: A4; margin: 1.5cm; } }
        </style>
      </head>
      <body>
        ${el.innerHTML}
        <script>window.onload = function() { window.print(); }<\/script>
      </body>
      </html>
    `);
    win.document.close();
  }

  if (!order) return <div className="p-8 text-sm text-slate-500">Cargando…</div>;

  const canAssign = order.status === "new" || order.status === "suggested";
  const confirmedAssignment = assignments.find((a) => a.status === "confirmed" || a.status === "delivered");
  const assignedTruck   = confirmedAssignment ? trucks.find((t) => t.id === confirmedAssignment.truck_id) : null;
  const assignedTrailer = confirmedAssignment ? trailers.find((t) => t.id === confirmedAssignment.trailer_id) : null;
  const assignedDriver  = confirmedAssignment ? drivers.find((d) => d.id === confirmedAssignment.driver_id) : null;

  return (
    <div>
      <PageHeader
        title={`Pedido #${order.id}`}
        subtitle={`${order.product} · ${order.tonnage}t${order.volume_m3 ? ` · ${order.volume_m3}m³` : ""}`}
        actions={
          <div className="flex items-center gap-3">
            <StatusPill status={order.status} />
            {confirmedAssignment && (
              <button onClick={printDoc}
                className="rounded-lg border border-slate-600 bg-ink-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-ink-600 transition">
                🖨️ Imprimir / Guardar PDF
              </button>
            )}
          </div>
        }
      />

      {error && <ErrorBox message={error} />}
      {note && (
        <div className="mb-4 rounded-lg border border-emerald-700/50 bg-emerald-900/30 px-4 py-3 text-sm text-emerald-300">
          {note}
        </div>
      )}

      {/* ── Order details ── */}
      <Card className="mb-6">
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <Detail label="Origen"   value={order.pickup_location || "—"} />
          <Detail label="Destino"  value={order.dropoff_location || "—"} />
          {order.distance_km != null && <Detail label="Distancia" value={`${order.distance_km} km`} />}
          {order.trailer_type_required && <Detail label="Remolque" value={order.trailer_type_required} />}
          {order.route_type && <Detail label="Ruta" value={order.route_type === "international" ? "Internacional" : "Local"} />}
          {order.pickup_date && <Detail label="Fecha carga" value={new Date(order.pickup_date).toLocaleDateString("es-ES")} />}
          {order.dropoff_date && <Detail label="Fecha descarga" value={new Date(order.dropoff_date).toLocaleDateString("es-ES")} />}
          <Detail label="Descarga confirmada" value={order.unloading_confirmed ? "✓ Sí" : "Pendiente"} />
          {order.details && <Detail label="Observaciones" value={order.details} />}
        </div>
      </Card>

      {/* ── Action buttons ── */}
      <div className="mb-6 flex flex-wrap gap-3">
        {canAssign && (
          <Button onClick={getSuggestions} disabled={busy}>
            {busy ? "Analizando…" : "🎯 Obtener sugerencias de asignación"}
          </Button>
        )}
        {order.status === "assigned" && !order.unloading_confirmed && (
          <Button variant="ghost" onClick={confirmUnloading} disabled={busy}>
            ✓ Confirmar descarga
          </Button>
        )}
        {order.status === "assigned" && (
          <>
            <Button variant="ghost" onClick={() => setStatus("delivered")} disabled={busy}>
              Marcar entregado
            </Button>
            <Button variant="danger" onClick={() => setStatus("cancelled")} disabled={busy}>
              Cancelar
            </Button>
          </>
        )}
        {canAssign && (
          <Button variant="danger" onClick={() => setStatus("cancelled")} disabled={busy}>
            Cancelar pedido
          </Button>
        )}
      </div>

      {/* ── Suggestions with pricing ── */}
      {suggestions && (
        <div className="mb-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Sugerencias ({suggestions.length})
          </p>
          {suggestions.length === 0 && (
            <Card>
              <p className="text-sm text-slate-400">
                Ningún camión/remolque puede cubrir este pedido. Revisa la flota o los requisitos del pedido.
              </p>
            </Card>
          )}
          <div className="space-y-3">
            {suggestions.map((s, i) => {
              // Derive availability from the reason text
              const reason = s.reason || "";
              const truckBusy = reason.includes("on_trip") || reason.includes("maintenance") || reason.includes("offline");
              const driverBusy = reason.includes("driving") || reason.includes("off_duty");
              const availBadge = truckBusy
                ? { label: "Camión ocupado", cls: "bg-red-900/50 text-red-300 ring-1 ring-red-700/50" }
                : driverBusy
                ? { label: "Conductor no disponible", cls: "bg-yellow-900/40 text-yellow-300 ring-1 ring-yellow-700/50" }
                : { label: "Disponible ✓", cls: "bg-emerald-900/40 text-emerald-300 ring-1 ring-emerald-700/50" };

              return (
              <Card key={i}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${availBadge.cls}`}>
                        {availBadge.label}
                      </span>
                      <span className="font-semibold text-white">{s.truck_plate}</span>
                      {s.trailer_identifier && <span className="text-sm text-slate-400">+ {s.trailer_identifier}</span>}
                      {s.driver_name && <span className="text-sm text-slate-400">· {s.driver_name}</span>}
                      {s.distance_km != null && <span className="text-xs text-slate-500">{s.distance_km} km</span>}
                    </div>
                    <p className="text-xs text-slate-500">{s.reason}</p>

                    {/* Pricing form — expands when "Asignar" clicked */}
                    {pricing?.idx === i && (
                      <div className="mt-3 grid grid-cols-3 gap-3 border-t border-slate-700 pt-3">
                        <Field label="€ / km">
                          <input className={inputClass} type="number" min="0" step="0.01"
                            placeholder="1.20"
                            value={pricing.price_per_km}
                            onChange={(e) => handlePricingChange("price_per_km", e.target.value)} />
                        </Field>
                        <Field label="Precio total (€)">
                          <input className={inputClass} type="number" min="0" step="0.01"
                            placeholder="auto-calculado"
                            value={pricing.price_total}
                            onChange={(e) => handlePricingChange("price_total", e.target.value)} />
                        </Field>
                        <Field label="Notas internas">
                          <input className={inputClass} placeholder="Observaciones…"
                            value={pricing.notes}
                            onChange={(e) => handlePricingChange("notes", e.target.value)} />
                        </Field>
                        {order.distance_km && pricing.price_per_km && (
                          <div className="col-span-3 text-xs text-slate-400">
                            {order.distance_km} km × {pricing.price_per_km} €/km = <strong className="text-white">{(parseFloat(pricing.price_per_km) * order.distance_km).toFixed(2)} €</strong>
                          </div>
                        )}
                        <div className="col-span-3 flex gap-2">
                          <Button onClick={() => confirm(s, pricing)} disabled={busy}>
                            {busy ? "Confirmando…" : "✓ Confirmar asignación"}
                          </Button>
                          <Button variant="ghost" onClick={() => setPricing(null)}>Cancelar</Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {pricing?.idx !== i && (
                    <Button onClick={() => setPricing({ idx: i, price_per_km: "", price_total: "", notes: "" })}>
                      Asignar →
                    </Button>
                  )}
                </div>
              </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Confirmed assignment + dispatch document ── */}
      {confirmedAssignment && (
        <div ref={printRef}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Hoja de ruta / Documento de expedición
          </p>
          <Card className="border-brand-700">
            <div id="dispatch-doc">

              {/* Header */}
              <div className="doc-header flex items-start justify-between border-b border-slate-700 pb-4 mb-5">
                <div>
                  <h2 className="text-lg font-bold text-white">Hoja de ruta</h2>
                  <p className="text-xs text-slate-400 mt-1">Pedido #{order.id} · {new Date(order.created_at).toLocaleDateString("es-ES")}</p>
                </div>
                <span className="badge rounded border border-slate-500 px-3 py-1 text-xs text-slate-300">
                  {order.status.toUpperCase()}
                </span>
              </div>

              <div className="grid-2 grid grid-cols-2 gap-6 mb-5">
                {/* Route */}
                <div>
                  <p className="section-title text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">📍 Ruta</p>
                  <div className="space-y-2">
                    <PrintRow label="Origen"    value={order.pickup_location || "—"} />
                    <PrintRow label="Destino"   value={order.dropoff_location || "—"} />
                    {order.distance_km != null && <PrintRow label="Distancia" value={`${order.distance_km} km`} />}
                    {order.pickup_date  && <PrintRow label="Fecha carga"    value={new Date(order.pickup_date).toLocaleDateString("es-ES")} />}
                    {order.dropoff_date && <PrintRow label="Fecha descarga" value={new Date(order.dropoff_date).toLocaleDateString("es-ES")} />}
                    <PrintRow label="Tipo ruta" value={order.route_type === "international" ? "Internacional" : "Local"} />
                  </div>
                </div>

                {/* Cargo */}
                <div>
                  <p className="section-title text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">📦 Mercancía</p>
                  <div className="space-y-2">
                    <PrintRow label="Producto"  value={order.product} />
                    <PrintRow label="Toneladas" value={`${order.tonnage} t`} />
                    {order.volume_m3 != null && <PrintRow label="Volumen" value={`${order.volume_m3} m³`} />}
                    {order.trailer_type_required && <PrintRow label="Remolque" value={order.trailer_type_required} />}
                  </div>
                </div>

                {/* Driver / Truck */}
                <div>
                  <p className="section-title text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">🚛 Conductor y vehículo</p>
                  <div className="space-y-2">
                    {assignedDriver ? (
                      <>
                        <PrintRow label="Conductor" value={assignedDriver.name} />
                        {assignedDriver.dni_nie && <PrintRow label="DNI / NIE" value={assignedDriver.dni_nie} />}
                        {assignedDriver.phone && <PrintRow label="Teléfono" value={assignedDriver.phone} />}
                        {assignedDriver.email && <PrintRow label="Email"    value={assignedDriver.email} />}
                        <PrintRow label="Tipo" value={assignedDriver.driver_type === "in_house" ? "Propio" : `Externo — ${assignedDriver.contractor_company || "—"}`} />
                      </>
                    ) : <p className="text-xs text-slate-500">Sin conductor asignado</p>}
                    {assignedTruck && <>
                      <PrintRow label="Matrícula camión"    value={assignedTruck.plate} />
                      {assignedTruck.label && <PrintRow label="Etiqueta" value={assignedTruck.label} />}
                    </>}
                    {assignedTrailer && <PrintRow label="Matrícula remolque" value={assignedTrailer.identifier} />}
                  </div>
                </div>

                {/* Pricing */}
                <div>
                  <p className="section-title text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">💶 Precio</p>
                  <div className="space-y-2">
                    {confirmedAssignment.price_per_km != null &&
                      <PrintRow label="Precio / km" value={`${confirmedAssignment.price_per_km.toFixed(2)} €`} />}
                    {confirmedAssignment.price_total != null &&
                      <PrintRow label="Precio total" value={`${confirmedAssignment.price_total.toFixed(2)} €`} bold />}
                    {!confirmedAssignment.price_total && !confirmedAssignment.price_per_km &&
                      <p className="text-xs text-slate-500">Sin precio registrado</p>}
                    {confirmedAssignment.dispatcher_notes &&
                      <PrintRow label="Notas" value={confirmedAssignment.dispatcher_notes} />}
                  </div>
                </div>
              </div>

              {/* Observations */}
              {order.details && (
                <div className="border-t border-slate-700 pt-4 mb-5">
                  <p className="text-xs font-semibold uppercase text-slate-400 mb-2">Observaciones</p>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap obs">{order.details}</p>
                </div>
              )}

              {/* Signature area */}
              <div className="sigs grid grid-cols-2 gap-8 border-t border-slate-700 pt-6 mt-6">
                {["Firma del conductor", "Firma del receptor"].map((label) => (
                  <div key={label}>
                    <p className="text-xs text-slate-500 mb-10">{label}</p>
                    <div className="sig-line border-t border-slate-600" />
                  </div>
                ))}
              </div>

            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-sm text-slate-200">{value}</div>
    </div>
  );
}

function PrintRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="row flex items-baseline justify-between gap-2">
      <span className="lbl text-xs text-slate-500 shrink-0">{label}</span>
      <span className={`val text-sm text-right ${bold ? "font-bold text-white" : "text-slate-200"}`}>{value}</span>
    </div>
  );
}
