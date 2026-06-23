#!/usr/bin/env bash
set -euo pipefail

MYSQL_BIN="${MYSQL_BIN:-mysql}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3307}"
DB_USERNAME="${DB_USERNAME:-root}"
DB_PASSWORD="${DB_PASSWORD:-}"

ARGS=(-h"${DB_HOST}" -P"${DB_PORT}" -u"${DB_USERNAME}")
if [[ -n "${DB_PASSWORD}" ]]; then
  ARGS+=(-p"${DB_PASSWORD}")
fi

"${MYSQL_BIN}" "${ARGS[@]}" < src/main/resources/db/init.sql
echo "Database cpt208_discussion is ready on ${DB_HOST}:${DB_PORT}."
