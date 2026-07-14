#!/usr/bin/env bash
# Fetcher.io VPS baseline setup — Ubuntu 22.04/24.04 on Hostinger
# Run as root: bash infra/vps/setup.sh
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
APP_DIR="${APP_DIR:-/var/www/fetcherio}"
REPO_URL="${REPO_URL:-https://github.com/your-org/fetcherio.git}"

echo "==> Creating deploy user"
if ! id "$DEPLOY_USER" &>/dev/null; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
  usermod -aG sudo "$DEPLOY_USER"
  mkdir -p /home/$DEPLOY_USER/.ssh
  cp /root/.ssh/authorized_keys /home/$DEPLOY_USER/.ssh/ 2>/dev/null || true
  chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh
  chmod 700 /home/$DEPLOY_USER/.ssh
  chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys 2>/dev/null || true
fi

echo "==> Hardening SSH (key-only, no root login)"
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl reload sshd || systemctl reload ssh

echo "==> Installing system packages"
apt-get update
apt-get install -y curl git build-essential nginx certbot python3-certbot-nginx ufw fail2ban

echo "==> Installing Node 20 via NVM for $DEPLOY_USER"
sudo -u "$DEPLOY_USER" bash -c '
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  . "$NVM_DIR/nvm.sh"
  nvm install 20
  nvm alias default 20
  corepack enable
  corepack prepare pnpm@9 --activate
  npm install -g pm2
'

echo "==> Installing MongoDB 7"
if ! command -v mongod &>/dev/null; then
  curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
  echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" \
    > /etc/apt/sources.list.d/mongodb-org-7.0.list
  apt-get update
  apt-get install -y mongodb-org
  systemctl enable mongod
  systemctl start mongod
fi

echo "==> Installing Redis"
apt-get install -y redis-server
sed -i 's/^supervised no/supervised systemd/' /etc/redis/redis.conf
sed -i 's/^# requirepass .*/requirepass changeme/' /etc/redis/redis.conf
sed -i 's/^bind .*/bind 127.0.0.1 ::1/' /etc/redis/redis.conf
systemctl enable redis-server
systemctl restart redis-server

echo "==> Configuring UFW"
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "==> Creating app directory"
mkdir -p "$APP_DIR" /var/log/fetcherio
chown -R $DEPLOY_USER:$DEPLOY_USER "$APP_DIR" /var/log/fetcherio

echo "==> Cloning repository (if not present)"
if [ ! -d "$APP_DIR/.git" ]; then
  sudo -u "$DEPLOY_USER" git clone "$REPO_URL" "$APP_DIR"
fi

echo "==> Installing Nginx site config"
cp "$APP_DIR/infra/nginx/fetcherio.conf" /etc/nginx/sites-available/fetcherio.conf
ln -sf /etc/nginx/sites-available/fetcherio.conf /etc/nginx/sites-enabled/fetcherio.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo ""
echo "=== Next steps (manual) ==="
echo "1. Point DNS A records for productfetcher.online, app, api, admin, docs to this server's IP"
echo "2. Run: certbot --nginx -d productfetcher.online -d www.productfetcher.online -d app.productfetcher.online -d api.productfetcher.online -d admin.productfetcher.online -d docs.productfetcher.online"
echo "3. Copy apps/api/.env.example to apps/api/.env and apps/web/.env.local — fill secrets"
echo "4. As $DEPLOY_USER: cd $APP_DIR && pnpm install && pnpm build && pm2 start ecosystem.config.cjs"
echo "5. pm2 save && pm2 startup"
