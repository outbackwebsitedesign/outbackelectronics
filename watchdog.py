#!/usr/bin/env python3
"""
Service watchdog for outbackelectronics + weather-station.

systemd already restarts crashed services, this script's job is to track
crash frequency and send an email alert when either threshold is breached:
  - 2 crashes within 10 minutes
  - 5 crashes within 1 hour

SMTP config is read from .env (same file used by server.js).
"""

import os
import re
import smtplib
import subprocess
import time
import logging
from collections import deque
from datetime import datetime
from email.mime.text import MIMEText

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
log = logging.getLogger('watchdog')

# ── Config ────────────────────────────────────────────────────────────────────

APP_DIR = os.path.dirname(os.path.abspath(__file__))

def read_env_file(path):
    vals = {}
    try:
        st = os.stat(path)
        if st.st_mode & 0o004:
            log.warning('.env is world-readable (mode %o), run: chmod 600 .env', st.st_mode & 0o777)
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, _, v = line.partition('=')
                    vals[k.strip()] = v.strip()
    except FileNotFoundError:
        pass
    return vals

env = read_env_file(os.path.join(APP_DIR, '.env'))

SMTP_HOST    = env.get('SMTP_HOST',    os.environ.get('SMTP_HOST', ''))
SMTP_PORT    = int(env.get('SMTP_PORT', os.environ.get('SMTP_PORT', '587')))
SMTP_USER    = env.get('SMTP_USER',    os.environ.get('SMTP_USER', ''))
SMTP_PASS    = env.get('SMTP_PASS',    os.environ.get('SMTP_PASS', ''))
NOTIFY_EMAIL = env.get('NOTIFY_EMAIL', os.environ.get('NOTIFY_EMAIL', ''))

SERVICES = ['outbackelectronics', 'weather-station']

POLL_INTERVAL   = 10      # seconds between state checks
WINDOW_SHORT    = 10 * 60 # 10 minutes in seconds
WINDOW_LONG     = 60 * 60 # 1 hour in seconds
THRESH_SHORT    = 2       # crashes in WINDOW_SHORT → alert
THRESH_LONG     = 5       # crashes in WINDOW_LONG  → alert
EMAIL_COOLDOWN  = 30 * 60 # minimum seconds between emails per service

# ── Email ─────────────────────────────────────────────────────────────────────

def send_alert(service, crash_times, reason):
    if not all([SMTP_HOST, SMTP_USER, SMTP_PASS, NOTIFY_EMAIL]):
        log.warning('SMTP not configured, cannot send alert for %s', service)
        return

    subject = f'[Outback Electronics] Service alert: {service}'
    lines = [
        f'Service: {service}',
        f'Reason:  {reason}',
        '',
        'Recent crash times:',
    ]
    for ts in crash_times:
        lines.append('  ' + datetime.fromtimestamp(ts).strftime('%Y-%m-%d %H:%M:%S'))
    body = '\n'.join(lines)

    msg = MIMEText(body)
    msg['Subject'] = subject
    msg['From']    = SMTP_USER
    msg['To']      = NOTIFY_EMAIL

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as s:
            s.ehlo()
            s.starttls()
            s.login(SMTP_USER, SMTP_PASS)
            s.sendmail(SMTP_USER, [NOTIFY_EMAIL], msg.as_string())
        log.info('Alert email sent for %s (%s)', service, reason)
    except Exception as e:
        log.error('Failed to send alert email for %s: %s', service, e)

# ── Service state ─────────────────────────────────────────────────────────────

def is_active(service):
    try:
        result = subprocess.run(
            ['systemctl', 'is-active', service],
            capture_output=True, text=True, timeout=5,
        )
        return result.stdout.strip() == 'active'
    except Exception:
        return False

# ── Main loop ─────────────────────────────────────────────────────────────────

def main():
    # Track whether each service was active on the previous poll
    prev_active = {s: is_active(s) for s in SERVICES}
    # Sliding window of crash timestamps per service
    crash_times = {s: deque() for s in SERVICES}
    # Timestamp of last alert email sent per service
    last_alert  = {s: 0.0 for s in SERVICES}

    log.info('Watchdog started. Monitoring: %s', ', '.join(SERVICES))
    for s in SERVICES:
        log.info('  %s: %s', s, 'active' if prev_active[s] else 'NOT active')

    while True:
        time.sleep(POLL_INTERVAL)
        now = time.time()

        for service in SERVICES:
            active = is_active(service)

            # Detect transition active → not-active as a crash
            if prev_active[service] and not active:
                log.warning('%s crashed at %s', service,
                            datetime.now().strftime('%H:%M:%S'))
                crash_times[service].append(now)

            prev_active[service] = active

            # Drop timestamps outside the long window
            while crash_times[service] and now - crash_times[service][0] > WINDOW_LONG:
                crash_times[service].popleft()

            # Count crashes in each window
            recent_short = sum(1 for t in crash_times[service] if now - t <= WINDOW_SHORT)
            recent_long  = len(crash_times[service])

            reason = None
            if recent_short >= THRESH_SHORT:
                reason = f'{recent_short} crashes in the last 10 minutes'
            elif recent_long >= THRESH_LONG:
                reason = f'{recent_long} crashes in the last hour'

            if reason and now - last_alert[service] > EMAIL_COOLDOWN:
                send_alert(service, list(crash_times[service]), reason)
                last_alert[service] = now
                # Clear crash history so the next wave of crashes starts fresh
                crash_times[service].clear()

if __name__ == '__main__':
    main()
