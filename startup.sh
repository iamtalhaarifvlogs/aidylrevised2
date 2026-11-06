#!/bin/sh
set -eu
cd /workspace
node scripts/preview.mjs stop || true

start_aether() {
  (
    i=0
    while [ "$i" -lt 45 ]; do
      if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
        curl -sf -o /dev/null --max-time 30 http://127.0.0.1:8080/api/aether || true
        exit 0
      fi
      i=$((i + 1))
      sleep 1
    done
  ) >>/tmp/app-startup.log 2>&1 &
}

if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  start_aether
  exit 0
fi
npm run dev >>/tmp/app-startup.log 2>&1 &
start_aether
