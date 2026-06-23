#!/usr/bin/env bash
set -euo pipefail

MYSQLADMIN="${MYSQLADMIN:-mysqladmin}"
DB_USERNAME="${DB_USERNAME:-root}"
DB_PASSWORD="${DB_PASSWORD:-}"

ARGS=(-h127.0.0.1 -P3307 -u"${DB_USERNAME}")
if [[ -n "${DB_PASSWORD}" ]]; then
  ARGS+=(-p"${DB_PASSWORD}")
fi

"${MYSQLADMIN}" "${ARGS[@]}" shutdown
