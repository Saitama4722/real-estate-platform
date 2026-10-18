#!/bin/bash
# Restore test for the newest backup (deploy/README.md §9). Run by hand:
#   bash /opt/centreal/deploy/db-restore-test.sh [/root/backups/real_estate_db-YYYY-MM-DD.dump]
#
# Restores the dump into a TEMPORARY database, real_estate_db_restoretest,
# inside the same db container, compares row counts of the key tables with
# production, then drops ONLY that temporary database.
#
# ⛔ It never writes to, restores into or drops the production database.
set -euo pipefail

REPO=/opt/centreal
ENV_FILE="$REPO/deploy/.env.prod"
DC=(docker compose -f "$REPO/docker-compose.prod.yml" --env-file "$ENV_FILE")
TEST_DB=real_estate_db_restoretest
TABLES="leads_lead submissions_salerequest users_user properties_property locations_city locations_district articles_article"

env_value() { grep -m1 "^$1=" "$ENV_FILE" | cut -d= -f2- | tr -d '\r'; }
PROD_DB=$(env_value POSTGRES_DB)
DBUSER=$(env_value POSTGRES_USER)

# Guard: the database this script creates and drops is never production.
[ "$TEST_DB" != "$PROD_DB" ] || { echo "refusing: test db name equals production" >&2; exit 2; }

DUMP=${1:-$(ls -1 /root/backups/real_estate_db-*.dump 2>/dev/null | sort | tail -1)}
[ -n "$DUMP" ] && [ -f "$DUMP" ] || { echo "no dump found" >&2; exit 2; }
echo "dump: $DUMP ($(stat -c %s "$DUMP") bytes)"

psql_in() { "${DC[@]}" exec -T db psql -U "$DBUSER" -d "$1" -Atc "$2" </dev/null; }

cleanup() {
  psql_in postgres "DROP DATABASE IF EXISTS $TEST_DB;" >/dev/null && echo "dropped $TEST_DB"
}
trap cleanup EXIT

psql_in postgres "DROP DATABASE IF EXISTS $TEST_DB;" >/dev/null
psql_in postgres "CREATE DATABASE $TEST_DB OWNER $DBUSER ENCODING 'UTF8' TEMPLATE template0;" >/dev/null
"${DC[@]}" exec -T db pg_restore -U "$DBUSER" -d "$TEST_DB" --no-owner --exit-on-error <"$DUMP"
echo "restored into $TEST_DB"

ok=1
printf '%-26s %10s %10s\n' table production restored
for t in $TABLES; do
  a=$(psql_in "$PROD_DB" "SELECT count(*) FROM $t;")
  b=$(psql_in "$TEST_DB" "SELECT count(*) FROM $t;")
  mark=""; [ "$a" = "$b" ] || { mark="  MISMATCH"; ok=0; }
  printf '%-26s %10s %10s%s\n' "$t" "$a" "$b" "$mark"
done
[ "$ok" = 1 ] && echo "RESULT: all counts match" || { echo "RESULT: MISMATCH" >&2; exit 1; }
