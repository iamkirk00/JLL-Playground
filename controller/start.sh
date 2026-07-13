#!/usr/bin/env sh
# Iceberg Control Tower launcher (macOS/Linux): ./start.sh
cd "$(dirname "$0")" || exit 1
echo "Starting Iceberg Control Tower... dashboard: http://localhost:9500"
exec python3 controller.py "$@"
