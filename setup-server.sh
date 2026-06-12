#!/usr/bin/env bash
# One-time server setup: nginx + SSL + build + PM2
set -euo pipefail

DOMAIN="ygbackend.com"
EMAIL="yechiel1253@gmail.com"
BACKEND_DIR="/root/smsemail"
FRONTEND_DIR="/root/sms-email-gui"

echo "▶ Installing nginx and certbot..."
apt-get update -y -q
apt-get install -y -q nginx certbot python3-certbot-nginx

echo "▶ Pulling latest code..."
cd "$BACKEND_DIR"  && git pull
cd "$FRONTEND_DIR" && git pull

echo "▶ Configuring nginx (HTTP only for ACME challenge)..."
mkdir -p /var/www/html
cp "$BACKEND_DIR/nginx/$DOMAIN" /etc/nginx/sites-available/"$DOMAIN"
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/"$DOMAIN" /etc/nginx/sites-enabled/"$DOMAIN"

# Temporarily serve HTTP only so certbot can validate
cat > /etc/nginx/sites-available/"$DOMAIN" << 'HTTPEOF'
server {
    listen 80;
    server_name ygbackend.com;
    root /var/www/html;
    location /.well-known/acme-challenge/ { try_files $uri =404; }
    location / { return 200 'ok'; add_header Content-Type text/plain; }
}
HTTPEOF

nginx -t
systemctl enable nginx
systemctl restart nginx

echo "▶ Obtaining SSL certificate via webroot..."
certbot certonly --webroot -w /var/www/html \
  -d "$DOMAIN" \
  --non-interactive --agree-tos -m "$EMAIL"

echo "▶ Applying full nginx config with SSL..."
cp "$BACKEND_DIR/nginx/$DOMAIN" /etc/nginx/sites-available/"$DOMAIN"
nginx -t
systemctl reload nginx

echo "▶ Setting up certbot auto-renewal..."
systemctl enable certbot.timer 2>/dev/null || true
echo "0 0 * * * root certbot renew --quiet --post-hook 'systemctl reload nginx'" \
  > /etc/cron.d/certbot-renew

echo "▶ Building backend..."
cd "$BACKEND_DIR"
npm ci --prefer-offline
npm run build

echo "▶ Starting backend with PM2..."
pm2 delete smsemail 2>/dev/null || true
pm2 start dist/main.js --name smsemail --cwd "$BACKEND_DIR"
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

echo "▶ Setting frontend env..."
cd "$FRONTEND_DIR"
if [ ! -f .env ] || ! grep -q "VITE_API_URL" .env 2>/dev/null; then
  echo "VITE_API_URL=https://$DOMAIN" >> .env
fi

echo "▶ Building frontend..."
npm ci --prefer-offline
npm run build

echo ""
echo "✓ Setup complete. Visit https://$DOMAIN"
