#!/bin/sh
# Rebuilds sql/init.sql from supabase/migrations/, in numeric order.
set -e
cd "$(dirname "$0")/.."
{
  head -n 4 sql/init.sql
  for f in supabase/migrations/*.sql; do
    printf '\n-- ===== %s =====\n\n' "$(basename "$f")"
    cat "$f"
  done
} > sql/init.sql.tmp
mv sql/init.sql.tmp sql/init.sql
