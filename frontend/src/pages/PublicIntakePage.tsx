/**
 * PublicIntakePage — Client self-service form
 * Accessible at /pedido?t=rutas2024
 *
 * Flow:
 *  1. Client types their NIF/CIF → system auto-identifies them (punto de carga)
 *  2. Client fills in the destination: postal code + company name
 *  3. Fill cargo, date, route type, notes → submit
 */
import { FormEvent, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, type ClientLookup } from "../api";

const TOKEN_PARAM = "t";

export default function PublicIntakePage() {
  const [params] = useSearchParams();
  const token = params.get(TOKEN_PARAM) ?? "";

  const [ready, setReady]         = useState(false);
  const [tokenError, setTokenError] = useState(false);

  // NIF/CIF lookup state
  const [nifInput, setNifInput]       = useState("");
  const [lookup, setLookup]           = useState<ClientLookup | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupBusy, setLookupBusy]   = useState(false);
  const nifDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Form state
  const [form, setForm] = useState({
    contact_name: "",
    contact_phone: "",
    product: "",
    tonnage: "",
    dropoff_postal_code: "",
    dropoff_company_name: "",
    pickup_date: "",
    route_type: "local",
    notes: "",
  });

  const [error, setError]         = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult]       = useState<{ id: number; pickup: string; dropoff: string } | null>(null);
  const [busy, setBusy]           = useState(false);

  useEffect(() => {
    if (!token) { setTokenError(true); return; }
    api.getIntakeMeta(token)
      .then(() => setReady(true))
      .catch(() => setTokenError(true));
  }, [token]);

  // Debounced NIF/CIF lookup — fires 600ms after user stops typing
  function handleNifChange(val: string) {
    setNifInput(val);
    setLookup(null);
    setLookupError(null);
    if (nifDebounce.current) clearTimeout(nifDebounce.current);
    const clean = val.trim().toUpperCase();
    if (clean.length < 7) return; // too short to bother
    nifDebounce.current = setTimeout(async () => {
      setLookupBusy(true);
      try {
        const r = await api.lookupClientByNif(token, clean);
        if (r.found) {
          setLookup(r);
          setLookupError(null);
        } else {
          setLookup(null);
          setLookupError("NIF/CIF no encontrado. Contacta con nosotros para registrarte.");
        }
      } catch {
        setLookupError("Error al verificar el NIF/CIF.");
      } finally {
        setLookupBusy(false);
      }
    }, 600);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!lookup?.found) {
      setError("Introduce un NIF/CIF válido para identificar tu empresa.");
      return;
    }
    if (!form.product.trim()) {
      setError("La mercancía es obligatoria.");
      return;
    }
    if (!form.dropoff_postal_code.trim() || !form.dropoff_company_name.trim()) {
      setError("El punto de descarga requiere código postal y nombre de la empresa.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await api.submitPublicOrder(token, {
        nif_cif: nifInput.trim().toUpperCase(),
        contact_name: form.contact_name || null,
        contact_phone: form.contact_phone || null,
        product: form.product,
        tonnage: Number(form.tonnage) || 0,
        dropoff_postal_code: form.dropoff_postal_code,
        dropoff_company_name: form.dropoff_company_name,
        pickup_date: form.pickup_date || null,
        route_type: form.route_type,
        notes: form.notes || null,
      });
      setResult({ id: r.order_id, pickup: r.pickup_location, dropoff: r.dropoff_location });
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Extract the detail from the API error
      const match = msg.match(/"detail":"([^"]+)"/);
      setError(match ? match[1] : "Error al enviar el pedido. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  // ── States ──────────────────────────────────────────────────────────────
  const inp = "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200";
  const lbl = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1";

  if (tokenError) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl text-center">
        <div className="mb-4 text-5xl">⚠️</div>
        <p className="text-gray-700">Enlace inválido. Contacta con tu proveedor de transporte.</p>
      </div>
    </div>
  );

  if (!ready) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Cargando…</p>
    </div>
  );

  if (submitted && result) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl text-center">
        <div className="mb-4 text-6xl">✅</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">¡Solicitud recibida!</h1>
        <p className="text-gray-500 mb-6">
          Tu pedido ha llegado a nuestro equipo. Te contactaremos para confirmar.
        </p>
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-sm text-left space-y-2 mb-6">
          <div className="flex justify-between">
            <span className="font-semibold text-gray-600">Referencia</span>
            <span className="text-gray-800 font-mono">#{result.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-gray-600">Carga</span>
            <span className="text-gray-800 text-right max-w-[60%]">{result.pickup}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-gray-600">Descarga</span>
            <span className="text-gray-800 text-right max-w-[60%]">{result.dropoff}</span>
          </div>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Guarda la referencia <strong>#{result.id}</strong> para consultas.
        </p>
        <button
          onClick={() => {
            setSubmitted(false); setResult(null); setLookup(null);
            setNifInput(""); setForm({ contact_name: "", contact_phone: "", product: "", tonnage: "", dropoff_postal_code: "", dropoff_company_name: "", pickup_date: "", route_type: "local", notes: "" });
          }}
          className="w-full rounded-xl bg-green-600 text-white font-semibold py-3 hover:bg-green-500 transition"
        >
          Enviar otro pedido
        </button>
      </div>
    </div>
  );

  // ── Main form ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-lg">

        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green-600 text-white text-2xl shadow-lg">🚛</div>
          <h1 className="text-2xl font-bold text-gray-800">Solicitud de transporte</h1>
          <p className="mt-1 text-sm text-gray-500">Rellena el formulario y nos encargamos del resto.</p>
        </div>

        <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          📨 Tu solicitud llega directamente a nuestro equipo. Te llamamos para confirmar.
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={submit} className="space-y-5 rounded-2xl bg-white p-6 shadow-lg border border-gray-100">

          {/* ── PUNTO DE CARGA — NIF/CIF lookup ── */}
          <div>
            <p className="text-sm font-bold text-gray-700 mb-3">📍 Punto de carga (tu empresa)</p>
            <label className={lbl}>NIF / CIF *</label>
            <input
              className={`${inp} ${lookupError ? "border-red-300" : lookup?.found ? "border-green-400" : ""}`}
              placeholder="B12345678"
              value={nifInput}
              onChange={(e) => handleNifChange(e.target.value)}
            />
            {lookupBusy && <p className="mt-1 text-xs text-gray-400">Buscando…</p>}
            {lookupError && <p className="mt-1 text-xs text-red-600">{lookupError}</p>}

            {/* Auto-filled company info */}
            {lookup?.found && (
              <div className="mt-2 rounded-xl border border-green-200 bg-green-50 p-3">
                <p className="text-xs font-semibold text-green-700 mb-1">✓ Empresa identificada</p>
                <p className="text-sm font-bold text-gray-800">{lookup.name}</p>
                <p className="text-xs text-gray-500">
                  {[lookup.address, lookup.postal_code, lookup.city, lookup.region, lookup.country].filter(Boolean).join(", ")}
                </p>
              </div>
            )}
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Nombre de contacto</label>
              <input className={inp} placeholder="Juan García" value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            </div>
            <div>
              <label className={lbl}>Teléfono</label>
              <input className={inp} type="tel" placeholder="+34 600 000 000" value={form.contact_phone}
                onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* ── PUNTO DE DESCARGA ── */}
          <div>
            <p className="text-sm font-bold text-gray-700 mb-3">🏭 Punto de descarga</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Código postal *</label>
                <input className={inp} placeholder="08080" value={form.dropoff_postal_code}
                  onChange={(e) => setForm({ ...form, dropoff_postal_code: e.target.value })} />
              </div>
              <div>
                <label className={lbl}>Nombre de la empresa *</label>
                <input className={inp} placeholder="Empresa Destino S.L." value={form.dropoff_company_name}
                  onChange={(e) => setForm({ ...form, dropoff_company_name: e.target.value })} />
              </div>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* ── MERCANCÍA ── */}
          <div>
            <p className="text-sm font-bold text-gray-700 mb-3">📦 Mercancía</p>
            <div className="space-y-3">
              <div>
                <label className={lbl}>Tipo de mercancía *</label>
                <input className={inp} placeholder="acero, áridos, cereales, maquinaria…" value={form.product}
                  onChange={(e) => setForm({ ...form, product: e.target.value })} />
              </div>
              <div>
                <label className={lbl}>Toneladas (aproximadas)</label>
                <input className={inp} type="number" min="0" step="0.5" placeholder="24" value={form.tonnage}
                  onChange={(e) => setForm({ ...form, tonnage: e.target.value })} />
              </div>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* ── LOGÍSTICA ── */}
          <div>
            <p className="text-sm font-bold text-gray-700 mb-3">📅 Logística</p>
            <div className="space-y-3">
              <div>
                <label className={lbl}>Fecha de carga deseada</label>
                <input className={inp} type="date" value={form.pickup_date}
                  onChange={(e) => setForm({ ...form, pickup_date: e.target.value })} />
              </div>
              <div>
                <label className={lbl}>Tipo de transporte *</label>
                <div className="flex gap-3">
                  {[{ val: "local", label: "🇪🇸 Nacional / Local" }, { val: "international", label: "🌍 Internacional" }].map(({ val, label }) => (
                    <button key={val} type="button"
                      onClick={() => setForm({ ...form, route_type: val })}
                      className={`flex-1 rounded-xl border py-3 text-sm font-medium transition ${
                        form.route_type === val
                          ? "border-green-500 bg-green-600 text-white"
                          : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-400"
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={lbl}>Observaciones</label>
                <textarea className={`${inp} h-16 resize-none`}
                  placeholder="Instrucciones especiales, horario de carga, referencia…"
                  value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
          </div>

          <button type="submit" disabled={busy || !lookup?.found}
            className="w-full rounded-xl bg-green-600 py-3.5 text-sm font-bold text-white shadow-md hover:bg-green-500 transition disabled:opacity-50">
            {busy ? "Enviando…" : "Enviar solicitud"}
          </button>

          {!lookup?.found && nifInput.length > 0 && !lookupBusy && (
            <p className="text-center text-xs text-gray-400">
              Introduce un NIF/CIF válido para activar el envío.
            </p>
          )}
        </form>

        <p className="mt-4 text-center text-xs text-gray-400">
          Tu solicitud llega directamente a nuestro equipo. Te llamamos para confirmar.
        </p>
      </div>
    </div>
  );
}
