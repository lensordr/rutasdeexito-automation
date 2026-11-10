import { FormEvent, useEffect, useState } from "react";
import { api, type Driver, type DriverType, type RouteType, type Trailer, type Truck } from "../api";
import { Button, Card, ErrorBox, Field, PageHeader, StatusPill, inputClass } from "../ui";

type Tab = "trucks" | "trailers" | "drivers" | "itv";

// ── ITV helpers ─────────────────────────────────────────────────────────────
const MS_DAY = 86_400_000;

function itvStatus(expiry: string | null | undefined): "expired" | "urgent" | "soon" | "ok" | "none" {
  if (!expiry) return "none";
  const diff = new Date(expiry).getTime() - Date.now();
  const days = diff / MS_DAY;
  if (days < 0) return "expired";
  if (days <= 7) return "urgent";
  if (days <= 30) return "soon";
  return "ok";
}

function daysLabel(expiry: string | null | undefined): string {
  if (!expiry) return "—";
  const diff = new Date(expiry).getTime() - Date.now();
  const days = Math.ceil(diff / MS_DAY);
  if (days < 0) return `Caducada hace ${Math.abs(days)} días`;
  if (days === 0) return "Caduca hoy";
  return `${days} días`;
}

const ITV_ROW: Record<string, string> = {
  expired: "border-l-4 border-red-500 bg-red-950/40",
  urgent:  "border-l-4 border-red-400 bg-red-900/30",
  soon:    "border-l-4 border-yellow-400 bg-yellow-900/20",
  ok:      "",
  none:    "",
};

const ITV_BADGE: Record<string, string> = {
  expired: "bg-red-600 text-white",
  urgent:  "bg-red-500 text-white",
  soon:    "bg-yellow-500 text-black",
  ok:      "bg-green-600 text-white",
  none:    "bg-slate-600 text-slate-300",
};

const ITV_LABEL: Record<string, string> = {
  expired: "CADUCADA",
  urgent:  "URGENTE",
  soon:    "Próxima",
  ok:      "OK",
  none:    "Sin fecha",
};

export default function FleetPage() {
  const [tab, setTab] = useState<Tab>("trucks");
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [trailers, setTrailers] = useState<Trailer[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  async function load() {
    try {
      const [tr, tl, dr] = await Promise.all([
        api.listTrucks(),
        api.listTrailers(),
        api.listDrivers(),
      ]);
      setTrucks(tr);
      setTrailers(tl);
      setDrivers(dr);
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <PageHeader title="Fleet" subtitle="Manage trucks, trailers and drivers." />
      {error && <ErrorBox message={error} />}

      <div className="mb-5 flex gap-2">
        {(["trucks", "trailers", "drivers", "itv"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setSearch(""); }}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
              tab === t ? "bg-brand-600 text-white" : "bg-ink-700 text-slate-300 hover:bg-ink-600"
            }`}
          >
            {t === "itv" ? "ITV Remolques" : t}
          </button>
        ))}
      </div>

      {/* Per-tab search */}
      {tab !== "itv" && (
        <div className="mb-4">
          <input
            className={`${inputClass} max-w-sm`}
            placeholder={
              tab === "trucks" ? "Buscar por matrícula o etiqueta…" :
              tab === "trailers" ? "Buscar por identificador o tipo…" :
              "Buscar por nombre o empresa…"
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {tab === "trucks" && <Trucks trucks={trucks.filter(t => !search || `${t.plate} ${t.label ?? ""}`.toLowerCase().includes(search.toLowerCase()))} trailers={trailers} reload={load} />}
      {tab === "trailers" && <Trailers trailers={trailers.filter(t => !search || `${t.identifier} ${t.trailer_type}`.toLowerCase().includes(search.toLowerCase()))} reload={load} />}
      {tab === "drivers" && <Drivers drivers={drivers.filter(d => !search || `${d.name} ${d.contractor_company ?? ""}`.toLowerCase().includes(search.toLowerCase()))} trucks={trucks} reload={load} />}
      {tab === "itv" && <ItvTab trailers={trailers} trucks={trucks} reload={load} />}
    </div>
  );
}

/* ----------------------------- Trucks ----------------------------- */
function Trucks({ trucks, trailers, reload }: { trucks: Truck[]; trailers: Trailer[]; reload: () => void }) {
  const emptyF = { plate: "", label: "", home_lat: "", home_lng: "", gps_device_id: "", default_trailer_id: "" };
  const [f, setF] = useState(emptyF);
  const [editId, setEditId] = useState<number | null>(null);
  const [editF, setEditF] = useState(emptyF);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!f.plate.trim()) return;
    await api.createTruck({
      plate: f.plate, label: f.label || null,
      home_lat: f.home_lat ? Number(f.home_lat) : null,
      home_lng: f.home_lng ? Number(f.home_lng) : null,
      gps_device_id: f.gps_device_id || null,
      default_trailer_id: f.default_trailer_id ? Number(f.default_trailer_id) : null,
    });
    setF(emptyF);
    reload();
  }

  function startEdit(t: Truck) {
    setEditId(t.id);
    setEditF({
      plate: t.plate, label: t.label ?? "",
      home_lat: t.home_lat != null ? String(t.home_lat) : "",
      home_lng: t.home_lng != null ? String(t.home_lng) : "",
      gps_device_id: t.gps_device_id ?? "",
      default_trailer_id: t.default_trailer_id != null ? String(t.default_trailer_id) : "",
    });
  }

  async function saveEdit(e: FormEvent, id: number) {
    e.preventDefault();
    await api.updateTruck(id, {
      plate: editF.plate, label: editF.label || null,
      home_lat: editF.home_lat ? Number(editF.home_lat) : null,
      home_lng: editF.home_lng ? Number(editF.home_lng) : null,
      gps_device_id: editF.gps_device_id || null,
      default_trailer_id: editF.default_trailer_id ? Number(editF.default_trailer_id) : null,
    });
    setEditId(null);
    reload();
  }

  return (
    <div>
      <Card className="mb-6">
        <form onSubmit={add} className="grid grid-cols-3 gap-4">
          <Field label="Plate"><input className={inputClass} value={f.plate} onChange={(e) => setF({ ...f, plate: e.target.value })} /></Field>
          <Field label="Label"><input className={inputClass} value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></Field>
          <Field label="Default trailer">
            <select className={inputClass} value={f.default_trailer_id} onChange={(e) => setF({ ...f, default_trailer_id: e.target.value })}>
              <option value="">— none —</option>
              {trailers.map((t) => <option key={t.id} value={t.id}>{t.identifier} ({t.trailer_type})</option>)}
            </select>
          </Field>
          <Field label="Home lat"><input className={inputClass} value={f.home_lat} onChange={(e) => setF({ ...f, home_lat: e.target.value })} /></Field>
          <Field label="Home lng"><input className={inputClass} value={f.home_lng} onChange={(e) => setF({ ...f, home_lng: e.target.value })} /></Field>
          <Field label="GPS device id"><input className={inputClass} value={f.gps_device_id} onChange={(e) => setF({ ...f, gps_device_id: e.target.value })} /></Field>
          <div className="col-span-3"><Button type="submit">Add truck</Button></div>
        </form>
      </Card>
      <div className="space-y-2">
        {trucks.map((t) => (
          <Card key={t.id}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-white">{t.plate}</span>
                  <span className="text-sm text-slate-400">{t.label}</span>
                  <StatusPill status={t.status} />
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  GPS {t.gps_device_id || "—"} · trailer #{t.default_trailer_id ?? "—"}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => editId === t.id ? setEditId(null) : startEdit(t)}>
                  {editId === t.id ? "Cerrar ▲" : "Editar ▼"}
                </Button>
                <Button variant="danger" onClick={async () => { await api.deleteTruck(t.id); reload(); }}>Delete</Button>
              </div>
            </div>
            {editId === t.id && (
              <div className="mt-3 border-t border-slate-700 pt-3">
                <form onSubmit={(e) => saveEdit(e, t.id)} className="grid grid-cols-3 gap-4">
                  <Field label="Plate"><input className={inputClass} value={editF.plate} onChange={(e) => setEditF({ ...editF, plate: e.target.value })} /></Field>
                  <Field label="Label"><input className={inputClass} value={editF.label} onChange={(e) => setEditF({ ...editF, label: e.target.value })} /></Field>
                  <Field label="Default trailer">
                    <select className={inputClass} value={editF.default_trailer_id} onChange={(e) => setEditF({ ...editF, default_trailer_id: e.target.value })}>
                      <option value="">— none —</option>
                      {trailers.map((tr) => <option key={tr.id} value={tr.id}>{tr.identifier} ({tr.trailer_type})</option>)}
                    </select>
                  </Field>
                  <Field label="Home lat"><input className={inputClass} value={editF.home_lat} onChange={(e) => setEditF({ ...editF, home_lat: e.target.value })} /></Field>
                  <Field label="Home lng"><input className={inputClass} value={editF.home_lng} onChange={(e) => setEditF({ ...editF, home_lng: e.target.value })} /></Field>
                  <Field label="GPS device id"><input className={inputClass} value={editF.gps_device_id} onChange={(e) => setEditF({ ...editF, gps_device_id: e.target.value })} /></Field>
                  <div className="col-span-3 flex gap-2">
                    <Button type="submit">Guardar</Button>
                    <Button variant="danger" type="button" onClick={() => setEditId(null)}>Cancelar</Button>
                  </div>
                </form>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------- Trailers ----------------------------- */
function Trailers({ trailers, reload }: { trailers: Trailer[]; reload: () => void }) {
  const emptyF = { identifier: "", trailer_type: "", allowed_products: "", max_tonnage: "", max_volume_m3: "" };
  const [f, setF] = useState(emptyF);
  const [editId, setEditId] = useState<number | null>(null);
  const [editF, setEditF] = useState(emptyF);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!f.identifier.trim()) return;
    await api.createTrailer({
      identifier: f.identifier, trailer_type: f.trailer_type,
      allowed_products: f.allowed_products,
      max_tonnage: Number(f.max_tonnage) || 0,
      max_volume_m3: Number(f.max_volume_m3) || 0,
    });
    setF(emptyF);
    reload();
  }

  function startEdit(t: Trailer) {
    setEditId(t.id);
    setEditF({
      identifier: t.identifier, trailer_type: t.trailer_type,
      allowed_products: t.allowed_products,
      max_tonnage: String(t.max_tonnage),
      max_volume_m3: String(t.max_volume_m3),
    });
  }

  async function saveEdit(e: FormEvent, id: number) {
    e.preventDefault();
    await api.updateTrailer(id, {
      identifier: editF.identifier, trailer_type: editF.trailer_type,
      allowed_products: editF.allowed_products,
      max_tonnage: Number(editF.max_tonnage) || 0,
      max_volume_m3: Number(editF.max_volume_m3) || 0,
    });
    setEditId(null);
    reload();
  }

  return (
    <div>
      <Card className="mb-6">
        <form onSubmit={add} className="grid grid-cols-3 gap-4">
          <Field label="Identifier / plate"><input className={inputClass} value={f.identifier} onChange={(e) => setF({ ...f, identifier: e.target.value })} /></Field>
          <Field label="Type"><input className={inputClass} placeholder="tipper, tanker, curtain…" value={f.trailer_type} onChange={(e) => setF({ ...f, trailer_type: e.target.value })} /></Field>
          <Field label="Allowed products (comma-sep)"><input className={inputClass} placeholder="grain,sand,cement" value={f.allowed_products} onChange={(e) => setF({ ...f, allowed_products: e.target.value })} /></Field>
          <Field label="Max tonnage (t)"><input className={inputClass} type="number" value={f.max_tonnage} onChange={(e) => setF({ ...f, max_tonnage: e.target.value })} /></Field>
          <Field label="Max volume (m³)"><input className={inputClass} type="number" value={f.max_volume_m3} onChange={(e) => setF({ ...f, max_volume_m3: e.target.value })} /></Field>
          <div className="col-span-3"><Button type="submit">Add trailer</Button></div>
        </form>
      </Card>
      <div className="space-y-2">
        {trailers.map((t) => (
          <Card key={t.id}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-white">{t.identifier}</span>
                  <span className="text-sm text-slate-400">{t.trailer_type}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  carries: {t.allowed_products || "any"} · max {t.max_tonnage}t / {t.max_volume_m3}m³
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => editId === t.id ? setEditId(null) : startEdit(t)}>
                  {editId === t.id ? "Cerrar ▲" : "Editar ▼"}
                </Button>
                <Button variant="danger" onClick={async () => { await api.deleteTrailer(t.id); reload(); }}>Delete</Button>
              </div>
            </div>
            {editId === t.id && (
              <div className="mt-3 border-t border-slate-700 pt-3">
                <form onSubmit={(e) => saveEdit(e, t.id)} className="grid grid-cols-3 gap-4">
                  <Field label="Identifier / plate"><input className={inputClass} value={editF.identifier} onChange={(e) => setEditF({ ...editF, identifier: e.target.value })} /></Field>
                  <Field label="Type"><input className={inputClass} value={editF.trailer_type} onChange={(e) => setEditF({ ...editF, trailer_type: e.target.value })} /></Field>
                  <Field label="Allowed products"><input className={inputClass} value={editF.allowed_products} onChange={(e) => setEditF({ ...editF, allowed_products: e.target.value })} /></Field>
                  <Field label="Max tonnage (t)"><input className={inputClass} type="number" value={editF.max_tonnage} onChange={(e) => setEditF({ ...editF, max_tonnage: e.target.value })} /></Field>
                  <Field label="Max volume (m³)"><input className={inputClass} type="number" value={editF.max_volume_m3} onChange={(e) => setEditF({ ...editF, max_volume_m3: e.target.value })} /></Field>
                  <div className="col-span-3 flex gap-2">
                    <Button type="submit">Guardar</Button>
                    <Button variant="danger" type="button" onClick={() => setEditId(null)}>Cancelar</Button>
                  </div>
                </form>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------- Drivers ----------------------------- */
const TRAILER_TYPE_OPTIONS = ["curtainsider", "flatbed", "aluminium", "low-loader", "tanker", "tipper"];

type DriverFormState = {
  name: string; phone: string; email: string; dni_nie: string; truck_id: string;
  driver_type: DriverType; contractor_company: string;
  route_type: RouteType; preferred_trailer_types: string[]; notes: string;
};

const emptyDriverF: DriverFormState = {
  name: "", phone: "", email: "", dni_nie: "", truck_id: "",
  driver_type: "in_house",
  contractor_company: "",
  route_type: "both",
  preferred_trailer_types: [],
  notes: "",
};

function driverToForm(d: Driver): DriverFormState {
  return {
    name: d.name, phone: d.phone ?? "", email: d.email ?? "", dni_nie: d.dni_nie ?? "",
    truck_id: d.truck_id != null ? String(d.truck_id) : "",
    driver_type: d.driver_type,
    contractor_company: d.contractor_company ?? "",
    route_type: d.route_type,
    preferred_trailer_types: d.preferred_trailer_types
      ? d.preferred_trailer_types.split(",").map((s) => s.trim()).filter(Boolean)
      : [],
    notes: d.notes ?? "",
  };
}

function formToApi(form: DriverFormState) {
  return {
    name: form.name, phone: form.phone || null, email: form.email || null,
    dni_nie: form.dni_nie || null,
    truck_id: form.truck_id ? Number(form.truck_id) : null,
    driver_type: form.driver_type,
    contractor_company: form.contractor_company || null,
    route_type: form.route_type,
    preferred_trailer_types: form.preferred_trailer_types.join(","),
    notes: form.notes || null,
  };
}

const DRIVER_TYPE_LABEL: Record<string, string> = {
  in_house: "Propio", contractor: "Transportista externo",
};
const ROUTE_LABEL: Record<string, string> = {
  local: "Local", international: "Internacional", both: "Local + Internacional",
};
const ROUTE_COLOR: Record<string, string> = {
  local: "bg-blue-700 text-white",
  international: "bg-purple-700 text-white",
  both: "bg-teal-700 text-white",
};
const TYPE_COLOR: Record<string, string> = {
  in_house: "bg-green-800 text-green-200",
  contractor: "bg-orange-800 text-orange-200",
};

function DriverFields({ form, setForm, trucks }: {
  form: DriverFormState;
  setForm: (f: DriverFormState) => void;
  trucks: Truck[];
}) {
  function toggleTrailer(t: string) {
    const types = form.preferred_trailer_types;
    setForm({ ...form, preferred_trailer_types: types.includes(t) ? types.filter((x) => x !== t) : [...types, t] });
  }
  return (
    <>
      <Field label="Nombre *">
        <input className={inputClass} value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field label="Teléfono">
        <input className={inputClass} value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </Field>
      <Field label="Email">
        <input className={inputClass} type="email" value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </Field>
      <Field label="DNI / NIE">
        <input className={inputClass} placeholder="12345678A / X1234567A"
          value={form.dni_nie}
          onChange={(e) => setForm({ ...form, dni_nie: e.target.value })} />
      </Field>
      <Field label="Tipo de conductor">
        <select className={inputClass} value={form.driver_type}
          onChange={(e) => setForm({ ...form, driver_type: e.target.value as DriverType })}>
          <option value="in_house">Propio</option>
          <option value="contractor">Transportista externo</option>
        </select>
      </Field>
      {form.driver_type === "contractor" && (
        <Field label="Empresa transportista">
          <input className={inputClass} placeholder="Transportes García S.L."
            value={form.contractor_company}
            onChange={(e) => setForm({ ...form, contractor_company: e.target.value })} />
        </Field>
      )}
      <Field label="Tipo de ruta">
        <select className={inputClass} value={form.route_type}
          onChange={(e) => setForm({ ...form, route_type: e.target.value as RouteType })}>
          <option value="both">Local + Internacional</option>
          <option value="local">Solo local</option>
          <option value="international">Solo internacional</option>
        </select>
      </Field>
      <div className="col-span-3">
        <label className="mb-2 block text-xs font-medium text-slate-400">Tipos de remolque habilitados</label>
        <div className="flex flex-wrap gap-2">
          {TRAILER_TYPE_OPTIONS.map((t) => (
            <button key={t} type="button" onClick={() => toggleTrailer(t)}
              className={`rounded-lg border px-3 py-1 text-xs font-medium transition ${
                form.preferred_trailer_types.includes(t)
                  ? "border-brand-500 bg-brand-600 text-white"
                  : "border-slate-600 bg-ink-700 text-slate-400 hover:border-slate-400"
              }`}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <Field label="Camión asignado">
        <select className={inputClass} value={form.truck_id}
          onChange={(e) => setForm({ ...form, truck_id: e.target.value })}>
          <option value="">— ninguno —</option>
          {trucks.map((t) => <option key={t.id} value={t.id}>{t.plate}{t.label ? ` · ${t.label}` : ""}</option>)}
        </select>
      </Field>
      <Field label="Notas">
        <input className={inputClass} value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>
    </>
  );
}

function Drivers({ drivers, trucks, reload }: { drivers: Driver[]; trucks: Truck[]; reload: () => void }) {
  const [f, setF] = useState<DriverFormState>(emptyDriverF);
  const [editId, setEditId] = useState<number | null>(null);
  const [editF, setEditF] = useState<DriverFormState>(emptyDriverF);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return;
    await api.createDriver(formToApi(f));
    setF(emptyDriverF);
    reload();
  }

  async function saveEdit(e: FormEvent, id: number) {
    e.preventDefault();
    await api.updateDriver(id, formToApi(editF));
    setEditId(null);
    reload();
  }

  return (
    <div>
      <Card className="mb-6">
        <p className="mb-4 text-sm font-semibold text-slate-300">Nuevo conductor / transportista</p>
        <form onSubmit={add} className="grid grid-cols-3 gap-4">
          <DriverFields form={f} setForm={setF} trucks={trucks} />
          <div className="col-span-3">
            <Button type="submit">Añadir</Button>
          </div>
        </form>
      </Card>

      <div className="space-y-2">
        {drivers.map((d) => (
          <Card key={d.id}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-white">{d.name}</span>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${TYPE_COLOR[d.driver_type]}`}>
                    {DRIVER_TYPE_LABEL[d.driver_type]}
                  </span>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${ROUTE_COLOR[d.route_type]}`}>
                    {ROUTE_LABEL[d.route_type]}
                  </span>
                  <StatusPill status={d.status} />
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {d.contractor_company && <span>{d.contractor_company} · </span>}
                  {d.phone || "sin tel."}{d.email ? ` · ${d.email}` : ""}
                  {d.dni_nie ? ` · DNI/NIE: ${d.dni_nie}` : ""}
                  {" · camión #"}{d.truck_id ?? "—"}
                </div>
                {d.preferred_trailer_types && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {d.preferred_trailer_types.split(",").filter(Boolean).map((t) => (
                      <span key={t} className="rounded bg-ink-600 px-2 py-0.5 text-xs text-slate-400">{t.trim()}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {/* Status toggle */}
                <select
                  className="rounded-lg border border-slate-600 bg-ink-800 px-2 py-1.5 text-xs text-slate-300 focus:outline-none"
                  value={d.status}
                  onChange={async (e) => {
                    await api.updateDriver(d.id, { status: e.target.value as Driver["status"] });
                    reload();
                  }}
                >
                  <option value="available">Disponible</option>
                  <option value="driving">Conduciendo</option>
                  <option value="off_duty">Fuera de servicio</option>
                </select>
                <Button onClick={() => {
                  if (editId === d.id) { setEditId(null); }
                  else { setEditId(d.id); setEditF(driverToForm(d)); }
                }}>
                  {editId === d.id ? "Cerrar ▲" : "Editar ▼"}
                </Button>
                <Button variant="danger" onClick={async () => { await api.deleteDriver(d.id); reload(); }}>Delete</Button>
              </div>
            </div>
            {editId === d.id && (
              <div className="mt-3 border-t border-slate-700 pt-3">
                <form onSubmit={(e) => saveEdit(e, d.id)} className="grid grid-cols-3 gap-4">
                  <DriverFields form={editF} setForm={setEditF} trucks={trucks} />
                  <div className="col-span-3 flex gap-2">
                    <Button type="submit">Guardar</Button>
                    <Button variant="danger" type="button" onClick={() => setEditId(null)}>Cancelar</Button>
                  </div>
                </form>
              </div>
            )}
          </Card>
        ))}
        {drivers.length === 0 && (
          <p className="text-sm text-slate-500">No hay conductores registrados todavía.</p>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- ITV Tab ----------------------------- */
function ItvTab({ trailers, trucks, reload }: { trailers: Trailer[]; trucks: Truck[]; reload: () => void }) {
  type EditTarget = { kind: "truck"; id: number } | { kind: "trailer"; id: number } | null;
  const [editing, setEditing] = useState<EditTarget>(null);
  const [f, setF] = useState({ piston_type: "", itv_expiry: "" });
  const [saving, setSaving] = useState(false);

  const order = { expired: 0, urgent: 1, soon: 2, ok: 3, none: 4 };
  const sortedTrucks = [...trucks].sort((a, b) => order[itvStatus(a.itv_expiry)] - order[itvStatus(b.itv_expiry)]);
  const sortedTrailers = [...trailers].sort((a, b) => order[itvStatus(a.itv_expiry)] - order[itvStatus(b.itv_expiry)]);

  function isEditing(kind: "truck" | "trailer", id: number) {
    return editing?.kind === kind && editing.id === id;
  }

  function toggleEditTruck(t: Truck) {
    if (isEditing("truck", t.id)) { setEditing(null); return; }
    setEditing({ kind: "truck", id: t.id });
    const existing = t.itv_expiry ? new Date(t.itv_expiry) : null;
    const formatted = existing
      ? `${String(existing.getDate()).padStart(2,"0")}/${String(existing.getMonth()+1).padStart(2,"0")}/${existing.getFullYear()}`
      : "";
    setF({ piston_type: "", itv_expiry: formatted });
  }

  function toggleEditTrailer(t: Trailer) {
    if (isEditing("trailer", t.id)) { setEditing(null); return; }
    setEditing({ kind: "trailer", id: t.id });
    const existing = t.itv_expiry ? new Date(t.itv_expiry) : null;
    const formatted = existing
      ? `${String(existing.getDate()).padStart(2,"0")}/${String(existing.getMonth()+1).padStart(2,"0")}/${existing.getFullYear()}`
      : "";
    setF({ piston_type: t.piston_type ?? "", itv_expiry: formatted });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (f.itv_expiry.trim() && parseDate(f.itv_expiry) === null) return;
    setSaving(true);
    try {
      const expiry = f.itv_expiry.trim() ? parseDate(f.itv_expiry) : null;
      if (editing.kind === "truck") {
        await api.updateTruck(editing.id, { itv_expiry: expiry });
      } else {
        await api.updateTrailer(editing.id, { piston_type: f.piston_type || null, itv_expiry: expiry });
      }
      setEditing(null);
      reload();
    } finally {
      setSaving(false);
    }
  }

  async function markExpired(kind: "truck" | "trailer", id: number) {
    // Set expiry to yesterday — definitively expired
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const expiry = yesterday.toISOString();
    if (kind === "truck") {
      await api.updateTruck(id, { itv_expiry: expiry });
    } else {
      await api.updateTrailer(id, { itv_expiry: expiry });
    }
    setEditing(null);
    reload();
  }

  // Counts across both fleets
  const allItems = [...trucks.map((t) => t.itv_expiry), ...trailers.map((t) => t.itv_expiry)];
  const counts = { expired: 0, urgent: 0, soon: 0, ok: 0, none: 0 };
  allItems.forEach((d) => counts[itvStatus(d)]++);

  // Parse DD/MM/YYYY → ISO string, returns null if invalid
  function parseDate(raw: string): string | null {
    const clean = raw.trim();
    const match = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (!match) return null;
    const [, d, m, y] = match;
    const date = new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  const dateError = f.itv_expiry.trim() !== "" && parseDate(f.itv_expiry) === null;

  return (
    <div>
      {/* Summary bar */}
      <div className="mb-6 grid grid-cols-4 gap-3">
        {[
          { key: "expired", label: "Caducadas",   bg: "bg-red-900/50 border border-red-700" },
          { key: "urgent",  label: "Esta semana", bg: "bg-red-800/40 border border-red-600" },
          { key: "soon",    label: "Este mes",    bg: "bg-yellow-900/40 border border-yellow-600" },
          { key: "ok",      label: "Al día",      bg: "bg-green-900/30 border border-green-700" },
        ].map(({ key, label, bg }) => (
          <div key={key} className={`rounded-lg p-4 text-center ${bg}`}>
            <div className="text-2xl font-bold text-white">{counts[key as keyof typeof counts]}</div>
            <div className="mt-1 text-xs text-slate-400">{label}</div>
          </div>
        ))}
      </div>

      {/* ── Camiones ── */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Camiones</h2>
      <div className="mb-8 space-y-2">
        {sortedTrucks.map((t) => {
          const status = itvStatus(t.itv_expiry);
          const open = isEditing("truck", t.id);
          return (
            <Card key={t.id} className={ITV_ROW[status]}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className={`rounded px-2 py-0.5 text-xs font-bold ${ITV_BADGE[status]}`}>
                    {ITV_LABEL[status]}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{t.plate}</span>
                      {t.label && <span className="text-xs text-slate-400">{t.label}</span>}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {t.itv_expiry ? (
                        <>
                          ITV: {new Date(t.itv_expiry).toLocaleDateString("es-ES")}
                          {" · "}
                          <span className={status === "expired" || status === "urgent" ? "text-red-400 font-medium" : "text-slate-400"}>
                            {daysLabel(t.itv_expiry)}
                          </span>
                        </>
                      ) : "ITV: sin registrar"}
                    </div>
                  </div>
                </div>
                <Button onClick={() => toggleEditTruck(t)}>{open ? "Cerrar ▲" : "Editar ITV ▼"}</Button>
              </div>
              {open && (
                <div className="mt-3 border-t border-slate-700 pt-3">
                  <form onSubmit={save} className="flex flex-wrap items-end gap-3">
                    <Field label="Fecha vencimiento ITV (DD/MM/AAAA)">
                      <input
                        type="text"
                        className={`${inputClass} ${dateError ? "border border-red-500" : ""}`}
                        placeholder="12/12/2026"
                        value={f.itv_expiry}
                        onChange={(e) => setF({ ...f, itv_expiry: e.target.value })}
                      />
                      {dateError && <p className="mt-1 text-xs text-red-400">Formato inválido — usa DD/MM/AAAA</p>}
                    </Field>
                    <div className="flex gap-2 pb-0.5">
                      <Button type="submit" disabled={saving || dateError}>{saving ? "Guardando…" : "Guardar"}</Button>
                      <button type="button" onClick={() => markExpired("truck", t.id)} className="rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-600 transition">Marcar caducada</button>
                      <Button variant="danger" type="button" onClick={() => setEditing(null)}>Cancelar</Button>
                    </div>
                  </form>
                </div>
              )}
            </Card>
          );
        })}
        {trucks.length === 0 && (
          <p className="text-sm text-slate-500">No hay camiones registrados.</p>
        )}
      </div>

      {/* ── Remolques ── */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Remolques</h2>
      <div className="space-y-2">
        {sortedTrailers.map((t) => {
          const status = itvStatus(t.itv_expiry);
          const linkedTruck = trucks.find((tk) => tk.default_trailer_id === t.id);
          const open = isEditing("trailer", t.id);
          return (
            <Card key={t.id} className={ITV_ROW[status]}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className={`rounded px-2 py-0.5 text-xs font-bold ${ITV_BADGE[status]}`}>
                    {ITV_LABEL[status]}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{t.identifier}</span>
                      {t.piston_type && (
                        <span className="rounded bg-ink-600 px-2 py-0.5 text-xs text-slate-300">
                          {t.piston_type}
                        </span>
                      )}
                      <span className="text-xs text-slate-500">{t.trailer_type}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      Camión: {linkedTruck ? linkedTruck.plate : "—"}
                      {t.itv_expiry ? (
                        <>
                          {" · "}ITV: {new Date(t.itv_expiry).toLocaleDateString("es-ES")}
                          {" · "}
                          <span className={status === "expired" || status === "urgent" ? "text-red-400 font-medium" : "text-slate-400"}>
                            {daysLabel(t.itv_expiry)}
                          </span>
                        </>
                      ) : " · ITV: sin registrar"}
                    </div>
                  </div>
                </div>
                <Button onClick={() => toggleEditTrailer(t)}>{open ? "Cerrar ▲" : "Editar ITV ▼"}</Button>
              </div>
              {open && (
                <div className="mt-3 border-t border-slate-700 pt-3">
                  <form onSubmit={save} className="flex flex-wrap items-end gap-3">
                    <Field label="Tipo pistón">
                      <select
                        className={inputClass}
                        value={f.piston_type}
                        onChange={(e) => setF({ ...f, piston_type: e.target.value })}
                      >
                        <option value="">— seleccionar —</option>
                        <option value="FP">FP</option>
                        <option value="F">F</option>
                        <option value="Aluminio">Aluminio</option>
                      </select>
                    </Field>
                    <Field label="Fecha vencimiento ITV (DD/MM/AAAA)">
                      <input
                        type="text"
                        className={`${inputClass} ${dateError ? "border border-red-500" : ""}`}
                        placeholder="12/12/2026"
                        value={f.itv_expiry}
                        onChange={(e) => setF({ ...f, itv_expiry: e.target.value })}
                      />
                      {dateError && <p className="mt-1 text-xs text-red-400">Formato inválido — usa DD/MM/AAAA</p>}
                    </Field>
                    <div className="flex gap-2 pb-0.5">
                      <Button type="submit" disabled={saving || dateError}>{saving ? "Guardando…" : "Guardar"}</Button>
                      <button type="button" onClick={() => markExpired("trailer", t.id)} className="rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-600 transition">Marcar caducada</button>
                      <Button variant="danger" type="button" onClick={() => setEditing(null)}>Cancelar</Button>
                    </div>
                  </form>
                </div>
              )}
            </Card>
          );
        })}
        {trailers.length === 0 && (
          <p className="text-sm text-slate-500">No hay remolques registrados. Añádelos en la pestaña Trailers.</p>
        )}
      </div>
    </div>
  );
}
