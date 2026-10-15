#!/usr/bin/env bash
# Compila Garage para correr con Node.js en un servidor propio (Clouding.io u otro Ubuntu).
# Lo usan clouding-setup.sh y update.sh; se ejecuta dentro de la carpeta del repositorio.
set -euo pipefail
cd "$(dirname "$0")/.."

# bun.lock apunta a un registro privado de Lovable, así que instalamos desde npm.
npm install --no-audit --no-fund --no-package-lock --legacy-peer-deps

# Las versiones más nuevas que permite package.json pueden no ser compatibles entre sí
# (por ejemplo, TanStack Start que pide Vite 8): fijamos las mismas versiones que bun.lock.
pins=()
for pkg in @tanstack/react-start @tanstack/react-router vite; do
  version=$(grep -oE "\"${pkg}@[0-9][^\"]*\"" bun.lock | head -1 | tr -d '"' || true)
  [ -n "$version" ] && pins+=("$version")
done
if [ ${#pins[@]} -gt 0 ]; then
  npm install --no-audit --no-fund --no-package-lock --legacy-peer-deps --no-save "${pins[@]}"
fi

NITRO_PRESET=node-server npx vite build
[ -f .output/server/index.mjs ] || { echo "La compilación no generó .output/server/index.mjs" >&2; exit 1; }
echo "Compilación lista: $(git rev-parse --short HEAD)"
