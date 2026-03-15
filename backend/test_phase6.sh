#!/bin/bash
set -e
BASE="http://localhost:8000"
PASS=0
FAIL=0

# Login
TOKEN=$(curl -s -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@livingwell.ca","password":"Password1!"}' | python3.11 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

check() {
  local name="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo "  PASS: $name (HTTP $actual)"
    PASS=$((PASS+1))
  else
    echo "  FAIL: $name (expected $expected, got $actual)"
    FAIL=$((FAIL+1))
  fi
}

echo "=== Phase 6 API Tests ==="

# 1. Amortization schedule
echo "--- Amortization ---"
# First get debt facilities for property 3 (has debt in seed)
DEBT_IDS=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/portfolio/properties/3/debt" | python3.11 -c "import sys,json; data=json.load(sys.stdin); print(data[0]['debt_id'] if data else '')" 2>/dev/null)
if [ -n "$DEBT_IDS" ]; then
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE/api/portfolio/properties/3/debt/$DEBT_IDS/amortization?years=5")
  check "GET amortization schedule (5yr)" "200" "$STATUS"
else
  echo "  SKIP: No debt facilities found for property 3, trying property 1"
  DEBT_IDS=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/portfolio/properties/1/debt" | python3.11 -c "import sys,json; data=json.load(sys.stdin); print(data[0]['debt_id'] if data else '')" 2>/dev/null)
  if [ -n "$DEBT_IDS" ]; then
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE/api/portfolio/properties/1/debt/$DEBT_IDS/amortization?years=5")
    check "GET amortization schedule (5yr)" "200" "$STATUS"
  else
    echo "  SKIP: No debt facilities found"
  fi
fi

# 2. Projection
echo "--- Projections ---"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/portfolio/properties/1/projection" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "projection_years": 10,
    "revenue_growth": 0.03,
    "expense_growth": 0.02,
    "stabilized_annual_revenue": 360000,
    "stabilized_operating_expenses": 108000,
    "interim_revenue": 0,
    "interim_expenses": 0
  }')
check "POST run projection" "200" "$STATUS"

# 3. Refinance scenarios
echo "--- Refinance Scenarios ---"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE/api/portfolio/properties/1/refinance-scenarios")
check "GET refinance scenarios" "200" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/portfolio/properties/1/refinance-scenarios" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Test Refi",
    "assumed_new_valuation": 2000000,
    "new_ltv_percent": 75,
    "new_interest_rate": 4.5,
    "new_amortization_months": 300,
    "existing_debt_payout": 500000,
    "closing_costs": 15000
  }')
check "POST create refinance scenario" "201" "$STATUS"

# 4. Sale scenarios
echo "--- Sale Scenarios ---"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE/api/portfolio/properties/1/sale-scenarios")
check "GET sale scenarios" "200" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/portfolio/properties/1/sale-scenarios" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Test Sale",
    "assumed_sale_price": 2500000,
    "selling_costs_percent": 5,
    "debt_payout": 500000,
    "capital_gains_reserve": 50000
  }')
check "POST create sale scenario" "201" "$STATUS"

# 5. Management pack
echo "--- Management Pack ---"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE/api/reports/management-pack")
check "GET management pack" "200" "$STATUS"

# Verify management pack content
MGMT=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/reports/management-pack")
HAS_LP=$(echo "$MGMT" | python3.11 -c "import sys,json; d=json.load(sys.stdin); print('yes' if d.get('lp_summary') else 'no')" 2>/dev/null)
check "Management pack has lp_summary" "yes" "$HAS_LP"
HAS_PROP=$(echo "$MGMT" | python3.11 -c "import sys,json; d=json.load(sys.stdin); print('yes' if d.get('property_summary') else 'no')" 2>/dev/null)
check "Management pack has property_summary" "yes" "$HAS_PROP"

# 6. Turnovers
echo "--- Turnovers ---"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$BASE/api/operator/turnovers")
check "GET turnovers" "200" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/operator/turnovers" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "unit_id": 1,
    "community_id": 1,
    "scheduled_date": "2026-04-01",
    "notes": "Test turnover"
  }')
check "POST create turnover" "201" "$STATUS"

# Get the turnover ID and update it
TURNOVER_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/operator/turnovers" | python3.11 -c "import sys,json; data=json.load(sys.stdin); print(data[0]['turnover_id'] if data else '')" 2>/dev/null)
if [ -n "$TURNOVER_ID" ]; then
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/api/operator/turnovers/$TURNOVER_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"cleaning_complete": true, "repairs_complete": true}')
  check "PATCH update turnover checklist" "200" "$STATUS"
else
  echo "  SKIP: No turnover found to update"
fi

# 7. Delete scenarios
echo "--- Cleanup ---"
REFI_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/portfolio/properties/1/refinance-scenarios" | python3.11 -c "import sys,json; data=json.load(sys.stdin); print(data[0]['scenario_id'] if data else '')" 2>/dev/null)
if [ -n "$REFI_ID" ]; then
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer $TOKEN" "$BASE/api/portfolio/refinance-scenarios/$REFI_ID")
  check "DELETE refinance scenario" "204" "$STATUS"
fi

SALE_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/portfolio/properties/1/sale-scenarios" | python3.11 -c "import sys,json; data=json.load(sys.stdin); print(data[0]['scenario_id'] if data else '')" 2>/dev/null)
if [ -n "$SALE_ID" ]; then
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Authorization: Bearer $TOKEN" "$BASE/api/portfolio/sale-scenarios/$SALE_ID")
  check "DELETE sale scenario" "204" "$STATUS"
fi

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
