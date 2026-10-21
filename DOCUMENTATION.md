# Rutas de Éxito — Dispatch — Documentation

Single source of truth for **what is built**, **what is stubbed**, and **what
remains**. Read this first when continuing development.

---

## 1. Purpose

Automate the transport dispatcher's daily workflow:

> client email → create order → find the right truck+trailer+driver → confirm →
> track status (assigned / delivered / cancelled).

The dispatcher stays **in the loop**: the system *suggests*, a human *confirms*.

---

## 2. Current status

| Area | Status |
|------|--------|
| Local web app (FastAPI + React) | ✅ Working |
| SQLite DB + auto-seed | ✅ Working |
| Orders: manual create + email intake | ✅ Working (email stubbed) |
| Assignment engine (capability+capacity+proximity+availability) | ✅ Working |
| Suggestions → confirm → status lifecycle | ✅ Working |
| Fleet CRUD (trucks/trailers/drivers) | ✅ Working |
| Clients CRUD | ✅ Working |
| Connectors & Settings (Email/GPS/TMS) | ✅ Working (save+test, gitignored) |
| Lighter red/charcoal theme + logo watermark | ✅ Working |
| Real Email / GPS / TMS integrations | ❌ Not yet (stubs) |

Verified end-to-end over HTTP: create grain order → 1 valid suggestion
(tipper carries grain; tanker correctly excluded) → confirm → order *assigned*
→ *delivered*; email intake creates 3 orders; GPS returns 5 positions.

---

## 3. Architecture

```
Frontend (React/Vite/TS/Tailwind)
    │  REST /api/*  (Vite proxy → :8010)
Backend (FastAPI)
    ├── routers/      orders, master_data, gps, connectors
    ├── assignment_engine.py   (scoring brain)
    ├── connectors/   base interfaces + stubs + registry (Email/GPS/TMS)
    ├── connector_config.py    (gitignored secret storage + masking)
    ├── models.py     SQLAlchemy ORM
    ├── schemas.py    Pydantic request/response
    ├── db.py         engine/session (SQLite now, Postgres later)
    └── seed.py       default company + sample fleet
```

### Multi-tenant by design
Every business table has a `company_id`. The local build uses a single seeded
company (`default_company_id = 1`). To host multiple companies later: add auth,
scope queries by the logged-in user's company, and point
`DISPATCH_DATABASE_URL` at Postgres. No model redesign needed.

### Connector pattern
`Email`, `GPS`, `TMS` are abstract interfaces in
`backend/app/connectors/base.py`. Stubs implement them today; the registry
(`registry.py`) resolves each key to an implementation and injects the saved
config. Swap a stub for a real class → nothing else changes.

---

## 4. Data model (SQLAlchemy)

- **Company** — tenant.
- **Client** — sender of orders (name, email, phone).
- **Trailer** — `identifier`, `trailer_type`, `allowed_products` (comma-sep),
  `max_tonnage`, `max_volume_m3`. Defines **capability + capacity**.
- **Truck** — `plate`, `status` (available/on_trip/maintenance/offline),
  `default_trailer_id`, `home_lat/lng`, `gps_device_id`.
- **Driver** — `name`, `status` (available/driving/off_duty), `truck_id`.
- **Order** — `product`, `tonnage`, `volume_m3`, pickup/dropoff (+ coords),
  `status` (new/suggested/assigned/delivered/cancelled), `source` (manual/email).
- **Assignment** — links Order→Truck(+Trailer+Driver), `status`, `score`,
  `distance_km`, `reason`.
- **GpsPing** — truck positions (for history; live positions currently come
  straight from the GPS connector).

---

## 5. The assignment engine

`backend/app/assignment_engine.py` → `suggest_assignments(db, order, company_id)`.

**Hard gates (eliminate a combo):**
1. **Capability** — trailer's `allowed_products` must include the order product.
2. **Capacity** — order tonnage ≤ trailer max tonnage; volume ≤ max volume.

**Soft score (ranks survivors), 0..1:**
- **Proximity** (weight 0.6): haversine distance from the truck's current GPS
  position (fallback: home base) to the order pickup. Closer = higher.
- **Availability** (weight 0.4): truck available? driver available?

Weights and `MAX_USEFUL_DISTANCE_KM` are constants at the top of the file —
easy to tune. A truck with a `default_trailer_id` only considers that trailer;
otherwise all active trailers are considered and the best-fitting is chosen.

---

## 6. API surface (selected)

```
GET    /api/health
# Master data
GET/POST/DELETE  /api/clients            /api/clients/{id}
GET/POST/DELETE  /api/trailers           /api/trailers/{id}
GET/POST/DELETE  /api/trucks             /api/trucks/{id}
GET/POST/DELETE  /api/drivers            /api/drivers/{id}
# Orders
GET/POST         /api/orders
GET/PATCH        /api/orders/{id}
POST             /api/orders/intake-email
GET              /api/orders/{id}/suggestions
POST             /api/orders/{id}/confirm           {truck_id,trailer_id,driver_id}
POST             /api/orders/{id}/status/{status}   delivered|cancelled|...
GET              /api/orders/{id}/assignments
# GPS + connectors
GET              /api/gps/positions
GET              /api/connectors
GET/PUT          /api/connectors/{key}
POST             /api/connectors/{key}/test
```

---

## 7. Roadmap — what remains

### Phase 1 — Real Email intake (highest value)
- Implement `RealEmail(EmailConnector)` for **Outlook (Microsoft Graph)**,
  **Gmail API**, and generic **IMAP** (provider chosen in config).
- Parse order details from the email body. Start with rules/regex; add an LLM
  parser for free-form emails.
- Map sender → Client automatically.
- File: `backend/app/connectors/real/email_*.py`, register in `registry.py`.

### Phase 2 — Real GPS
- Implement `RealGps(GpsConnector)` against your provider's API (base URL +
  API key already captured in the UI). Return live lat/lng per `gps_device_id`.
- Optionally persist `GpsPing` rows for history and store last-known position.

### Phase 3 — Real TMS push
- Implement `RealTms(TmsConnector).push_assignment(...)` to POST confirmed
  assignments into your platform's API; store the returned external ref on the
  Assignment.

### Phase 4 — Engine & UX improvements
- Driver hours / rest rules, cost, client preferences, backhaul optimization.
- Map view of trucks + pickup (Leaflet).
- Order detail: show live truck distance, manual override of trailer/driver.
- Real "Test connection" pings per connector.
- Audit log of status changes.

### Phase 5 — Multi-company (hosted)
- AuthN/AuthZ, company scoping middleware, invite/onboard flow.
- Move SQLite → Postgres (`DISPATCH_DATABASE_URL`).
- Migrations (Alembic) instead of `create_all`.
- Per-company connector config (currently single-machine file).

### Phase 6 — Productization
- Normalize `allowed_products` into a join table.
- Tests (pytest + API tests; frontend component tests).
- Packaging/installer; background scheduler to poll email/GPS automatically.

---

## 8. Known limitations (today)

- Email/GPS/TMS are stubs returning sample data.
- "Test connection" confirms config saved, not that credentials work.
- Single company, single machine, SQLite, no auth.
- Live GPS positions are not yet persisted as history.
- `allowed_products` is a comma-separated string (fine for now).

---

## 9. Where data is stored

| Data | Location | Committed? |
|------|----------|-----------|
| Database (orders, fleet, etc.) | `backend/data/dispatch.db` | ❌ gitignored |
| Connector credentials | `backend/data/connector_config.json` | ❌ gitignored |
| Env overrides | `backend/.env` | ❌ gitignored |
| Env template | `.env.example` | ✅ committed |
