#!/usr/bin/env bash
set -euo pipefail
release_dir="${POSEWEAR_RELEASE:-/opt/posewear/releases/20261117}"
if [ "$(id -u)" -ne 0 ]; then
    echo 'Run this activation script with sudo.' >&2
    exit 1
fi
test -f "$release_dir/dist/.build-ready"
test -f "$release_dir/deploy/posewear.caddy"
test -f "$release_dir/node_modules/undici/package.json"
test -f "$release_dir/node_modules/better-auth/package.json"
test -f "$release_dir/private/manifest.json"
test -f "$release_dir/private/retired.caddy"
if [ -e /opt/posewear/current ] && [ ! -L /opt/posewear/current ]; then
    echo '/opt/posewear/current is not a symlink; refusing to replace it.' >&2
    exit 1
fi
if [ -f /etc/caddy/posewear.caddy ] && ! grep -q '^posewear\.xiaogao\.xyz {' /etc/caddy/posewear.caddy; then
    echo 'An unrelated Caddy configuration already uses this filename.' >&2
    exit 1
fi
backup_dir="/opt/posewear/backups/$(date -u +%Y%m%dT%H%M%SZ)"
install -d -m 0700 "$backup_dir"
cp -p /etc/caddy/Caddyfile "$backup_dir/Caddyfile"
if [ -f /etc/caddy/posewear.caddy ]; then
    cp -p /etc/caddy/posewear.caddy "$backup_dir/posewear.caddy"
fi
# Only directories are restricted here: media files share immutable cache inodes
# with the raw gallery. Their bytes/ownership must not be changed through links.
find "$release_dir/private" -type d -exec chgrp caddy {} +
find "$release_dir/private" -type d -exec chmod 0750 {} +
ln -sfn "$release_dir" /opt/posewear/current
install -m 0644 "$release_dir/deploy/posewear.caddy" /etc/caddy/posewear.caddy
if ! grep -Fxq 'import /etc/caddy/posewear.caddy' /etc/caddy/Caddyfile; then
    printf '\nimport /etc/caddy/posewear.caddy\n' >> /etc/caddy/Caddyfile
fi
restore_caddy() {
    cp -p "$backup_dir/Caddyfile" /etc/caddy/Caddyfile
    if [ -f "$backup_dir/posewear.caddy" ]; then
        cp -p "$backup_dir/posewear.caddy" /etc/caddy/posewear.caddy
    fi
}
if ! caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile; then
    restore_caddy
    echo "Caddy validation failed. Previous main configuration restored: $backup_dir" >&2
    exit 1
fi
install -m 0644 "$release_dir/deploy/posewear-proxy.service" /etc/systemd/system/posewear-proxy.service
install -m 0644 "$release_dir/deploy/posewear-access.service" /etc/systemd/system/posewear-access.service
systemctl daemon-reload
if ! systemctl enable posewear-proxy.service posewear-access.service || ! systemctl restart posewear-proxy.service posewear-access.service; then
    restore_caddy
    echo 'Proxy startup failed; existing Caddy configuration restored.' >&2
    exit 1
fi
proxy_ready=0
for attempt in $(seq 1 20); do
    if curl --silent --fail http://127.0.0.1:8790/healthz >/dev/null && curl --silent --fail http://127.0.0.1:8792/healthz >/dev/null; then
        proxy_ready=1
        break
    fi
    sleep 1
done
if [ "$proxy_ready" -ne 1 ]; then
    restore_caddy
    echo 'Proxy health check failed; existing Caddy configuration restored.' >&2
    exit 1
fi
if ! systemctl reload caddy; then
    restore_caddy
    systemctl reload caddy || true
    echo 'Caddy reload failed; previous configuration restored.' >&2
    exit 1
fi
printf '\nPOSEWEAR_ACTIVATED\n'
printf 'Backup: %s\n' "$backup_dir"
systemctl is-active posewear-proxy.service posewear-access.service caddy
systemctl is-enabled posewear-proxy.service posewear-access.service
