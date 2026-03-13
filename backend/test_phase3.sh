#!/bin/bash
# Phase 3 API Endpoint Test Suite
set -e

BASE="http://localhost:8000"
TOKEN=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@livingwell.ca","password":"Password1!"}' | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
AUTH="Authorization: Bearer $TOKEN"
CT="Content-Type: application/json"

PASS=0
FAIL=0

test_endpoint() {
  local desc="$1"
  local method="$2"
  local url="$3"
  local data="$4"
  local expected_code="$5"

  if [ "$method" = "GET" ]; then
    RESP=$(curl -s -o /tmp/resp.json -w "%{http_code}" -X GET "$BASE$url" -H "$AUTH")
  elif [ "$method" = "POST" ]; then
    RESP=$(curl -s -o /tmp/resp.json -w "%{http_code}" -X POST "$BASE$url" -H "$AUTH" -H "$CT" -d "$data")
  elif [ "$method" = "PATCH" ]; then
    RESP=$(curl -s -o /tmp/resp.json -w "%{http_code}" -X PATCH "$BASE$url" -H "$AUTH" -H "$CT" -d "$data")
  elif [ "$method" = "DELETE" ]; then
    RESP=$(curl -s -o /tmp/resp.json -w "%{http_code}" -X DELETE "$BASE$url" -H "$AUTH")
  fi

  if [ "$RESP" = "$expected_code" ]; then
    echo "  ✓ $desc (HTTP $RESP)"
    PASS=$((PASS+1))
  else
    echo "  ✗ $desc (expected $expected_code, got $RESP)"
    cat /tmp/resp.json | python -m json.tool 2>/dev/null || cat /tmp/resp.json
    echo
    FAIL=$((FAIL+1))
  fi
}

echo "============================================"
echo "  Phase 3 API Test Suite"
echo "============================================"
echo

# --- Stage Transitions ---
echo "--- Property Lifecycle: Stage Transitions ---"
test_endpoint "List transitions for prop1" GET "/api/lifecycle/properties/1/transitions" "" "200"
test_endpoint "Get allowed transitions for prop4 (acquisition)" GET "/api/lifecycle/properties/4/allowed-transitions" "" "200"
test_endpoint "Transition prop5 prospect→acquisition (should fail validation)" POST "/api/lifecycle/properties/5/transition" '{"to_stage":"acquisition","notes":"Test transition"}' "422"
test_endpoint "Transition prop5 prospect→acquisition (force)" POST "/api/lifecycle/properties/5/transition" '{"to_stage":"acquisition","notes":"Forced by GP Admin","force":true}' "200"
echo

# --- Milestones ---
echo "--- Property Lifecycle: Milestones ---"
test_endpoint "List milestones for prop1" GET "/api/lifecycle/properties/1/milestones" "" "200"
test_endpoint "List milestones for prop2 (construction)" GET "/api/lifecycle/properties/2/milestones?stage=construction" "" "200"
test_endpoint "Create custom milestone for prop1" POST "/api/lifecycle/properties/1/milestones" '{"title":"Q1 2026 investor update","description":"Prepare quarterly update","target_date":"2026-03-31","stage":"stabilized","sort_order":5}' "201"
test_endpoint "Update milestone status" PATCH "/api/lifecycle/milestones/3" '{"status":"completed","actual_date":"2026-01-10"}' "200"
echo

# --- Quarterly Reports ---
echo "--- Enhanced Investor Portal: Quarterly Reports ---"
test_endpoint "List quarterly reports for LP1" GET "/api/lifecycle/lp/1/quarterly-reports" "" "200"
test_endpoint "Generate Q1 2026 report for LP1" POST "/api/lifecycle/lp/1/quarterly-reports" '{"quarter":1,"year":2026}' "201"
test_endpoint "Duplicate Q4 2025 report (should fail)" POST "/api/lifecycle/lp/1/quarterly-reports" '{"quarter":4,"year":2025}' "400"
test_endpoint "Update report status to published" PATCH "/api/lifecycle/quarterly-reports/2" '{"status":"published","market_commentary":"Strong Q1 outlook."}' "200"
echo

# --- eTransfer Tracking ---
echo "--- Enhanced Investor Portal: eTransfer Tracking ---"
test_endpoint "List all eTransfers" GET "/api/lifecycle/etransfers" "" "200"
test_endpoint "Create eTransfer for alloc2" POST "/api/lifecycle/etransfers" '{"allocation_id":2,"recipient_email":"investor2@example.com","amount":26315.79,"security_question":"Fund name?"}' "201"
test_endpoint "Duplicate eTransfer (should fail)" POST "/api/lifecycle/etransfers" '{"allocation_id":2,"recipient_email":"investor2@example.com","amount":26315.79}' "400"
test_endpoint "Update eTransfer to sent" PATCH "/api/lifecycle/etransfers/3" '{"status":"sent","reference_number":"ET-2026-001"}' "200"
test_endpoint "Filter eTransfers by status" GET "/api/lifecycle/etransfers?status_filter=sent" "" "200"
echo

# --- Message Threads ---
echo "--- Enhanced Investor Portal: Message Threads ---"
test_endpoint "List replies for message 1" GET "/api/lifecycle/messages/1/replies" "" "200"
test_endpoint "Create reply to message 2" POST "/api/lifecycle/messages/2/replies" '{"body":"Thank you for the update on the distribution."}' "201"
echo

# --- Operator Budgets ---
echo "--- Operator Layer: Budgets ---"
test_endpoint "List all budgets" GET "/api/operator/budgets" "" "200"
test_endpoint "List budgets for community 1" GET "/api/operator/budgets?community_id=1" "" "200"
test_endpoint "Create Q1 2026 budget" POST "/api/operator/budgets" '{"operator_id":1,"community_id":1,"period_type":"quarterly","period_label":"Q1 2026","year":2026,"quarter":1,"budgeted_revenue":57600,"budgeted_expenses":17280,"budgeted_noi":40320}' "201"
test_endpoint "Update budget with actuals" PATCH "/api/operator/budgets/2" '{"actual_revenue":56000,"actual_expenses":17100,"actual_noi":38900}' "200"
echo

# --- Operating Expenses ---
echo "--- Operator Layer: Operating Expenses ---"
test_endpoint "List all expenses" GET "/api/operator/expenses" "" "200"
test_endpoint "List expenses for community 1, Oct 2025" GET "/api/operator/expenses?community_id=1&year=2025&month=10" "" "200"
test_endpoint "Create new expense" POST "/api/operator/expenses" '{"community_id":1,"category":"technology","description":"WiFi service - January 2026","amount":189.00,"expense_date":"2026-01-15","period_month":1,"period_year":2026,"vendor":"Shaw Communications","is_recurring":true}' "201"
test_endpoint "Update expense" PATCH "/api/operator/expenses/1" '{"amount":1950.00,"notes":"Adjusted for rate increase"}' "200"
echo

# --- Expense Summary ---
echo "--- Operator Layer: Expense Summary ---"
test_endpoint "Expense summary for community 1, Q4 2025" GET "/api/operator/communities/1/expense-summary?year=2025&quarter=4" "" "200"
test_endpoint "Expense summary for community 1, full year 2025" GET "/api/operator/communities/1/expense-summary?year=2025" "" "200"
echo

echo "============================================"
echo "  Results: $PASS passed, $FAIL failed"
echo "============================================"
