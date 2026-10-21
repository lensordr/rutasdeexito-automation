import { FormEvent, useEffect, useState } from "react";
import { api, type Client } from "../api";
import { Button, Card, ErrorBox, Field, PageHeader, inputClass } from "../ui";

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({ name: "", email: "", phone: "", notes: "" });

  async function load() {
    try {
      setClients(await api.listClients());
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return;
    try {
      await api.createClient({
        name: f.name,
        email: f.email || null,
        phone: f.phone || null,
        notes: f.notes || null,
      });
      setF({ name: "", email: "", phone: "", notes: "" });
      load();
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div>
      <PageHeader title="Clients" subtitle="Companies that send transport orders." />
      {error && <ErrorBox message={error} />}

      <Card className="mb-6">
        <form onSubmit={add} className="grid grid-cols-4 gap-4">
          <Field label="Name"><input className={inputClass} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Email"><input className={inputClass} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Phone"><input className={inputClass} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Notes"><input className={inputClass} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
          <div className="col-span-4"><Button type="submit">Add client</Button></div>
        </form>
      </Card>

      <div className="space-y-2">
        {clients.map((c) => (
          <Card key={c.id}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-white">{c.name}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {c.email || "no email"}{c.phone ? ` · ${c.phone}` : ""}
                </div>
              </div>
              <Button variant="danger" onClick={async () => { await api.deleteClient(c.id); load(); }}>Delete</Button>
            </div>
          </Card>
        ))}
        {clients.length === 0 && (
          <div className="py-8 text-center text-sm text-slate-500">No clients yet.</div>
        )}
      </div>
    </div>
  );
}
