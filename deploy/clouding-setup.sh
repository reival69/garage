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
ENV_FILE="/etc/garage.env"
UPLOAD_DIR="/var/lib/garage/uploads"
BACKUP_DIR="/var/backups/garage"

if [ "$(id -u)" -ne 0 ]; then
  echo "Ejecuta este script como root (o con sudo)." >&2
  exit 1
fi

echo "==> Paquetes del sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get upgrade -yq
apt-get install -yq nginx git certbot python3-certbot-nginx ufw dnsutils curl ca-certificates cron postgresql openssl

echo "==> Base de datos (PostgreSQL)"
systemctl enable --now postgresql >/dev/null
if [ ! -f "$ENV_FILE" ]; then
  DB_PASSWORD="$(openssl rand -hex 24)"
  cat > "$ENV_FILE" <<ENV
DATABASE_URL=postgres://garage:$DB_PASSWORD@127.0.0.1:5432/garage
UPLOAD_DIR=$UPLOAD_DIR
ENV
  chmod 600 "$ENV_FILE"
fi
DB_PASSWORD="$(sed -n 's#^DATABASE_URL=postgres://garage:\([^@]*\)@.*#\1#p' "$ENV_FILE")"
if ! runuser -u postgres -- psql -tAc "select 1 from pg_roles where rolname = 'garage'" | grep -q 1; then
  runuser -u postgres -- psql -q -c "create role garage login password '$DB_PASSWORD'"
else
  runuser -u postgres -- psql -q -c "alter role garage password '$DB_PASSWORD'"
fi
if ! runuser -u postgres -- psql -tAc "select 1 from pg_database where datname = 'garage'" | grep -q 1; then
  runuser -u postgres -- createdb -O garage garage
fi

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
# Fotos y firmas subidas por los talleres
mkdir -p "$UPLOAD_DIR"
chown -R garage:garage /var/lib/garage
chmod 750 /var/lib/garage
cat > /etc/systemd/system/garage.service <<UNIT
[Unit]
Description=Garage (talleo.es)
After=network.target postgresql.service
Requires=postgresql.service

[Service]
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node $APP_DIR/.output/server/index.mjs
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=$PORT
EnvironmentFile=$ENV_FILE
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
# Las fotos se envían en el cuerpo de la petición
echo "client_max_body_size 30m;" > /etc/nginx/conf.d/garage-uploads.conf
ln -sf "$SITE" /etc/nginx/sites-enabled/garage
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "==> Actualización automática desde GitHub cada 10 minutos"
systemctl enable --now cron >/dev/null
CRON="*/10 * * * * /bin/bash $APP_DIR/deploy/update.sh >> /var/log/garage-update.log 2>&1"
( crontab -l 2>/dev/null | grep -vF "$APP_DIR/deploy/update.sh" || true; echo "$CRON" ) | crontab -

echo "==> Copia de seguridad diaria (base de datos y fotos, se guardan 14 días)"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
cat > /etc/cron.daily/garage-backup <<BACKUP
#!/bin/sh
set -e
STAMP=\$(date +%F)
runuser -u postgres -- pg_dump -Fc garage > $BACKUP_DIR/garage-\$STAMP.dump
tar -czf $BACKUP_DIR/uploads-\$STAMP.tar.gz -C /var/lib/garage uploads
find $BACKUP_DIR -type f -mtime +14 -delete
BACKUP
chmod 755 /etc/cron.daily/garage-backup

echo "==> Comprobando que la app responde"
for _ in $(seq 1 20); do
  curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" && break
  sleep 1
done
curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" && echo "La app responde en el puerto $PORT" \
  || { echo "La app no responde. Revisa: journalctl -u garage -n 50" >&2; exit 1; }

echo "==> HTTPS"
SERVER_IP="$(curl -4 -fsS https://ifconfig.me || true)"
# Solo las IP: si www es un CNAME, dig también devuelve el nombre al que apunta
DOMAIN_IPS="$( (dig +short A "$DOMAIN"; dig +short A "www.$DOMAIN") | grep -E '^[0-9.]+$' | sort -u || true)"
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

echo
if runuser -u postgres -- psql -d garage -tAc "select 1 from docs where tenant_id = 'global' and collection = 'users' and data->>'role' = 'superadmin' limit 1" 2>/dev/null | grep -q 1; then
  echo "Superadmin: ya existe. Para cambiar su contraseña:"
else
  echo "Falta crear tu usuario superadmin. Ejecuta:"
fi
echo "  sudo bash $APP_DIR/deploy/create-superadmin.sh tu@email.com \"Tu nombre\""
