#!/bin/bash
# Daily PostgreSQL backup for the Centreal VPS (deploy/README.md §9).
# Installed as /usr/local/sbin/centreal-db-backup.sh; cron:
# deploy/centreal-db-backup.cron (00:30 UTC = 03:30 Europe/Moscow).
#
#   1. pg_dump -Fc of $POSTGRES_DB from the db container →
#      /root/backups/real_estate_db-YYYY-MM-DD.dump (dir 700, files 600);
#   2. verify: pg_restore --list must exit 0 and list entries;
#   3. rotate: keep the newest 14 daily dumps + the newest 8 Sunday dumps,
#      deleting ONLY files whose name matches that exact pattern;
#   4. log to /var/log/centreal-db-backup.log; on ANY failure send a short
#      alert to the Telegram group from deploy/.env.prod (never printed).
#
# It only READS the database. It never drops, restores or writes anything in
# the db container.
set -uo pipefail

REPO=/opt/centreal
ENV_FILE="$REPO/deploy/.env.prod"
DIR=/root/backups
LOG=/var/log/centreal-db-backup.log
KEEP_DAILY=14
KEEP_SUNDAY=8
DC=(docker compose -f "$REPO/docker-compose.prod.yml" --env-file "$ENV_FILE")

umask 077
mkdir -p "$DIR"
chmod 700 "$DIR"

log() { echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') $*" >>"$LOG"; }

env_value() { grep -m1 "^$1=" "$ENV_FILE" | cut -d= -f2- | tr -d '\r'; }

alert() {
  # Short Telegram message. The token goes to curl through a config on stdin,
  # so it is never on a command line (ps) or in a log.
  local token chat
  token=$(env_value TELEGRAM_BOT_TOKEN)
  chat=$(env_value TELEGRAM_CHAT_ID)
  if [ -z "$token" ] || [ -z "$chat" ]; then
    log "ALERT not sent: Telegram is not configured"
    return
  fi
  printf 'url = "https://api.telegram.org/bot%s/sendMessage"\n' "$token" |
    curl -s -o /dev/null -w '%{http_code}' -K - \
      --data-urlencode "chat_id=$chat" \
      --data-urlencode "text=⚠ ЦЕНТРЕАЛЪ: резервная копия базы не создана ($(hostname), $(date -u '+%Y-%m-%d %H:%M UTC')): $1" \
      >/tmp/.centreal-alert-code 2>/dev/null
  log "ALERT sent to Telegram: HTTP $(cat /tmp/.centreal-alert-code 2>/dev/null)"
  rm -f /tmp/.centreal-alert-code
}

fail() {
  log "FAIL $1"
  alert "$1"
  exit 1
}

# One run at a time.
exec 9>/run/centreal-db-backup.lock
flock -n 9 || { log "SKIP another backup is still running"; exit 0; }

DB=$(env_value POSTGRES_DB)
DBUSER=$(env_value POSTGRES_USER)
[ -n "$DB" ] && [ -n "$DBUSER" ] || fail "POSTGRES_DB/POSTGRES_USER missing in deploy/.env.prod"

STAMP=$(TZ=Europe/Moscow date '+%Y-%m-%d')
FINAL="$DIR/real_estate_db-$STAMP.dump"
TMP="$DIR/.real_estate_db-$STAMP.dump.partial"

# 1. Dump. pipefail makes a pg_dump error fail the pipeline.
if ! "${DC[@]}" exec -T db pg_dump -U "$DBUSER" -Fc "$DB" </dev/null >"$TMP" 2>>"$LOG"; then
  rm -f "$TMP"
  fail "pg_dump exited with an error"
fi
chmod 600 "$TMP"
SIZE=$(stat -c %s "$TMP")
[ "$SIZE" -gt 0 ] || { rm -f "$TMP"; fail "pg_dump produced an empty file"; }

# 2. Verify the archive is readable and lists objects. (The listing goes to a
#    file so pg_restore's own exit code is checked, not a pipeline's.)
LIST="$DIR/.restore-list.txt"
"${DC[@]}" exec -T db pg_restore --list <"$TMP" >"$LIST" 2>>"$LOG"
RC=$?
ENTRIES=$(grep -cv '^;' "$LIST" 2>/dev/null || true)
rm -f "$LIST"
if [ "$RC" -ne 0 ] || [ "${ENTRIES:-0}" -le 0 ]; then
  rm -f "$TMP"
  fail "pg_restore --list failed (exit $RC, ${ENTRIES:-0} entries)"
fi
mv -f "$TMP" "$FINAL"
log "OK $FINAL $SIZE bytes, $ENTRIES TOC entries"

# 3. Rotate: only files named exactly real_estate_db-YYYY-MM-DD.dump.
mapfile -t ALL < <(find "$DIR" -maxdepth 1 -type f -regextype posix-extended \
  -regex '.*/real_estate_db-[0-9]{4}-[0-9]{2}-[0-9]{2}\.dump' -printf '%f\n' | sort -r)
declare -A KEEP=()
for f in "${ALL[@]:0:$KEEP_DAILY}"; do KEEP["$f"]=1; done
sundays=0
for f in "${ALL[@]}"; do
  d=${f#real_estate_db-}; d=${d%.dump}
  if [ "$(date -d "$d" +%u 2>/dev/null)" = "7" ] && [ "$sundays" -lt "$KEEP_SUNDAY" ]; then
    KEEP["$f"]=1
    sundays=$((sundays + 1))
  fi
done
for f in "${ALL[@]}"; do
  if [ -z "${KEEP[$f]:-}" ]; then
    rm -f -- "$DIR/$f" && log "ROTATE removed $f"
  fi
done
log "KEPT ${#KEEP[@]} of ${#ALL[@]} dumps"

# Keep the log small.
tail -n 1000 "$LOG" >"$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG"
exit 0
