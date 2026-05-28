#!/bin/bash
set -e

SERVICE_NAME="outbackelectronics"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="$(which node)"
NPM_BIN="$(which npm)"

# ── Preserve live data files before git reset wipes them ────────────────────
BACKUP_DIR="$(mktemp -d)"
echo "==> Backing up data files to $BACKUP_DIR..."
for f in "$APP_DIR"/*.db "$APP_DIR"/.env; do
    [ -f "$f" ] && cp "$f" "$BACKUP_DIR/" && echo "    backed up: $(basename "$f")"
done

echo "==> Pulling latest from main..."
git -C "$APP_DIR" fetch origin main
git -C "$APP_DIR" reset --hard origin/main

# ── Restore data files ────────────────────────────────────────────────────────
echo "==> Restoring data files..."
for f in "$BACKUP_DIR"/*; do
    [ -f "$f" ] && cp "$f" "$APP_DIR/" && echo "    restored: $(basename "$f")"
done
rm -rf "$BACKUP_DIR"

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
