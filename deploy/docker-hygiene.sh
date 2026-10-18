#!/bin/sh
# Weekly Docker hygiene for the Centreal VPS (installed by deploy/README.md →
# «Автоматическая очистка диска»; cron: deploy/centreal-docker-hygiene.cron).
#
# Removes ONLY things nothing uses:
#   - dangling images (old build layers no tag points to);
#   - build cache older than 7 days (the last week is kept so rebuilds stay fast).
#
# ⛔ It never touches volumes: no `system prune`, no `volume prune`, no `-a`.
# The database (centreal_pgdata) and media (centreal_media) live in volumes.
set -u
LOG=/var/log/centreal-docker-hygiene.log

{
  echo "=== $(date -u '+%Y-%m-%dT%H:%M:%SZ') ==="
  echo "before: $(df -h / | awk 'NR==2 {print $3 " used, " $4 " free"}')"
  docker image prune -f 2>&1 | tail -1
  docker builder prune -f --filter until=168h 2>&1 | tail -1
  echo "after:  $(df -h / | awk 'NR==2 {print $3 " used, " $4 " free"}')"
} >>"$LOG" 2>&1

# Keep the log small: the last 200 lines are plenty.
tail -n 200 "$LOG" >"$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG"
