#!/usr/bin/env bash
# Phase 1A/1B Diagnostics - CNC Shop Floor Management
# Usage: bash scripts/diagnose_phase1.sh [BASE_URL]
# Example: bash scripts/diagnose_phase1.sh http://192.168.8.226:5000

set -e
BASE=${1:-http://localhost:5000}
API="$BASE/api"
ADMIN_USER=${ADMIN_USER:-ADMIN001}
ADMIN_PASS=${ADMIN_PASS:-admin123}

banner() { echo -e "\n==== $1 ====\n"; }
req() {
  local method=$1; shift
  local url=$1; shift
  curl -s -S -X "$method" "$url" "$@"
}
need_jq() {
  if ! command -v jq >/dev/null 2>&1; then
    echo "jq not found. Please install jq: sudo apt-get install -y jq" >&2
    exit 1
  fi
}

need_jq

banner "1) Ping backend"
code=$(curl -s -o /dev/null -w "%{http_code}" "$API/materials") || true
if [ "$code" = "401" ] || [ "$code" = "403" ] || [ "$code" = "200" ]; then
  echo "Backend reachable at $BASE"
else
  echo "ERROR: Backend not reachable at $BASE (HTTP $code)"; exit 1
fi

banner "2) Login as admin ($ADMIN_USER)"
LOGIN=$(req POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"employee_id\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}")
TOKEN=$(echo "$LOGIN" | jq -r '.token // empty')
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "Login failed:"; echo "$LOGIN" | jq . || echo "$LOGIN"; exit 1
fi
echo "Login OK"

banner "3) Check materials"
MATS=$(req GET "$API/materials" -H "Authorization: Bearer $TOKEN")
COUNT=$(echo "$MATS" | jq -r '.total // (.materials|length) // 0')
if [ "$COUNT" = "0" ]; then
  echo "WARN: No materials found. Consider loading test data."
else
  echo "Materials: $COUNT found"
fi

banner "4) Create test order"
TODAY=$(date +%F)
DUE=$(date -d "+7 days" +%F 2>/dev/null || date -v+7d +%F)
ORDER_JSON=$(cat <<JSON
{
  "customer_name": "Diag Customer",
  "customer_email": "diag@example.com",
  "customer_phone": "",
  "order_date": "$TODAY",
  "due_date": "$DUE",
  "notes": "diagnostic order",
  "parts": [
    {"part_name": "diag-part", "description": "", "quantity": 1, "material_id": 1}
  ]
}
JSON
)
CREATE=$(req POST "$API/orders" -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" -d "$ORDER_JSON")
OK=$(echo "$CREATE" | jq -r '.success // false')
if [ "$OK" != "true" ]; then
  echo "Order create FAILED:"; echo "$CREATE" | jq . || echo "$CREATE"; exit 2
fi
ORDER_ID=$(echo "$CREATE" | jq -r '.order.id')
[ -n "$ORDER_ID" ] || { echo "Missing order id in response"; echo "$CREATE" | jq .; exit 2; }
echo "Order created with id: $ORDER_ID"

banner "5) List orders"
ORDERS=$(req GET "$API/orders" -H "Authorization: Bearer $TOKEN")
OCNT=$(echo "$ORDERS" | jq -r '.total // (.orders|length) // 0')
echo "Orders returned: $OCNT"

banner "6) Fetch order by id ($ORDER_ID)"
ONE=$(req GET "$API/orders/$ORDER_ID" -H "Authorization: Bearer $TOKEN")
if [ "$(echo "$ONE" | jq -r '.success // false')" != "true" ]; then
  echo "Fetch order FAILED:"; echo "$ONE" | jq .; exit 3
fi
echo "Fetch OK. Customer: $(echo "$ONE" | jq -r '.order.customer_name')"

echo -e "\nAll checks passed. Phase 1A create/list/get is working."
