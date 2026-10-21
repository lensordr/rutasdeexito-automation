import { useEffect, useState } from "react";
import { api, type ConnectorDetail, type ConnectorStatus, type TestResult } from "../api";
import { Button, Card, ErrorBox, Field, PageHeader, inputClass } from "../ui";

function Badge({ s }: { s: { configured: boolean; connected: boolean } }) {
  const label = s.connected ? "connected" : s.configured ? "configured" : "not set";
  const cls = s.connected
    ? "bg-emerald-900/40 text-emerald-300 ring-1 ring-emerald-700/50"
    : s.configured
      ? "bg-brand-900/40 text-brand-200 ring-1 ring-brand-700/60"
      : "bg-ink-700 text-slate-400 ring-1 ring-ink-500";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${cls}`}>{label}</span>;
}

function ConnectorCard({ summary, onChanged }: { summary: ConnectorStatus; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<ConnectorDetail | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [test, setTest] = useState<TestResult | null>(null);

  async function load() {
    const d = await api.getConnector(summary.key);
    setDetail(d);
    const initial: Record<string, string> = {};
    for (const f of d.schema.fields) initial[f.key] = d.values[f.key]?.display ?? "";
    setForm(initial);
  }

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !detail) await load();
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    setTest(null);
    try {
      await api.saveConnector(summary.key, form);
      setMsg("Saved on this machine.");
      await load();
      onChanged();
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function runTest() {
    setBusy(true);
    setTest(null);
    try {
      setTest(await api.testConnector(summary.key));
    } catch (e) {
      setTest({ ok: false, message: String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <button onClick={toggle} className="flex w-full items-start justify-between text-left">
        <div>
          <div className="font-semibold text-white">{summary.label}</div>
          <div className="mt-1 text-sm text-slate-500">{summary.detail}</div>
        </div>
        <div className="flex items-center gap-3">
          <Badge s={summary} />
          <span className="text-slate-500">{open ? "▴" : "▾"}</span>
        </div>
      </button>

      {open && detail && (
        <div className="mt-4 border-t border-ink-600 pt-4">
          <div className="space-y-4">
            {detail.schema.fields.map((f) => (
              <Field key={f.key} label={`${f.label}${f.required ? "" : " (optional)"}`}>
                <input
                  className={inputClass}
                  type={f.secret ? "password" : "text"}
                  placeholder={f.placeholder}
                  value={form[f.key] ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                />
                {f.help && <span className="mt-1 block text-xs text-slate-500">{f.help}</span>}
              </Field>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
            <Button variant="ghost" onClick={runTest} disabled={busy}>Test connection</Button>
            {msg && <span className="text-xs text-slate-400">{msg}</span>}
          </div>
          {test && (
            <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${test.ok ? "bg-emerald-900/30 text-emerald-300 ring-1 ring-emerald-700/50" : "bg-brand-900/30 text-brand-200 ring-1 ring-brand-700/60"}`}>
              {test.message}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    api.listConnectors().then(setConnectors).catch((e) => setError(String(e)));
  }

  useEffect(refresh, []);

  return (
    <div>
      <PageHeader
        title="Connectors & Settings"
        subtitle="Add your Email, GPS and TMS credentials. Stored only on this machine — never committed to GitHub."
      />
      {error && <ErrorBox message={error} />}

      <div className="mb-5 rounded-lg border border-ink-600 bg-ink-800/60 px-4 py-3 text-xs text-slate-400">
        Secrets are saved to <code className="text-slate-300">backend/data/connector_config.json</code> (gitignored).
        On another computer, clone the repo and re-enter your keys here.
      </div>

      <div className="grid grid-cols-1 gap-4">
        {connectors.map((c) => (
          <ConnectorCard key={c.key} summary={c} onChanged={refresh} />
        ))}
      </div>
    </div>
  );
}
