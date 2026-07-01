#!/bin/bash
# ---------------------------------------------------------------------------
# push-to-pi.sh — Ship Luke's CURRENT frontend onto bondly.co.za (the Pi).
#
# Run this AFTER you've reviewed and approved Luke's latest on Netlify.
# It takes whatever is on bondly-frontend `main` right now, builds the Switch
# app, and deploys ONLY the frontend build to the Pi. The backend is never
# touched, and any in-flight work in the Pi repo is left completely alone
# (the deploy is staged in a throwaway git worktree off origin/main).
#
#   Usage:  ./push-to-pi.sh
# ---------------------------------------------------------------------------
set -euo pipefail

FE="/Users/callumbaker/Desktop/bondly-frontend"   # Luke's repo (source of truth)
PI="/Users/callumbaker/Desktop/bondly"            # Pi repo (backend + served build)
ORIG_URL="https://bondly-origination.netlify.app" # cross-app redirect target

echo "→ [1/4] Pulling Luke's current frontend (bondly-frontend main)…"
cd "$FE"
git checkout main >/dev/null 2>&1
git pull --ff-only origin main
SRC_REF="$(git rev-parse --short HEAD)"
echo "    at bondly-frontend@${SRC_REF}"

echo "→ [2/4] Building the Switch app (prod origination URL baked in)…"
cd "$FE/frontend-src"
VITE_ORIGINATION_URL="$ORIG_URL" npm run build   # outputs to $FE/frontend

echo "→ [3/4] Staging frontend-only deploy in an isolated worktree off origin/main…"
cd "$PI"
git fetch -q origin
WT="$(mktemp -d)"
git worktree add -q --detach "$WT" origin/main
rsync -a --delete "$FE/frontend/" "$WT/frontend/"   # mirror build; backend untouched
cd "$WT"
git add frontend/
if git diff --cached --quiet; then
  echo "    no frontend changes vs live — nothing to deploy."
  cd "$PI"; git worktree remove --force "$WT"
  exit 0
fi
# Safety: refuse if anything outside frontend/ somehow got staged.
if git diff --cached --name-only | grep -qv '^frontend/'; then
  echo "    ABORT: non-frontend files staged — backend would be touched." >&2
  cd "$PI"; git worktree remove --force "$WT"; exit 1
fi
git commit -q -m "deploy(frontend): sync bondly-frontend@${SRC_REF} to Pi"

echo "→ [4/4] Pushing to main (Pi auto-deploys within ~2 min)…"
git push origin HEAD:main
cd "$PI"
git worktree remove --force "$WT"

echo "✓ Done. bondly.co.za will serve bondly-frontend@${SRC_REF} shortly."
echo "  Verify:  curl -so /dev/null -w '%{http_code}\n' https://bondly.co.za/"
