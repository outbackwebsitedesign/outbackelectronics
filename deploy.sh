#!/bin/bash
# ============================================================
# WARNING — DO NOT ADD git reset --hard OR git clean TO THIS SCRIPT
#
# The .db files (products.db, orders.db, customers.db, services.db,
# repairs.db, quotes.db, forum.db, staff.db, carts.db, sessions.db,
# gift-cards.db, memberships.db, software.db, tutorials.db, sellers.db,
# etc.) are the ENTIRE LIVE BUSINESS DATABASE. They are gitignored and
# live only on the production server alongside this code.
#
# git reset --hard and git clean WILL DELETE THEM WITH NO RECOVERY.
# This happened once and wiped everything. Never again.
#
# git pull is the only safe way to update — it only touches tracked files.
# ============================================================
set -e

SERVICE_NAME="outbackelectronics"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="$(which node)"
NPM_BIN="$(which npm)"

echo "==> Pulling latest from main..."
git -C "$APP_DIR" pull origin main

echo "==> Installing dependencies (including dev for build)..."
"$NPM_BIN" --prefix "$APP_DIR" install

echo "==> Building..."
"$NPM_BIN" --prefix "$APP_DIR" run build

# Create systemd service if it doesn't exist
if [ ! -f "/etc/systemd/system/${SERVICE_NAME}.service" ]; then
    echo "==> Creating systemd service..."
    sudo tee "/etc/systemd/system/${SERVICE_NAME}.service" > /dev/null <<EOF
[Unit]
Description=Outback Electronics Node Server
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=${APP_DIR}
ExecStart=${NODE_BIN} ${APP_DIR}/server.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
EnvironmentFile=-${APP_DIR}/.env

[Install]
WantedBy=multi-user.target
EOF
    sudo systemctl daemon-reload
    sudo systemctl enable "$SERVICE_NAME"
    echo "==> Service created and enabled on boot."
fi

echo "==> Restarting service..."
sudo systemctl restart "$SERVICE_NAME"

echo "==> Done. Service status:"
sudo systemctl status "$SERVICE_NAME" --no-pager -l
