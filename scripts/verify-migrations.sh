#!/usr/bin/env bash
# Apply the migrations to a throwaway local database, twice, then check RLS.
set -euo pipefail
cd "$(dirname "$0")/.."

sudo pg_ctlcluster 16 main start || true
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "drop database if exists mpt_test;"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "create database mpt_test;"
sudo -u postgres psql -d mpt_test -v ON_ERROR_STOP=1 -f scripts/auth-stub.sql

apply() {
  for file in supabase/migrations/*.sql; do
    echo "Applying $file"
    sudo -u postgres psql -d mpt_test -v ON_ERROR_STOP=1 -f "$file"
  done
}

apply
apply
sudo -u postgres psql -d mpt_test -v ON_ERROR_STOP=1 -f scripts/rls-checks.sql
echo "Migrations and RLS checks passed."
