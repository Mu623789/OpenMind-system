#!/usr/bin/env bash
set -euo pipefail

export DB_URL="${DB_URL:-jdbc:mysql://127.0.0.1:3307/cpt208_discussion?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true}"
export DB_USERNAME="${DB_USERNAME:-root}"
export DB_PASSWORD="${DB_PASSWORD:-}"
export REDIS_HOST="${REDIS_HOST:-127.0.0.1}"
export REDIS_PORT="${REDIS_PORT:-6379}"
export REDIS_PASSWORD="${REDIS_PASSWORD:-}"
export AI_API_KEY="${AI_API_KEY:-}"

mvn spring-boot:run
