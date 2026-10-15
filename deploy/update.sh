#!/usr/bin/env bash
# Baja los cambios de GitHub y, si hay algo nuevo, recompila y reinicia Garage.
# Lo ejecuta cron cada 10 minutos (lo configura clouding-setup.sh).
set -euo pipefail
cd "$(dirname "$0")/.."

git fetch -q origin main
if [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] && [ "${1:-}" != "--force" ]; then
  exit 0
fi

echo "$(date -Is) Actualizando a $(git rev-parse --short origin/main)"
git reset -q --hard origin/main
bash deploy/build.sh
systemctl restart garage
echo "$(date -Is) Listo"
