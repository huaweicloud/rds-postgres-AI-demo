#!/bin/sh
# Applies every migration to a throwaway Postgres + pgvector container and runs flow.sql.
# pg_cron isn't in the image, so 0009 is skipped; recover_runs() is called directly instead.
set -eu

cd "$(dirname "$0")/.."
name=stackdowser-migration-test
docker rm -f "$name" >/dev/null 2>&1 || true
docker run -d --name "$name" -e POSTGRES_PASSWORD=test -v "$PWD:/supabase:ro" \
  pgvector/pgvector:pg17 -c wal_level=logical >/dev/null
trap 'docker rm -f "$name" >/dev/null' EXIT

until docker exec "$name" pg_isready -U postgres -q; do sleep 1; done
sleep 1

psql() { docker exec -i "$name" psql -q -v ON_ERROR_STOP=1 -U postgres "$@"; }

psql -f /supabase/tests/supabase_stub.sql
for f in migrations/*.sql; do
  case "$f" in *_cron.sql) continue ;; esac
  psql -f "/supabase/$f"
done
psql -f /supabase/tests/flow.sql
