#!/bin/bash
# Phase 5 API Test Suite
set -e
BASE="http://localhost:8000/api"
PASS=0
FAIL=0
ERRORS=""

test_endpoint() {
    local name="$1"
    local method="$2"
    local url="$3"
    local data="$4"
    local expected="$5"

    if [ "$method" = "GET" ]; then
        CODE=$(curl -s -o /tmp/test_resp.json -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$url")
    elif [ "$method" = "POST" ]; then
        CODE=$(curl -s -o /tmp/test_resp.json -w "%{http_code}" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -X POST -d "$data" "$url")
    elif [ "$method" = "PATCH" ]; then
        CODE=$(curl -s -o /tmp/test_resp.json -w "%{http_code}" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -X PATCH -d "$data" "$url")
    fi

    if [ "$CODE" = "$expected" ]; then
        echo "  PASS [$CODE] $name"
        PASS=$((PASS + 1))
    else
        echo "  FAIL [$CODE] $name (expected $expected)"
        RESP=$(cat /tmp/test_resp.json 2>/dev/null | head -c 300)
        echo "       Response: $RESP"
        FAIL=$((FAIL + 1))
        ERRORS="$ERRORS\n  - $name: got $CODE, expected $expected"
    fi
}

echo "============================================"
echo "  Phase 5 API Test Suite"
echo "============================================"

# Login as admin
echo ""
echo "--- Authentication ---"
TOKEN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
    -d '{"email":"admin@livingwell.ca","password":"Password1!"}' | python3.11 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")

if [ -z "$TOKEN" ]; then
    echo "  FAIL: Could not get auth token"
    exit 1
fi
echo "  PASS [200] Admin login"
PASS=$((PASS + 1))

# --- Mortgage Amortization Engine ---
echo ""
echo "--- Mortgage Amortization Engine ---"
test_endpoint "Debt amortization schedule (property 1, debt 1)" \
    "GET" "$BASE/portfolio/properties/1/debt/1/amortization?years=5" "" "200"

test_endpoint "Debt amortization schedule (property 3, debt 3)" \
    "GET" "$BASE/portfolio/properties/3/debt/3/amortization?years=3" "" "200"

# --- Time-Phased Projection Engine ---
echo ""
echo "--- Time-Phased Projection Engine ---"
test_endpoint "Property projection (property 1, stabilized)" \
    "POST" "$BASE/portfolio/properties/1/projection" \
    '{"stabilized_annual_revenue":360000,"stabilized_operating_expenses":108000,"projection_years":10}' "200"

test_endpoint "Property projection (property 3, with construction)" \
    "POST" "$BASE/portfolio/properties/3/projection" \
    '{"stabilized_annual_revenue":480000,"stabilized_operating_expenses":144000,"projection_years":10,"construction_start_year":2,"construction_duration_years":1,"lease_up_months":12,"interim_revenue":120000,"interim_expenses":60000,"carrying_cost_annual":45000}' "200"

# --- Refinance Scenarios ---
echo ""
echo "--- Refinance Scenarios ---"
test_endpoint "Create refinance scenario" \
    "POST" "$BASE/portfolio/properties/1/refinance-scenarios" \
    '{"label":"Test Refi","assumed_new_valuation":1500000,"new_ltv_percent":65,"new_interest_rate":4.5,"new_amortization_months":300}' "201"

test_endpoint "List refinance scenarios" \
    "GET" "$BASE/portfolio/properties/1/refinance-scenarios" "" "200"

# --- Sale Scenarios ---
echo ""
echo "--- Sale Scenarios ---"
test_endpoint "Create sale scenario" \
    "POST" "$BASE/portfolio/properties/1/sale-scenarios" \
    '{"label":"Test Sale","assumed_sale_price":2000000,"selling_costs_percent":5}' "201"

test_endpoint "List sale scenarios" \
    "GET" "$BASE/portfolio/properties/1/sale-scenarios" "" "200"

# --- Development Plan Comparison ---
echo ""
echo "--- Development Plan Comparison ---"
test_endpoint "Compare development plans for property 1" \
    "GET" "$BASE/portfolio/properties/1/plans/compare?plan_ids=1" "" "200"

# --- Funding Opportunities ---
echo ""
echo "--- Funding Opportunities ---"
test_endpoint "List funding opportunities" \
    "GET" "$BASE/operator/funding" "" "200"

test_endpoint "Create funding opportunity" \
    "POST" "$BASE/operator/funding" \
    '{"title":"Alberta Housing Grant 2026","funding_source":"Province of Alberta","amount":250000,"status":"draft","submission_deadline":"2026-06-30"}' "201"

test_endpoint "Update funding opportunity (partial)" \
    "PATCH" "$BASE/operator/funding/1" \
    '{"status":"submitted"}' "200"

# --- Unit Turnovers ---
echo ""
echo "--- Unit Turnovers ---"
test_endpoint "List unit turnovers" \
    "GET" "$BASE/operator/turnovers" "" "200"

test_endpoint "Create unit turnover" \
    "POST" "$BASE/operator/turnovers" \
    '{"unit_id":1,"move_out_date":"2026-04-01","target_ready_date":"2026-04-15","status":"scheduled"}' "201"

# --- Arrears Records ---
echo ""
echo "--- Arrears Records ---"
test_endpoint "List arrears records" \
    "GET" "$BASE/operator/arrears" "" "200"

test_endpoint "Create arrears record" \
    "POST" "$BASE/operator/arrears" \
    '{"resident_id":1,"amount_overdue":1200,"due_date":"2026-02-01","days_overdue":40,"aging_bucket":"30-60"}' "201"

# --- LP Roll-up & Management Pack ---
echo ""
echo "--- LP Roll-up & Management Pack ---"
test_endpoint "Fund performance report (LP roll-up)" \
    "GET" "$BASE/reports/fund-performance" "" "200"

test_endpoint "Management pack report" \
    "GET" "$BASE/reports/management-pack" "" "200"

# --- Existing Endpoints (Regression) ---
echo ""
echo "--- Existing Endpoints (Regression) ---"
test_endpoint "Portfolio returns metrics" \
    "GET" "$BASE/portfolio/metrics/returns" "" "200"

test_endpoint "Lifecycle transitions" \
    "GET" "$BASE/lifecycle/properties/1/transitions" "" "200"

test_endpoint "Notifications list" \
    "GET" "$BASE/notifications" "" "200"

test_endpoint "Documents list" \
    "GET" "$BASE/documents" "" "200"

# --- Summary ---
echo ""
echo "============================================"
echo "  RESULTS: $PASS passed, $FAIL failed"
echo "============================================"
if [ $FAIL -gt 0 ]; then
    echo -e "  Failures:$ERRORS"
fi
