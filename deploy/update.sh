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
if [ ! -f /etc/garage.env ]; then
  # Primera versión con base de datos: instala PostgreSQL y prepara el servicio
  echo "$(date -Is) Falta la base de datos: ejecutando clouding-setup.sh"
  bash deploy/clouding-setup.sh
else
  bash deploy/build.sh
  systemctl restart garage
fi
echo "$(date -Is) Listo"
