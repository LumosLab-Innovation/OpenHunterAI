#!/usr/bin/env bash
# Propagate the generated Prisma client into every service's isolated pnpm copy.
# Runs on the VM host against the bind-mounted /opt/openhunter tree.
#
# Root cause this fixes: pnpm gives each service its own @prisma/client copy, but
# `prisma generate` only populates the peer-resolved copy under shared/db. The
# other copies stay stubs ("does not provide an export named 'Prisma'"). We copy
# the generated package + engine into each stub.
set -euo pipefail
ROOT=/opt/openhunter

# SRC pkg = a generated @prisma/client whose index.d.ts actually defines PrismaClient.
SRC_PKG=""
while IFS= read -r pkg; do
  if grep -q "PrismaClient" "$pkg/index.d.ts" 2>/dev/null; then SRC_PKG="$pkg"; break; fi
done < <(find "$ROOT" -type d -path '*/@prisma/client')

# SRC engine = the generated .prisma/client (sibling) with an engine .node file.
SRC_ENGINE=""
while IFS= read -r eng; do
  if ls "$eng"/*.node >/dev/null 2>&1; then SRC_ENGINE="$eng"; break; fi
done < <(find "$ROOT" -type d -path '*/node_modules/.prisma/client')

if [ -z "$SRC_PKG" ] || [ -z "$SRC_ENGINE" ]; then
  echo "FATAL: generated source not found (SRC_PKG='$SRC_PKG' SRC_ENGINE='$SRC_ENGINE')"
  exit 1
fi
echo "SRC_PKG=$SRC_PKG"
echo "SRC_ENGINE=$SRC_ENGINE"

count=0
while IFS= read -r pkg; do
  [ "$pkg" = "$SRC_PKG" ] && continue
  # Skip copies that are already generated.
  if grep -q "PrismaClient" "$pkg/index.d.ts" 2>/dev/null; then continue; fi
  # Fill the package files.
  cp -rf "$SRC_PKG"/. "$pkg"/
  # Fill the sibling .prisma/client engine dir (…/node_modules/.prisma/client).
  nm="$(dirname "$(dirname "$pkg")")"   # …/node_modules
  dst_engine="$nm/.prisma/client"
  mkdir -p "$dst_engine"
  cp -rf "$SRC_ENGINE"/. "$dst_engine"/
  echo "filled $pkg"
  count=$((count+1))
done < <(find "$ROOT" -type d -path '*/@prisma/client')

echo "done; filled $count copies"
