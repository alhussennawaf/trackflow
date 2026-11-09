#!/usr/bin/env bash
# Runs the backend migrations and rule tests on a throwaway local PostgreSQL database.
# Needs PostgreSQL 15 or newer and a superuser connection (default: the local "postgres" user).
#   supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${TEST_DB:-jak_backend_test}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 ${PGHOST:+-h "$PGHOST"} -U "${PGUSER:-postgres}")

"${PSQL[@]}" -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
"${PSQL[@]}" -d "$DB" -f tests/supabase_stub.sql >/dev/null
for f in migrations/*.sql; do
  echo "migration: $(basename "$f")"
  "${PSQL[@]}" -d "$DB" -f "$f" >/dev/null
done
"${PSQL[@]}" -d "$DB" -f tests/rules_test.sql 2>&1 | sed -e 's/^psql:[^ ]* NOTICE:  //' -e 's/^NOTICE:  //'
