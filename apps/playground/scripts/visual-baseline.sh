#!/usr/bin/env bash
# Take (or check) the screenshot baselines in the same Linux container CI uses.
#
#   bun run visual:baseline                  # refresh every baseline
#   bun run visual:baseline admin            # …only the tests whose title matches (-g): admin pages
#   bun run visual:baseline -- -375          # …or one viewport (after `--`, a leading dash is not an option)
#   bun run visual:baseline --check          # compare only, as CI does; nothing is written
#
# It rebuilds the visual database, builds and serves the playground on the host (:3100), and runs Playwright
# in mcr.microsoft.com/playwright, whose version must match @playwright/test in package.json. Baselines taken on
# macOS would never match CI: fonts render differently, so there is one set, taken on Linux.
#
# The images land in apps/docs/public/screenshots/, which the docs serve. Look at them before committing:
# a baseline is a claim that this is what the page should look like.
set -euo pipefail

cd "$(dirname "$0")/.."
REPO_ROOT="$(cd ../.. && pwd)"
IMAGE="mcr.microsoft.com/playwright:v1.60.0-jammy"
PORT=3100

UPDATE=(--update-snapshots=all)
if [ "${1:-}" = "--check" ]; then
  UPDATE=()
  shift
fi
[ "${1:-}" = "--" ] && shift
GREP=()
[ "$#" -gt 0 ] && GREP=("--grep=$1")

if curl -s -o /dev/null --max-time 2 "http://localhost:${PORT}/"; then
  echo "✗ something is already serving :${PORT} — stop it first; the suite must photograph the build made here" >&2
  exit 1
fi

bun run db:visual
bun run build:visual

bun run preview:visual > .data/visual-preview.log 2>&1 &
PREVIEW=$!
trap 'kill "$PREVIEW" 2>/dev/null || true' EXIT
for _ in $(seq 1 30); do
  curl -sf -o /dev/null "http://localhost:${PORT}/" && break
  sleep 1
done

# `=all`, not the default `changed`: `changed` leaves a baseline alone while its diff is within the tolerance, so
# a small real change would never reach the committed image. git compares content, so only moved images show up.
docker run --rm -t \
  --add-host=host.docker.internal:host-gateway \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp -e NPM_CONFIG_UPDATE_NOTIFIER=false \
  -v "${REPO_ROOT}:/repo" \
  -w /repo/apps/playground \
  "${IMAGE}" \
  bash -c 'node scripts/visual-proxy.cjs & sleep 1; exec npx playwright test "$@"' _ ${UPDATE[@]+"${UPDATE[@]}"} ${GREP[@]+"${GREP[@]}"}
