#!/usr/bin/env bash
# Applies migrations to a throwaway Postgres database and runs RLS/RPC assertions.
# Usage: PGHOST=... PGPORT=... PGUSER=postgres ./scripts/test-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${TEST_DB:-producer_os_test}
psql -q -c "drop database if exists $DB" -c "create database $DB"
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/sql/00_stub_supabase.sql
for f in supabase/migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"; done
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/sql/99_grants_for_test.sql
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/sql/rls_test.sql
