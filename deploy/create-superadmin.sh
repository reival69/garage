#!/usr/bin/env bash
# Garage — create the superadmin (or reset its password) on the server.
#   sudo bash /opt/garage/deploy/create-superadmin.sh tu@email.com "Tu nombre"
set -euo pipefail

if [ ! -f /etc/garage.env ]; then
  echo "No existe /etc/garage.env. Ejecuta antes deploy/clouding-setup.sh." >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
. /etc/garage.env
set +a

cd "$(dirname "$0")/.."
exec node deploy/create-superadmin.mjs "$@"
