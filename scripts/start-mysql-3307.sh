#!/usr/bin/env bash
set -euo pipefail

MYSQLD_SAFE="${MYSQLD_SAFE:-/opt/homebrew/opt/mysql/bin/mysqld_safe}"
DATADIR="${MYSQL_DATADIR:-/opt/homebrew/var/mysql}"

"${MYSQLD_SAFE}" \
  --datadir="${DATADIR}" \
  --port=3307 \
  --mysqlx=0 \
  --socket=/tmp/openmind-mysql.sock \
  --pid-file=/tmp/openmind-mysql.pid

