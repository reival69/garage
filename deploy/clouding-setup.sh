#!/usr/bin/env bash
# Instala Garage en un servidor Ubuntu nuevo (por ejemplo, en Clouding.io) con el dominio talleo.es.
#
# Uso, como root en el servidor:
#   curl -fsSL https://raw.githubusercontent.com/reival69/garage/main/deploy/clouding-setup.sh | EMAIL=tu@correo.com bash
#
# Se puede volver a ejecutar sin problema: actualiza lo que ya existe.
set -euo pipefail

DOMAIN="${DOMAIN:-talleo.es}"
REPO="https://github.com/reival69/garage.git"
APP_DIR="/opt/garage"
PORT=3000
SITE="/etc/nginx/sites-available/garage"

if [ "$(id -u)" -ne 0 ]; then
  echo "Ejecuta este script como root (o con sudo)." >&2
  exit 1
fi

echo "==> Paquetes del sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get upgrade -yq
apt-get install -yq nginx git certbot python3-certbot-nginx ufw dnsutils curl ca-certificates cron

echo "==> Node.js 22"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -yq nodejs
fi
node --version

echo "==> Firewall (SSH, HTTP y HTTPS)"
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null

echo "==> Código desde GitHub"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch -q origin main
  git -C "$APP_DIR" reset -q --hard origin/main
else
  git clone -q "$REPO" "$APP_DIR"
fi

echo "==> Compilando (tarda unos minutos)"
bash "$APP_DIR/deploy/build.sh"

echo "==> Servicio que mantiene la app encendida"
id garage >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin garage
cat > /etc/systemd/system/garage.service <<UNIT
[Unit]
Description=Garage (talleo.es)
After=network.target

[Service]
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node $APP_DIR/.output/server/index.mjs
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=$PORT
User=garage
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable garage >/dev/null
systemctl restart garage

echo "==> Nginx"
if [ ! -f "$SITE" ] || ! grep -q "listen 443" "$SITE"; then
  cat > "$SITE" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX
fi
ln -sf "$SITE" /etc/nginx/sites-enabled/garage
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "==> Actualización automática desde GitHub cada 10 minutos"
systemctl enable --now cron >/dev/null
CRON="*/10 * * * * /bin/bash $APP_DIR/deploy/update.sh >> /var/log/garage-update.log 2>&1"
( crontab -l 2>/dev/null | grep -vF "$APP_DIR/deploy/update.sh" || true; echo "$CRON" ) | crontab -

echo "==> Comprobando que la app responde"
for _ in $(seq 1 20); do
  curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" && break
  sleep 1
done
curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" && echo "La app responde en el puerto $PORT" \
  || { echo "La app no responde. Revisa: journalctl -u garage -n 50" >&2; exit 1; }

echo "==> HTTPS"
SERVER_IP="$(curl -4 -fsS https://ifconfig.me || true)"
DOMAIN_IPS="$( (dig +short A "$DOMAIN"; dig +short A "www.$DOMAIN") | sort -u | grep -v '^$' || true)"
if [ -n "$SERVER_IP" ] && [ "$DOMAIN_IPS" = "$SERVER_IP" ]; then
  if [ -n "${EMAIL:-}" ]; then
    certbot --nginx -n --agree-tos -m "$EMAIL" --redirect -d "$DOMAIN" -d "www.$DOMAIN"
  else
    certbot --nginx -n --agree-tos --register-unsafely-without-email --redirect -d "$DOMAIN" -d "www.$DOMAIN"
  fi
  echo "Listo: https://$DOMAIN"
else
  echo "El dominio todavía no apunta solo a este servidor ($SERVER_IP)."
  echo "Ahora apunta a: ${DOMAIN_IPS:-(nada)}"
  echo "En tu DNS pon: A @ -> $SERVER_IP y A www -> $SERVER_IP (borra los A viejos)."
  echo "Cuando cambie, vuelve a ejecutar este script para activar HTTPS."
  echo "Mientras tanto la app se ve en: http://$SERVER_IP"
fi
