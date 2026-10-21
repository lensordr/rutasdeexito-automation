# Setup Guide — Rutas de Éxito — Dispatch (Windows)

## Prerequisites

1. **Git** — https://git-scm.com/download/win
2. **Python 3.11+** — https://www.python.org/downloads/ (check "Add to PATH")
3. **Node.js 18+ (LTS)** — https://nodejs.org/

Verify in a new terminal:
```bat
git --version
python --version
node --version
```

## 1. Get the project

If cloning from GitHub:
```bat
cd %USERPROFILE%\Desktop
git clone <your-repo-url> RutasDeExito-Dispatch
cd RutasDeExito-Dispatch
```

## 2. One-click run

```bat
run_dispatch.bat
```

First run creates the Python venv, installs backend + frontend dependencies,
and opens two windows. Then open:

- **App (UI)**: http://localhost:5173
- **API health**: http://127.0.0.1:8010/api/health

The SQLite database is created and seeded automatically on first start
(1 company, sample clients, 3 trailers, 3 trucks, 3 drivers).

## 3. Manual run

Backend:
```bat
cd backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8010
```

Frontend (second terminal):
```bat
cd frontend
npm install
npm run dev
```

## 4. Connect Email / GPS / TMS (per machine)

In the app → **Connectors & Settings**, expand a connector, fill fields, **Save**,
then **Test connection**. Values are stored locally in
`backend\data\connector_config.json` (gitignored), so you re-enter them on each
machine.

## 5. Reset the local data

To start from a clean database, stop the servers and delete:
```
backend\data\dispatch.db
```
It will be recreated and reseeded on the next start.

## Troubleshooting

- **`python` / `npm` not found** → reinstall with PATH enabled, open a new terminal.
- **Port in use** → change backend `--port` (and `frontend/vite.config.ts` proxy
  target) or frontend `server.port`.
- **PowerShell `&&` error** → use `;` or run commands separately.
