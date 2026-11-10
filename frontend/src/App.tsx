import { NavLink, Outlet } from "react-router-dom";

function SideLink({ to, label, end }: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `group block rounded-lg px-3 py-2 text-sm font-medium transition ${
          isActive ? "bg-brand-600 text-white shadow-glow" : "text-slate-400 hover:bg-ink-700 hover:text-white"
        }`
      }
    >
      {({ isActive }) => (
        <span className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-white" : "bg-brand-600/0 group-hover:bg-brand-600"}`} />
          {label}
        </span>
      )}
    </NavLink>
  );
}

export default function App() {
  return (
    <div className="flex h-full">
      <aside className="relative z-10 flex w-64 flex-col border-r border-ink-600 bg-ink-800/95 p-4 backdrop-blur">
        <div className="mb-8 px-1">
          <img src="/logo.png" alt="Rutas de Éxito" className="w-full rounded-lg" />
          <div className="mt-2 text-center text-[11px] uppercase tracking-widest text-slate-500">
            Dispatch
          </div>
        </div>

        <nav className="space-y-1">
          <SideLink to="/" label="Pedidos" end />
          <SideLink to="/intake" label="📱 Entrada WhatsApp" />
          <SideLink to="/fleet" label="Flota" />
          <SideLink to="/clients" label="Clientes / Ubicaciones" />
          <SideLink to="/connectors" label="Conectores" />
        </nav>

        {/* Client form link */}
        <div className="mt-6 rounded-lg border border-dashed border-slate-600 p-3">
          <p className="mb-1 text-xs font-semibold text-slate-400">Enlace para clientes</p>
          <p className="mb-2 text-xs text-slate-500">
            Comparte este enlace por WhatsApp para que los clientes hagan pedidos directamente.
          </p>
          <button
            onClick={() => {
              const url = `${window.location.origin}/pedido?t=rutas2024`;
              navigator.clipboard.writeText(url);
            }}
            className="w-full rounded-lg bg-green-700/40 border border-green-700 px-3 py-2 text-xs font-medium text-green-300 hover:bg-green-700/60 transition"
          >
            📋 Copiar enlace
          </button>
        </div>

        <div className="mt-auto flex items-center gap-2 px-3 pt-6 text-[11px] text-slate-500">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />
          Skeleton build · integrations stubbed
        </div>
      </aside>

      <main className="relative flex-1 overflow-y-auto">
        <div aria-hidden className="pointer-events-none fixed inset-y-0 right-0 left-64 z-0 flex items-center justify-center">
          <img src="/logo.png" alt="" className="w-[65%] max-w-3xl select-none opacity-[0.04] blur-[1px]" />
        </div>
        <div className="relative z-10 mx-auto max-w-6xl px-8 py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
