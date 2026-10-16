#!/usr/bin/env bash
# Garage — save the Stripe keys on the server and restart the app.
#   sudo bash /opt/garage/deploy/set-stripe-keys.sh
# It asks for the secret key (sk_live_… or sk_test_…) and the webhook signing
# secret (whsec_…). Nothing is shown on screen.
set -euo pipefail
ENV_FILE=/etc/garage.env

if [ "$(id -u)" -ne 0 ]; then
  echo "Ejecuta este script con sudo." >&2
  exit 1
fi
[ -f "$ENV_FILE" ] || { echo "No existe $ENV_FILE. Ejecuta antes deploy/clouding-setup.sh." >&2; exit 1; }

read -rsp "Clave secreta de Stripe (empieza por sk_live_ o sk_test_): " SK; echo
case "$SK" in sk_live_*|sk_test_*|rk_live_*|rk_test_*) ;; *) echo "Esa clave no parece de Stripe." >&2; exit 1;; esac
read -rsp "Secreto del webhook (empieza por whsec_): " WH; echo
case "$WH" in whsec_*) ;; *) echo "Ese secreto no empieza por whsec_." >&2; exit 1;; esac

set_var() {
  local name="$1" value="$2"
  if grep -q "^$name=" "$ENV_FILE"; then
    sed -i "s|^$name=.*|$name=$value|" "$ENV_FILE"
  else
    echo "$name=$value" >> "$ENV_FILE"
  fi
}
set_var STRIPE_SECRET_KEY "$SK"
set_var STRIPE_WEBHOOK_SECRET "$WH"
grep -q '^APP_URL=' "$ENV_FILE" || set_var APP_URL "https://talleo.es"
chmod 600 "$ENV_FILE"

systemctl restart garage
echo "Claves guardadas y app reiniciada."
case "$SK" in sk_test_*) echo "Estás en MODO PRUEBA: usa la tarjeta 4242 4242 4242 4242 para probar.";; esac
