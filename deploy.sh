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
WEATHER_SERVICE="weather-station"
SERVICE_USER="outbackelectronics"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_BIN="$(which node)"
NPM_BIN="$(which npm)"

echo "==> Pulling latest from main..."
git -C "$APP_DIR" pull origin main

echo "==> Installing dependencies (including dev for build)..."
"$NPM_BIN" --prefix "$APP_DIR" install

echo "==> Building..."
"$NPM_BIN" --prefix "$APP_DIR" run build

# ── Dedicated service user ────────────────────────────────────────────────────
# Run the Node process as a low-privilege system account with no login shell
# so a compromised server process cannot escalate to the deploying user's account.
if ! id -u "$SERVICE_USER" &>/dev/null; then
    echo "==> Creating dedicated service user '${SERVICE_USER}'..."
    sudo useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
fi

# Add the service user to the deploying user's primary group so it can read
# app files (server.js, dist/, node_modules) and the .env secrets file without
# making them world-readable.
DEPLOY_GROUP="$(id -gn)"
if ! id -Gn "$SERVICE_USER" 2>/dev/null | grep -qw "$DEPLOY_GROUP"; then
    sudo usermod -aG "$DEPLOY_GROUP" "$SERVICE_USER"
fi

# Set the setgid bit on the app directory so .db/.tmp files created by the
# service inherit the deploy group and stay writable by the service user.
sudo chmod g+s "$APP_DIR"

# Make existing .db, .log, and .tmp files in the app root group-writable.
# (node_modules and dist/ are deliberately excluded — max-depth 1.)
sudo find "$APP_DIR" -maxdepth 1 \( -name "*.db" -o -name "*.log" -o -name "*.tmp" \) \
    -exec chmod g+rw {} \; 2>/dev/null || true

# Ensure .env is readable by the service group but not world-readable.
if [ -f "$APP_DIR/.env" ]; then
    sudo chgrp "$DEPLOY_GROUP" "$APP_DIR/.env"
    sudo chmod 640 "$APP_DIR/.env"
fi
echo "==> Service user '${SERVICE_USER}' configured (group: ${DEPLOY_GROUP})."
# ── End dedicated service user ────────────────────────────────────────────────

# Create systemd service if it doesn't exist
if [ ! -f "/etc/systemd/system/${SERVICE_NAME}.service" ]; then
    echo "==> Creating systemd service..."
    sudo tee "/etc/systemd/system/${SERVICE_NAME}.service" > /dev/null <<EOF
[Unit]
Description=Outback Electronics Node Server
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
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
else
    # Service file already exists — update User= if it doesn't match SERVICE_USER.
    CURRENT_SVC_USER=$(grep -E "^User=" "/etc/systemd/system/${SERVICE_NAME}.service" | cut -d= -f2)
    if [ "$CURRENT_SVC_USER" != "$SERVICE_USER" ]; then
        echo "==> Updating service user from '${CURRENT_SVC_USER}' to '${SERVICE_USER}'..."
        sudo sed -i "s|^User=.*|User=${SERVICE_USER}|" "/etc/systemd/system/${SERVICE_NAME}.service"
        sudo systemctl daemon-reload
        echo "==> Service file updated."
    fi
fi

# ── Weather station sensor service ────────────────────────────────────────────
if [ ! -f "/etc/systemd/system/${WEATHER_SERVICE}.service" ]; then
    echo "==> Creating weather station service..."
    sudo cp "${APP_DIR}/weather-station.service" "/etc/systemd/system/${WEATHER_SERVICE}.service"
    # Update paths to match this install
    sudo sed -i "s|WorkingDirectory=.*|WorkingDirectory=${APP_DIR}|" "/etc/systemd/system/${WEATHER_SERVICE}.service"
    sudo sed -i "s|ExecStart=.*|ExecStart=/usr/bin/python3 ${APP_DIR}/weather_station.py|" "/etc/systemd/system/${WEATHER_SERVICE}.service"
    sudo sed -i "s|EnvironmentFile=.*|EnvironmentFile=-${APP_DIR}/.env|" "/etc/systemd/system/${WEATHER_SERVICE}.service"
    sudo systemctl daemon-reload
    sudo systemctl enable "$WEATHER_SERVICE"
    echo "==> Weather station service created and enabled on boot."
else
    CURRENT_WS_USER=$(grep -E "^User=" "/etc/systemd/system/${WEATHER_SERVICE}.service" | cut -d= -f2)
    if [ "$CURRENT_WS_USER" != "$SERVICE_USER" ]; then
        sudo sed -i "s|^User=.*|User=${SERVICE_USER}|" "/etc/systemd/system/${WEATHER_SERVICE}.service"
        sudo systemctl daemon-reload
    fi
fi

echo "==> Restarting services..."
sudo systemctl restart "$SERVICE_NAME"
sudo systemctl restart "$WEATHER_SERVICE"

# ── Backup script ────────────────────────────────────────────
BACKUP_SCRIPT="/home/$(whoami)/backup-db.sh"
USB_MOUNT="/media/$(whoami)/USB STICK"
BACKUP_DEST="$USB_MOUNT/outback-backups"

cat > "$BACKUP_SCRIPT" <<BACKUP_EOF
#!/bin/bash
SRC="$APP_DIR"
USB_MOUNT="/media/\$(whoami)/USB STICK"
DEST="\$USB_MOUNT/outback-backups"
STAMP=\$(date +%Y%m%d-%H%M)
LOG="/home/\$(whoami)/backup.log"

if ! mountpoint -q "\$USB_MOUNT"; then
  echo "\$(date): USB not mounted — backup skipped" >> "\$LOG"
  exit 1
fi

mkdir -p "\$DEST"

DB_FILES=("\$SRC"/*.db)
if [ ! -e "\${DB_FILES[0]}" ]; then
  echo "\$(date): No .db files found in \$SRC — backup skipped" >> "\$LOG"
  exit 1
fi

# Collect extra files that are gitignored but required to run the site
EXTRAS=()
[ -f "\$SRC/.env" ] && EXTRAS+=("\$SRC/.env")
[ -f "\$SRC/admin-audit.log" ] && EXTRAS+=("\$SRC/admin-audit.log")

tar czf "\$DEST/db-\$STAMP.tar.gz" "\${DB_FILES[@]}" "\${EXTRAS[@]}"

# Keep last 10 backups
ls -t "\$DEST"/db-*.tar.gz 2>/dev/null | tail -n +11 | xargs -r -d '\n' rm

echo "\$(date): OK → \$DEST/db-\$STAMP.tar.gz (\$(du -h "\$DEST/db-\$STAMP.tar.gz" | cut -f1))" >> "\$LOG"
BACKUP_EOF
chmod +x "$BACKUP_SCRIPT"
echo "==> Backup script written to $BACKUP_SCRIPT"

# Install hourly cron if not already present
CRON_LINE="0 * * * * $BACKUP_SCRIPT >> /home/$(whoami)/backup.log 2>&1"
if crontab -l 2>/dev/null | grep -qF "$BACKUP_SCRIPT"; then
  echo "==> Hourly backup cron already installed — skipping."
else
  (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
  echo "==> Hourly backup cron installed."
fi

# Run one backup immediately so there's something on the USB straight away
echo "==> Running initial backup..."
if "$BACKUP_SCRIPT"; then
  echo "==> Initial backup complete."
else
  echo "==> Initial backup skipped (USB may not be mounted yet — cron will retry hourly)."
fi
# ── End backup ───────────────────────────────────────────────

echo "==> Done. Service status:"
sudo systemctl status "$SERVICE_NAME" --no-pager -l
echo ""
sudo systemctl status "$WEATHER_SERVICE" --no-pager -l
