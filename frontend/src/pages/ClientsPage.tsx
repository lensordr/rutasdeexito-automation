import { FormEvent, useEffect, useState } from "react";
import { api, type Client } from "../api";
import { Button, Card, ErrorBox, Field, PageHeader, inputClass } from "../ui";

const COUNTRIES = [
  { code: "ES", label: "España" },
  { code: "PT", label: "Portugal" },
  { code: "FR", label: "Francia" },
  { code: "DE", label: "Alemania" },
  { code: "IT", label: "Italia" },
  { code: "NL", label: "Países Bajos" },
  { code: "BE", label: "Bélgica" },
  { code: "PL", label: "Polonia" },
  { code: "GB", label: "Reino Unido" },
  { code: "MA", label: "Marruecos" },
];

type ClientForm = {
  name: string; nif_cif: string; contact_name: string;
  email: string; phone: string; website: string;
  address: string; postal_code: string; city: string;
  region: string; country: string; notes: string;
};

const emptyForm: ClientForm = {
  name: "", nif_cif: "", contact_name: "",
  email: "", phone: "", website: "",
  address: "", postal_code: "", city: "",
  region: "", country: "ES", notes: "",
};

function fromClient(c: Client): ClientForm {
  return {
    name: c.name, nif_cif: c.nif_cif ?? "", contact_name: c.contact_name ?? "",
    email: c.email ?? "", phone: c.phone ?? "", website: c.website ?? "",
    address: c.address ?? "", postal_code: c.postal_code ?? "", city: c.city ?? "",
    region: c.region ?? "", country: c.country || "ES", notes: c.notes ?? "",
  };
}

function toApi(f: ClientForm) {
  return {
    name: f.name,
    nif_cif: f.nif_cif || null,
    contact_name: f.contact_name || null,
    email: f.email || null,
    phone: f.phone || null,
    website: f.website || null,
    address: f.address || null,
    postal_code: f.postal_code || null,
    city: f.city || null,
    region: f.region || null,
    country: f.country || "ES",
    notes: f.notes || null,
  };
}

function ClientFields({ f, setF }: { f: ClientForm; setF: (v: ClientForm) => void }) {
  return (
    <>
      {/* Row 1 — Identity */}
      <Field label="Nombre / Razón social *">
        <input className={inputClass} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </Field>
      <Field label="NIF / CIF">
        <input className={inputClass} placeholder="B12345678" value={f.nif_cif} onChange={(e) => setF({ ...f, nif_cif: e.target.value })} />
      </Field>
      <Field label="Persona de contacto">
        <input className={inputClass} placeholder="Juan García" value={f.contact_name} onChange={(e) => setF({ ...f, contact_name: e.target.value })} />
      </Field>

      {/* Row 2 — Contact */}
      <Field label="Email">
        <input className={inputClass} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      </Field>
      <Field label="Teléfono">
        <input className={inputClass} placeholder="+34 600 000 000" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      </Field>
      <Field label="Sitio web">
        <input className={inputClass} placeholder="www.empresa.com" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
      </Field>

      {/* Row 3 — Address */}
      <div className="col-span-3">
        <Field label="Dirección">
          <input className={inputClass} placeholder="Calle Mayor 1, Nave 3" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        </Field>
      </div>
      <Field label="Código postal">
        <input className={inputClass} placeholder="28001" value={f.postal_code} onChange={(e) => setF({ ...f, postal_code: e.target.value })} />
      </Field>
      <Field label="Ciudad">
        <input className={inputClass} placeholder="Madrid" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
      </Field>
      <Field label="Provincia / Región">
        <input className={inputClass} placeholder="Madrid" value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} />
      </Field>
      <Field label="País">
        <select className={inputClass} value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })}>
          {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
        </select>
      </Field>

      {/* Notes */}
      <div className="col-span-3">
        <Field label="Notas internas">
          <input className={inputClass} placeholder="Horario de carga, instrucciones especiales…" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
    </>
  );
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError]     = useState<string | null>(null);
  const [search, setSearch]   = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId]   = useState<number | null>(null);
  const [f, setF]             = useState<ClientForm>(emptyForm);
  const [editF, setEditF]     = useState<ClientForm>(emptyForm);

  async function load() {
    try { setClients(await api.listClients()); }
    catch (e) { setError(String(e)); }
  }

  useEffect(() => { load(); }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return;
    try {
      await api.createClient(toApi(f));
      setF(emptyForm);
      setShowAdd(false);
      load();
    } catch (e) { setError(String(e)); }
  }

  async function saveEdit(e: FormEvent, id: number) {
    e.preventDefault();
    try {
      await api.updateClient(id, toApi(editF));
      setEditId(null);
      load();
    } catch (e) { setError(String(e)); }
  }

  const filtered = clients.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return `${c.name} ${c.nif_cif ?? ""} ${c.contact_name ?? ""} ${c.email ?? ""} ${c.phone ?? ""} ${c.city ?? ""} ${c.postal_code ?? ""}`.toLowerCase().includes(q);
  });

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle="Empresas que envían pedidos de transporte."
        actions={<Button onClick={() => setShowAdd((v) => !v)}>{showAdd ? "Ocultar formulario" : "+ Nuevo cliente"}</Button>}
      />
      {error && <ErrorBox message={error} />}

      {/* Add form */}
      {showAdd && (
        <Card className="mb-6">
          <p className="mb-4 text-sm font-semibold text-slate-300">Nuevo cliente</p>
          <form onSubmit={add} className="grid grid-cols-3 gap-4">
            <ClientFields f={f} setF={setF} />
            <div className="col-span-3 flex gap-2">
              <Button type="submit">Guardar cliente</Button>
              <Button variant="ghost" type="button" onClick={() => { setF(emptyForm); setShowAdd(false); }}>Cancelar</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Search */}
      <div className="mb-4 flex items-center gap-3">
        <input
          className={`${inputClass} max-w-sm`}
          placeholder="Buscar por nombre, NIF/CIF, ciudad, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch("")} className="text-xs text-slate-400 hover:text-white">✕ Limpiar</button>
        )}
        <span className="ml-auto text-xs text-slate-500">{filtered.length} / {clients.length} clientes</span>
      </div>

      <div className="space-y-2">
        {filtered.map((c) => (
          <Card key={c.id}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-white">{c.name}</span>
                  {c.nif_cif && <span className="rounded bg-ink-600 px-2 py-0.5 text-xs text-slate-300">{c.nif_cif}</span>}
                  {!c.active && <span className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-400">Inactivo</span>}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {c.contact_name && <span>{c.contact_name} · </span>}
                  {c.phone && <span>{c.phone} · </span>}
                  {c.email && <span>{c.email}</span>}
                </div>
                <div className="mt-0.5 text-xs text-slate-600">
                  {[c.address, c.postal_code, c.city, c.region, c.country].filter(Boolean).join(", ")}
                  {c.website && <span> · <a href={`https://${c.website.replace(/^https?:\/\//, "")}`} target="_blank" rel="noreferrer" className="text-brand-400 hover:underline">{c.website}</a></span>}
                </div>
                {c.notes && <div className="mt-0.5 text-xs text-slate-600 italic">{c.notes}</div>}
              </div>
              <div className="ml-4 flex gap-2 shrink-0">
                <Button onClick={() => { if (editId === c.id) { setEditId(null); } else { setEditId(c.id); setEditF(fromClient(c)); } }}>
                  {editId === c.id ? "Cerrar ▲" : "Editar ▼"}
                </Button>
                <Button variant="danger" onClick={async () => { await api.deleteClient(c.id); load(); }}>
                  Eliminar
                </Button>
              </div>
            </div>

            {editId === c.id && (
              <div className="mt-3 border-t border-slate-700 pt-3">
                <form onSubmit={(e) => saveEdit(e, c.id)} className="grid grid-cols-3 gap-4">
                  <ClientFields f={editF} setF={setEditF} />
                  <div className="col-span-3 flex gap-2">
                    <Button type="submit">Guardar</Button>
                    <Button variant="danger" type="button" onClick={() => setEditId(null)}>Cancelar</Button>
                  </div>
                </form>
              </div>
            )}
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="py-8 text-center text-sm text-slate-500">
            {search ? "Sin resultados." : "No hay clientes todavía. Usa el botón de arriba para añadir."}
          </div>
        )}
      </div>
    </div>
  );
}
