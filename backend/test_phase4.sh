#!/bin/bash
# Phase 4 API Test Suite
set -e

BASE="http://localhost:8000"
PASS=0
FAIL=0

ok()   { PASS=$((PASS+1)); echo "  [PASS] $1"; }
fail() { FAIL=$((FAIL+1)); echo "  [FAIL] $1 — $2"; }

check() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" -eq "$expected" ] 2>/dev/null; then ok "$label"; else fail "$label" "expected $expected, got $actual"; fi
}

echo "=========================================="
echo "  Phase 4 API Test Suite"
echo "=========================================="

# --- Auth ---
echo ""
echo "--- Authentication ---"
TOKEN=$(curl -s -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@livingwell.ca","password":"Password1!"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")

if [ -n "$TOKEN" ] && [ "$TOKEN" != "None" ]; then
  ok "Admin login"
else
  fail "Admin login" "no token returned"
  echo "Cannot proceed without auth. Exiting."
  exit 1
fi

AUTH="Authorization: Bearer $TOKEN"

# --- Notifications ---
echo ""
echo "--- Notifications ---"

CODE=$(curl -s -o /tmp/notif_list.json -w "%{http_code}" "$BASE/api/notifications" -H "$AUTH")
check "GET /api/notifications" 200 "$CODE"

CODE=$(curl -s -o /tmp/notif_unread.json -w "%{http_code}" "$BASE/api/notifications?unread_only=true" -H "$AUTH")
check "GET /api/notifications?unread_only=true" 200 "$CODE"

CODE=$(curl -s -o /tmp/notif_readall.json -w "%{http_code}" -X PATCH "$BASE/api/notifications/read-all" -H "$AUTH")
check "PATCH /api/notifications/read-all" 200 "$CODE"

# --- Documents ---
echo ""
echo "--- Document Management ---"

# List documents for investor 1
CODE=$(curl -s -o /tmp/doc_list.json -w "%{http_code}" "$BASE/api/documents/investor/1" -H "$AUTH")
check "GET /api/documents/investor/1" 200 "$CODE"

# Upload a test document
echo "test document content" > /tmp/test_upload.pdf
CODE=$(curl -s -o /tmp/doc_upload.json -w "%{http_code}" -X POST "$BASE/api/documents/upload" \
  -H "$AUTH" \
  -F "investor_id=1" \
  -F "title=Test K-1 Document" \
  -F "document_type=tax_form" \
  -F "file=@/tmp/test_upload.pdf;type=application/pdf")
check "POST /api/documents/upload" 201 "$CODE"

# Extract document_id from upload response
DOC_ID=$(python3 -c "import json; d=json.load(open('/tmp/doc_upload.json')); print(d.get('document_id',''))" 2>/dev/null || echo "")

if [ -n "$DOC_ID" ] && [ "$DOC_ID" != "" ]; then
  ok "Upload returned document_id=$DOC_ID"

  # Download the document
  CODE=$(curl -s -o /tmp/doc_download -w "%{http_code}" "$BASE/api/documents/$DOC_ID/download" -H "$AUTH")
  check "GET /api/documents/$DOC_ID/download" 200 "$CODE"

  # Mark as viewed
  CODE=$(curl -s -o /tmp/doc_viewed.json -w "%{http_code}" -X PATCH "$BASE/api/documents/$DOC_ID/viewed" -H "$AUTH")
  check "PATCH /api/documents/$DOC_ID/viewed" 200 "$CODE"

  # Verify is_viewed is true
  VIEWED=$(python3 -c "import json; d=json.load(open('/tmp/doc_viewed.json')); print(d.get('is_viewed',''))" 2>/dev/null || echo "")
  if [ "$VIEWED" = "True" ] || [ "$VIEWED" = "true" ]; then
    ok "Document marked as viewed"
  else
    fail "Document marked as viewed" "is_viewed=$VIEWED"
  fi
else
  fail "Upload returned document_id" "could not extract document_id"
fi

# --- Portfolio Returns Metrics ---
echo ""
echo "--- Portfolio Returns Metrics ---"

CODE=$(curl -s -o /tmp/returns.json -w "%{http_code}" "$BASE/api/portfolio/metrics/returns" -H "$AUTH")
check "GET /api/portfolio/metrics/returns" 200 "$CODE"

# Check that it returns fund data
FUND_COUNT=$(python3 -c "import json; d=json.load(open('/tmp/returns.json')); print(len(d.get('funds',[])))" 2>/dev/null || echo "0")
if [ "$FUND_COUNT" -gt 0 ]; then
  ok "Returns metrics has $FUND_COUNT fund(s)"
else
  fail "Returns metrics fund count" "expected >0, got $FUND_COUNT"
fi

# Check equity multiple is present
EM=$(python3 -c "import json; d=json.load(open('/tmp/returns.json')); print(d.get('portfolio_equity_multiple','null'))" 2>/dev/null || echo "null")
ok "Portfolio equity multiple: $EM"

# --- Calculations Endpoints ---
echo ""
echo "--- Calculations ---"

CODE=$(curl -s -o /tmp/calc_noi.json -w "%{http_code}" -X POST "$BASE/api/calculations/noi" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"gross_potential_revenue":500000,"vacancy_rate":0.05,"operating_expenses":100000,"property_tax":25000,"insurance":12000}')
check "POST /api/calculations/noi" 200 "$CODE"

CODE=$(curl -s -o /tmp/calc_dscr.json -w "%{http_code}" -X POST "$BASE/api/calculations/dscr" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"noi":300000,"annual_debt_service":200000}')
check "POST /api/calculations/dscr" 200 "$CODE"

CODE=$(curl -s -o /tmp/calc_ltv.json -w "%{http_code}" -X POST "$BASE/api/calculations/ltv" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"outstanding_debt":3000000,"property_value":5000000}')
check "POST /api/calculations/ltv" 200 "$CODE"

# --- Investor Login Test (role-based) ---
echo ""
echo "--- Investor Role Access ---"

INV_TOKEN=$(curl -s -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"investor1@example.com","password":"Password1!"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")

if [ -n "$INV_TOKEN" ] && [ "$INV_TOKEN" != "None" ]; then
  ok "Investor login"
  INV_AUTH="Authorization: Bearer $INV_TOKEN"

  # Investor should be able to list their own notifications
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/notifications" -H "$INV_AUTH")
  check "Investor GET /api/notifications" 200 "$CODE"

  # Investor should NOT be able to upload documents (403)
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/documents/upload" \
    -H "$INV_AUTH" \
    -F "investor_id=1" \
    -F "title=Unauthorized" \
    -F "document_type=tax_form" \
    -F "file=@/tmp/test_upload.pdf;type=application/pdf")
  check "Investor POST /api/documents/upload (should 403)" 403 "$CODE"
else
  fail "Investor login" "no token"
fi

# --- Resident Login Test ---
echo ""
echo "--- Resident Role Access ---"

RES_TOKEN=$(curl -s -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"resident@example.com","password":"Password1!"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")

if [ -n "$RES_TOKEN" ] && [ "$RES_TOKEN" != "None" ]; then
  ok "Resident login"
  RES_AUTH="Authorization: Bearer $RES_TOKEN"

  # Resident should get notifications
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/notifications" -H "$RES_AUTH")
  check "Resident GET /api/notifications" 200 "$CODE"
else
  fail "Resident login" "no token"
fi

# --- Summary ---
echo ""
echo "=========================================="
echo "  RESULTS: $PASS passed, $FAIL failed"
echo "=========================================="

if [ "$FAIL" -gt 0 ]; then exit 1; fi
