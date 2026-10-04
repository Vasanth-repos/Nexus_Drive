#!/usr/bin/env sh
set -eu
PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
docker version >/dev/null
cd "$PROJECT_DIR"
./mvnw clean verify -Pintegration
