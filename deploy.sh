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

# Keep last 72 backups (~3 days of hourly)
ls -t "\$DEST"/db-*.tar.gz 2>/dev/null | tail -n +73 | xargs -r -d '\n' rm

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
