#!/usr/bin/env bash
# GHL Social Planner Statistics Fetcher
# Requires: GHL_PRIVATE_INTEGRATION_TOKEN and GHL_LOCATION_ID in .env

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../.env" 2>/dev/null || { echo "Error: .env file not found"; exit 1; }

BASE_URL="https://services.leadconnectorhq.com"
AUTH="Authorization: Bearer $GHL_PRIVATE_INTEGRATION_TOKEN"
VER="Version: 2021-07-28"
CT="Content-Type: application/json"
LOC="$GHL_LOCATION_ID"

echo "=== Connected Accounts ==="
curl -s -X GET "$BASE_URL/social-media-posting/$LOC/accounts" \
  -H "$AUTH" -H "$VER" -H "$CT" | python3 -m json.tool

echo ""
echo "=== Posts (first 10) ==="
curl -s -X POST "$BASE_URL/social-media-posting/$LOC/posts/list?skip=0&limit=10" \
  -H "$AUTH" -H "$VER" -H "$CT" -d '{}' | python3 -m json.tool

echo ""
echo "=== Statistics ==="
# Get profileIds from accounts, then fetch stats
PROFILE_IDS=$(curl -s -X GET "$BASE_URL/social-media-posting/$LOC/accounts" \
  -H "$AUTH" -H "$VER" -H "$CT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
accounts = data.get('results', {}).get('accounts', [])
ids = [a['profileId'] for a in accounts if 'profileId' in a]
print(json.dumps(ids))
")

echo "Profile IDs: $PROFILE_IDS"
curl -s -X POST "$BASE_URL/social-media-posting/statistics?locationId=$LOC" \
  -H "$AUTH" -H "$VER" -H "$CT" \
  -d "{\"profileIds\": $PROFILE_IDS}" | python3 -m json.tool
