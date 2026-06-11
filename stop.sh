#!/usr/bin/env bash
# Force-kill anything on ports 8000 / 3000.
# Run when start.sh's Ctrl+C cleanup didn't fully clear things.

kill_port() {
    local port="$1"
    local label="$2"
    local pids
    pids=$(netstat -ano | grep -E "LISTENING" | grep -E ":${port}\s" | awk '{print $NF}' | sort -u)
    if [ -z "$pids" ]; then
        printf "  port %s (%s) already free\n" "$port" "$label"
        return
    fi
    for pid in $pids; do
        printf "  KILL port %s (%s) -> PID %s\n" "$port" "$label" "$pid"
        taskkill //F //T //PID "$pid" >/dev/null 2>&1 || true
    done
}

echo
printf "\033[36mstopping resume-analyse\033[0m\n"
kill_port 8000 "backend"
kill_port 3000 "frontend"
printf "\033[32mdone.\033[0m\n"
echo
