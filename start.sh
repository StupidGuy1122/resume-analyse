#!/usr/bin/env bash
# resume-analyse start script for Git Bash on Windows.
# Usage:
#     ./start.sh
# Stops everything cleanly when you hit Ctrl+C.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
PYTHON="$BACKEND_DIR/.venv/Scripts/python.exe"
LOG_DIR="$SCRIPT_DIR/.logs"
mkdir -p "$LOG_DIR"

cyan()   { printf "\033[36m%s\033[0m\n" "$1"; }
green()  { printf "\033[32m%s\033[0m\n" "$1"; }
yellow() { printf "\033[33m%s\033[0m\n" "$1"; }
red()    { printf "\033[31m%s\033[0m\n" "$1"; }

# ---------- helpers ----------

# Find the PID(s) listening on a TCP port. Works in Git Bash via netstat.
pids_on_port() {
    local port="$1"
    netstat -ano | grep -E "LISTENING" | grep -E ":${port}\s" | awk '{print $NF}' | sort -u
}

kill_port() {
    local port="$1"
    local label="$2"
    local pids
    pids=$(pids_on_port "$port" || true)
    if [ -z "$pids" ]; then
        green  "  [OK]   port $port ($label) is free"
        return
    fi
    for pid in $pids; do
        yellow "  [KILL] port $port ($label) -> PID $pid"
        # //F = force, //T = kill child tree (the // is Git Bash's way of escaping cmd flags)
        taskkill //F //T //PID "$pid" >/dev/null 2>&1 || true
    done
    sleep 1
}

wait_for() {
    local url="$1"
    local label="$2"
    local max="${3:-30}"
    for i in $(seq 1 "$max"); do
        if curl -s --max-time 2 "$url" >/dev/null 2>&1; then
            return 0
        fi
        sleep 1
    done
    return 1
}

# Cleanup on exit (Ctrl+C or normal): kill the backend we spawned.
BACKEND_PID=""
cleanup() {
    echo
    cyan "shutting down..."
    if [ -n "$BACKEND_PID" ]; then
        # backend was launched via 'start' so we may not have its real PID;
        # just clean by port to be safe.
        kill_port 8000 "backend"
    fi
    # frontend runs in the foreground so it dies with us, but make sure
    kill_port 3000 "frontend"
    green "done."
    exit 0
}
trap cleanup INT TERM EXIT

# ---------- preflight ----------

echo
cyan "================================"
cyan "  resume-analyse start"
cyan "================================"
echo

if [ ! -f "$PYTHON" ]; then
    red   "  [ERROR] backend venv not found: $PYTHON"
    yellow "          run README step 4 to install backend deps first"
    trap - EXIT; exit 1
fi
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    red   "  [ERROR] frontend/node_modules missing — run 'pnpm install' in frontend/ first"
    trap - EXIT; exit 1
fi

# ---------- step 1: clean ports ----------

cyan "[1/4] cleaning ports"
kill_port 8000 "backend"
kill_port 3000 "frontend"
echo

# ---------- step 2: check Ollama ----------

cyan "[2/4] checking Ollama"
if curl -s --max-time 3 http://localhost:11434/api/tags >/dev/null 2>&1; then
    green "  [OK]   Ollama is running on localhost:11434"
else
    yellow "  [WARN] Ollama unreachable at localhost:11434"
    yellow "         check the system tray, or run 'ollama serve' in another terminal"
    read -r -p "  continue anyway? (y/N) " ans
    if [ "$ans" != "y" ] && [ "$ans" != "Y" ]; then
        trap - EXIT; exit 1
    fi
fi
echo

# ---------- step 3: start backend in the background ----------

cyan "[3/4] starting backend (FastAPI on port 8000)"
BACKEND_LOG="$LOG_DIR/backend.log"
: > "$BACKEND_LOG"
(
    cd "$BACKEND_DIR"
    "$PYTHON" -m uvicorn app.main:app --reload --port 8000
) >"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
echo "  backend PID: $BACKEND_PID"
echo "  log file   : $BACKEND_LOG"
echo "  waiting for /health (up to 30 s)..."

if wait_for "http://127.0.0.1:8000/health" "backend" 30; then
    green "  [OK]   backend ready"
else
    red    "  [ERROR] backend did not come up in 30 s"
    yellow "          last 20 lines of $BACKEND_LOG:"
    tail -n 20 "$BACKEND_LOG" | sed 's/^/    /'
    trap - EXIT; exit 1
fi
echo

# ---------- step 4: start frontend in the foreground ----------

cyan "[4/4] starting frontend (Next.js on port 3000)"
green "  frontend will run in this terminal — its logs print here"
green "  press Ctrl+C to stop EVERYTHING (backend included)"
echo
sleep 1

# Open the browser shortly after Next is up.
(
    sleep 6
    if curl -s --max-time 2 http://localhost:3000 >/dev/null 2>&1; then
        start "" "http://localhost:3000" 2>/dev/null || true
    fi
) &

cd "$FRONTEND_DIR"
# Explicit -p 3000: if the port is taken, Next will fail loudly instead of drifting to 3001.
pnpm exec next dev -p 3000

# When pnpm exits (Ctrl+C, crash, or normal), the EXIT trap above runs cleanup.
