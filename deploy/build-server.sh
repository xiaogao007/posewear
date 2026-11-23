#!/usr/bin/env bash
set -euo pipefail
release_dir="${POSEWEAR_RELEASE:-/opt/posewear/releases/20261117}"
cd "$release_dir"
export PYTHONUTF8=1
export POSEWEAR_RAW=/opt/posewear/shared/assets-raw
export POSEWEAR_SITE=https://posewear.xiaogao.xyz
mkdir -p .local "$POSEWEAR_RAW"
printf '\nPOSEWEAR_STEP dependencies\n'
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm ci --omit=dev --no-audit --no-fund
if [ "${POSEWEAR_SKIP_FETCH:-0}" != 1 ]; then
printf '\nPOSEWEAR_STEP assets\n'
.venv/bin/python -X utf8 scripts/fetch-assets.py pose costume > .local/fetch-main.log 2>&1 &
main_download=$!
.venv/bin/python -X utf8 scripts/fetch-assets.py portrait > .local/fetch-portrait.log 2>&1 &
portrait_download=$!
wait "$main_download"
wait "$portrait_download"
fi
printf '\nPOSEWEAR_STEP build\n'
.venv/bin/python -X utf8 build.py
printf '\nPOSEWEAR_STEP configuration\n'
.venv/bin/python - <<'PY'
from pathlib import Path
root = Path.cwd()
headers = (root / 'dist/_headers').read_text(encoding='utf-8')
csp = next(line.split(':', 1)[1].strip() for line in headers.splitlines() if line.strip().startswith('Content-Security-Policy:'))
template = (root / 'deploy/posewear.caddy.in').read_text(encoding='utf-8')
config = template.replace('__DOMAIN__', 'posewear.xiaogao.xyz').replace('__ROOT__', '/opt/posewear/current').replace('__CSP__', csp)
(root / 'deploy/posewear.caddy').write_text(config, encoding='utf-8')
PY
printf '\nPOSEWEAR_BUILD_SUCCESS\n'
