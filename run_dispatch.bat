@echo off
REM Rutas de Exito - Dispatch local launcher (Windows)
setlocal
set ROOT=%~dp0

echo ================================================
echo   Rutas de Exito - Dispatch : backend + frontend
echo ================================================

if not exist "%ROOT%backend\.venv" (
  echo [backend] Creating virtual environment...
  python -m venv "%ROOT%backend\.venv"
  "%ROOT%backend\.venv\Scripts\python.exe" -m pip install --upgrade pip
  "%ROOT%backend\.venv\Scripts\python.exe" -m pip install -r "%ROOT%backend\requirements.txt"
)

start "Dispatch Backend" cmd /k "cd /d %ROOT%backend && .venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8010"

if not exist "%ROOT%frontend\node_modules" (
  echo [frontend] Installing npm packages...
  pushd "%ROOT%frontend"
  call npm install
  popd
)

start "Dispatch Frontend" cmd /k "cd /d %ROOT%frontend && npm run dev"

echo.
echo Backend : http://127.0.0.1:8010/api/health
echo Frontend: http://localhost:5173
echo.
echo Two terminal windows opened. Close them to stop the servers.
endlocal
