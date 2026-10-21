import { FormEvent, useEffect, useState } from "react";
import { api, type Driver, type Trailer, type Truck } from "../api";
import { Button, Card, ErrorBox, Field, PageHeader, StatusPill, inputClass } from "../ui";

type Tab = "trucks" | "trailers" | "drivers";

export default function FleetPage() {
  const [tab, setTab] = useState<Tab>("trucks");
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [trailers, setTrailers] = useState<Trailer[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [error, setError] = useState<string | null>(null);

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
        {(["trucks", "trailers", "drivers"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
              tab === t ? "bg-brand-600 text-white" : "bg-ink-700 text-slate-300 hover:bg-ink-600"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "trucks" && <Trucks trucks={trucks} trailers={trailers} reload={load} />}
      {tab === "trailers" && <Trailers trailers={trailers} reload={load} />}
      {tab === "drivers" && <Drivers drivers={drivers} trucks={trucks} reload={load} />}
    </div>
  );
}

/* ----------------------------- Trucks ----------------------------- */
function Trucks({ trucks, trailers, reload }: { trucks: Truck[]; trailers: Trailer[]; reload: () => void }) {
  const [f, setF] = useState({ plate: "", label: "", home_lat: "", home_lng: "", gps_device_id: "", default_trailer_id: "" });

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!f.plate.trim()) return;
    await api.createTruck({
      plate: f.plate,
      label: f.label || null,
      home_lat: f.home_lat ? Number(f.home_lat) : null,
      home_lng: f.home_lng ? Number(f.home_lng) : null,
      gps_device_id: f.gps_device_id || null,
      default_trailer_id: f.default_trailer_id ? Number(f.default_trailer_id) : null,
    });
    setF({ plate: "", label: "", home_lat: "", home_lng: "", gps_device_id: "", default_trailer_id: "" });
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
              <Button variant="danger" onClick={async () => { await api.deleteTruck(t.id); reload(); }}>Delete</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------- Trailers ----------------------------- */
function Trailers({ trailers, reload }: { trailers: Trailer[]; reload: () => void }) {
  const [f, setF] = useState({ identifier: "", trailer_type: "", allowed_products: "", max_tonnage: "", max_volume_m3: "" });

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!f.identifier.trim()) return;
    await api.createTrailer({
      identifier: f.identifier,
      trailer_type: f.trailer_type,
      allowed_products: f.allowed_products,
      max_tonnage: Number(f.max_tonnage) || 0,
      max_volume_m3: Number(f.max_volume_m3) || 0,
    });
    setF({ identifier: "", trailer_type: "", allowed_products: "", max_tonnage: "", max_volume_m3: "" });
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
              <Button variant="danger" onClick={async () => { await api.deleteTrailer(t.id); reload(); }}>Delete</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------- Drivers ----------------------------- */
function Drivers({ drivers, trucks, reload }: { drivers: Driver[]; trucks: Truck[]; reload: () => void }) {
  const [f, setF] = useState({ name: "", phone: "", truck_id: "" });

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return;
    await api.createDriver({
      name: f.name,
      phone: f.phone || null,
      truck_id: f.truck_id ? Number(f.truck_id) : null,
    });
    setF({ name: "", phone: "", truck_id: "" });
    reload();
  }

  return (
    <div>
      <Card className="mb-6">
        <form onSubmit={add} className="grid grid-cols-3 gap-4">
          <Field label="Name"><input className={inputClass} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Phone"><input className={inputClass} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Assigned truck">
            <select className={inputClass} value={f.truck_id} onChange={(e) => setF({ ...f, truck_id: e.target.value })}>
              <option value="">— none —</option>
              {trucks.map((t) => <option key={t.id} value={t.id}>{t.plate}</option>)}
            </select>
          </Field>
          <div className="col-span-3"><Button type="submit">Add driver</Button></div>
        </form>
      </Card>
      <div className="space-y-2">
        {drivers.map((d) => (
          <Card key={d.id}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-white">{d.name}</span>
                  <StatusPill status={d.status} />
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {d.phone || "no phone"} · truck #{d.truck_id ?? "—"}
                </div>
              </div>
              <Button variant="danger" onClick={async () => { await api.deleteDriver(d.id); reload(); }}>Delete</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
