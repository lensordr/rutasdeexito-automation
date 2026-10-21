# Rutas de Éxito — Dispatch

A local web app that automates **transport traffic control**: it ingests client
order emails, creates orders, and suggests the best **truck + trailer + driver**
for each one based on **what the trailer can carry, capacity, GPS proximity and
availability** — with a human-in-the-loop confirm step before anything is
committed.

> **Status: working skeleton.** The full workflow runs end to end on seeded
> sample data. The three external systems — **Email**, **GPS**, **TMS platform**
> — are **stubbed** behind connector interfaces and are wired up later from the
> **Connectors & Settings** page. No secrets are ever committed to GitHub.

## Documentation

- **[SETUP.md](SETUP.md)** — install and run on a fresh Windows machine.
- **[DOCUMENTATION.md](DOCUMENTATION.md)** — architecture, data model, the
  assignment engine, current state, and the roadmap of what's left to build.

## Quick start (Windows)

```bat
run_dispatch.bat
```

Then open **http://localhost:5173** (backend runs on `127.0.0.1:8010`).

## The workflow

1. **Orders** — pull parsed orders from email (stub) or add manually.
2. Open an order → **Get assignment suggestions** (ranked by the engine).
3. **Confirm** a suggestion → order becomes *assigned*, truck/driver flip to busy,
   and the confirmed assignment is pushed to your TMS (stub).
4. Mark **delivered** or **cancelled** → truck/driver are released.
5. **Fleet** — manage trucks, trailers (what they carry + capacity), drivers.
6. **Clients** — manage who sends orders.

## Stack

- **Backend**: Python + FastAPI + SQLAlchemy, **SQLite** (local).
- **Frontend**: React + Vite + TypeScript + Tailwind.
- **Multi-tenant ready**: every record carries a `company_id` so other companies
  can be onboarded later (SQLite → Postgres is a connection-string change).
- **OS**: Windows-first.

## Security / GitHub safety

Email/GPS/TMS credentials entered in the app are stored **only on your machine**
in `backend/data/connector_config.json` (gitignored), and the local database
lives in `backend/data/` (also gitignored). Clone anywhere and re-enter keys in
the UI.
