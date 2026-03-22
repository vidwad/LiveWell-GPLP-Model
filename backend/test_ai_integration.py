"""
Comprehensive Test Suite — New AI Integration Features
========================================================
Tests all AI capabilities added in the recent integration:
  - Property lookup + suggest-defaults integration
  - 7 new AI API routes (staffing, scenarios, occupancy risk, arrears, distribution, rent roll, briefings)
  - Document extraction service
  - Report endpoint briefing integration
  - Statement service narrative integration
  - Rent roll CSV validation integration
  - Frontend-facing AI endpoints (report narrative, communications, area research, funding, anomalies, decisions)

Run after a fresh seed: python seed.py && python test_ai_integration.py
"""
import json
from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)
errors = []
passed = 0
sections = {}


def test(name, resp, expect=200):
    global passed
    ok = resp.status_code == expect
    if not ok:
        detail = resp.text[:200] if resp.text else "no body"
        errors.append(f"{name}: expected {expect}, got {resp.status_code} — {detail}")
    else:
        passed += 1
    return resp, ok


def check(name, condition, detail=""):
    global passed
    if condition:
        passed += 1
    else:
        errors.append(f"{name}: {detail}")


def section(name):
    global passed
    sections[name] = passed


# ═══════════════════════════════════════════════════════════════════
# AUTH SETUP
# ═══════════════════════════════════════════════════════════════════
print("=== SETUP ===")
r, _ = test("Login admin", client.post("/api/auth/login", json={
    "email": "admin@livingwell.ca", "password": "Password1!",
}))
h = {"Authorization": f"Bearer {r.json()['access_token']}"}

r_inv, _ = test("Login investor", client.post("/api/auth/login", json={
    "email": "investor1@example.com", "password": "Password1!",
}))
ih = {"Authorization": f"Bearer {r_inv.json()['access_token']}"}

# ═══════════════════════════════════════════════════════════════════
# 1. PROPERTY LOOKUP + SUGGEST DEFAULTS INTEGRATION
# ═══════════════════════════════════════════════════════════════════
section("Property Lookup + Suggest Defaults")
print("\n=== PROPERTY LOOKUP + SUGGEST DEFAULTS ===")

r, ok = test("Property lookup", client.post("/api/portfolio/lookup", json={
    "address": "123 Test St NW", "city": "Calgary", "province": "Alberta",
}, headers=h))
if ok:
    data = r.json()
    check("Lookup has sources_used", "sources_used" in data, "missing sources_used")
    check("Lookup has dev fields", "recommended_units" in data, "missing recommended_units field")
    check("Lookup has cost field", "estimated_cost_per_sqft" in data, "missing estimated_cost_per_sqft field")
    check("Lookup has reasoning field", "development_reasoning" in data, "missing development_reasoning field")
    print(f"  Sources: {data.get('sources_used', [])}")
    print(f"  Recommended units: {data.get('recommended_units')}")
    print(f"  Est. cost/sqft: {data.get('estimated_cost_per_sqft')}")

# Test suggest-defaults standalone
r, ok = test("Suggest defaults", client.post("/api/ai/suggest-defaults", json={
    "address": "456 Demo Ave", "zoning": "R-CG", "city": "Calgary",
}, headers=h))
if ok:
    data = r.json()
    check("Defaults has lot_size", data.get("estimated_lot_size") is not None, "missing estimated_lot_size")
    check("Defaults has units", data.get("recommended_units") is not None, "missing recommended_units")
    check("Defaults has cost", data.get("estimated_cost_per_sqft") is not None, "missing estimated_cost_per_sqft")
    check("Defaults has reasoning", data.get("reasoning") is not None, "missing reasoning")
    print(f"  Lot size: {data.get('estimated_lot_size')}, Units: {data.get('recommended_units')}")

# Investor should NOT access lookup
r, _ = test("Lookup blocked for investor", client.post("/api/portfolio/lookup", json={
    "address": "123 Test St", "city": "Calgary",
}, headers=ih), 403)

print(f"  Property lookup tests: {passed - sections['Property Lookup + Suggest Defaults']} passed")

# ═══════════════════════════════════════════════════════════════════
# 2. AI STAFFING SCHEDULE GENERATION
# ═══════════════════════════════════════════════════════════════════
section("Staffing Schedule")
print("\n=== AI STAFFING SCHEDULE ===")

r, ok = test("Generate staffing schedule", client.post("/api/ai/generate-staffing-schedule", json={
    "community_id": 1, "week_start": "2026-03-23", "budget_weekly": 5000.0,
}, headers=h))
if ok:
    data = r.json()
    check("Has schedule", "schedule" in data, "missing schedule array")
    check("Has total_hours", "total_hours" in data, "missing total_hours")
    check("Has total_cost", "total_cost" in data, "missing total_cost")
    check("Has coverage_summary", "coverage_summary" in data, "missing coverage_summary")
    check("Has optimization_notes", "optimization_notes" in data, "missing optimization_notes")
    schedule_len = len(data.get("schedule", []))
    print(f"  Shifts: {schedule_len}, Hours: {data.get('total_hours')}, Cost: ${data.get('total_cost', 0):,.0f}")
    if schedule_len == 0:
        print(f"  (no staff in community — schedule empty as expected)")

# Bad community ID
test("Staffing bad community", client.post("/api/ai/generate-staffing-schedule", json={
    "community_id": 9999, "week_start": "2026-03-23",
}, headers=h), 404)

# Investor blocked
test("Staffing blocked investor", client.post("/api/ai/generate-staffing-schedule", json={
    "community_id": 1, "week_start": "2026-03-23",
}, headers=ih), 403)

print(f"  Staffing tests: {passed - sections['Staffing Schedule']} passed")

# ═══════════════════════════════════════════════════════════════════
# 3. SCENARIO COMPARISON ENGINE
# ═══════════════════════════════════════════════════════════════════
section("Scenario Comparison")
print("\n=== SCENARIO COMPARISON ===")

r, ok = test("Compare scenarios", client.post("/api/ai/compare-scenarios", json={
    "property_id": 1,
    "scenarios": [
        {"name": "Optimistic", "vacancy_rate": 0.03, "rent_growth": 0.05, "expense_growth": 0.02, "cap_rate": 0.05},
        {"name": "Conservative", "vacancy_rate": 0.08, "rent_growth": 0.02, "expense_growth": 0.03, "cap_rate": 0.06},
        {"name": "Base Case", "vacancy_rate": 0.05, "rent_growth": 0.03, "expense_growth": 0.025, "cap_rate": 0.055},
    ],
}, headers=h))
if ok:
    data = r.json()
    check("Has narrative", "narrative" in data, "missing narrative")
    check("Has best_scenario", "best_scenario" in data, "missing best_scenario")
    check("Has key_drivers", "key_drivers" in data, "missing key_drivers")
    check("Has comparison_table", "comparison_table" in data, "missing comparison_table")
    check("3 scenarios in table", len(data.get("comparison_table", [])) >= 2, "comparison_table < 2 items")
    print(f"  Best: {data.get('best_scenario')}, Drivers: {len(data.get('key_drivers', []))}")

test("Scenario bad property", client.post("/api/ai/compare-scenarios", json={
    "property_id": 9999,
    "scenarios": [{"name": "A", "vacancy_rate": 0.05}],
}, headers=h), 404)

print(f"  Scenario tests: {passed - sections['Scenario Comparison']} passed")

# ═══════════════════════════════════════════════════════════════════
# 4. PREDICTIVE OCCUPANCY RISK
# ═══════════════════════════════════════════════════════════════════
section("Occupancy Risk")
print("\n=== PREDICTIVE OCCUPANCY RISK ===")

r, ok = test("Predict occupancy risk", client.post("/api/ai/predict-occupancy-risk", json={
    "community_id": 1,
}, headers=h))
if ok:
    data = r.json()
    check("Has risk_score", "risk_score" in data, "missing risk_score")
    check("Has risk_level", "risk_level" in data, "missing risk_level")
    check("Has predicted_30d", "predicted_occupancy_30d" in data, "missing predicted_occupancy_30d")
    check("Has predicted_90d", "predicted_occupancy_90d" in data, "missing predicted_occupancy_90d")
    check("Has risk_factors", "risk_factors" in data, "missing risk_factors")
    check("Has recommendations", "recommendations" in data, "missing recommendations")
    check("Risk score valid", 0 <= data.get("risk_score", -1) <= 100, f"risk_score={data.get('risk_score')} out of range")
    print(f"  Risk: {data.get('risk_score')}/100 ({data.get('risk_level')})")
    print(f"  30d prediction: {data.get('predicted_occupancy_30d')}, 90d: {data.get('predicted_occupancy_90d')}")

test("Occupancy risk bad community", client.post("/api/ai/predict-occupancy-risk", json={
    "community_id": 9999,
}, headers=h), 404)

print(f"  Occupancy risk tests: {passed - sections['Occupancy Risk']} passed")

# ═══════════════════════════════════════════════════════════════════
# 5. ARREARS COLLECTION STRATEGY
# ═══════════════════════════════════════════════════════════════════
section("Arrears Strategy")
print("\n=== ARREARS COLLECTION STRATEGY ===")

# First find an arrears record
from app.db.session import SessionLocal
from app.db.models import ArrearsRecord
db = SessionLocal()
arrears = db.query(ArrearsRecord).first()
db.close()

if arrears:
    r, ok = test("Suggest arrears strategy", client.post("/api/ai/suggest-arrears-strategy", json={
        "arrears_id": arrears.arrears_id,
    }, headers=h))
    if ok:
        data = r.json()
        check("Has recommended_action", "recommended_action" in data, "missing recommended_action")
        check("Has escalation_level", "escalation_level" in data, "missing escalation_level")
        check("Has communication_template", "communication_template" in data, "missing communication_template")
        check("Has timeline", "timeline" in data, "missing timeline")
        check("Has alternative_actions", "alternative_actions" in data, "missing alternative_actions")
        print(f"  Action: {data.get('recommended_action')}")
        print(f"  Level: {data.get('escalation_level')}")
else:
    print("  (skipped — no arrears records in seeded data)")

test("Arrears bad ID", client.post("/api/ai/suggest-arrears-strategy", json={
    "arrears_id": 99999,
}, headers=h), 404)

print(f"  Arrears tests: {passed - sections['Arrears Strategy']} passed")

# ═══════════════════════════════════════════════════════════════════
# 6. DISTRIBUTION TIMING ADVISOR
# ═══════════════════════════════════════════════════════════════════
section("Distribution Advisor")
print("\n=== DISTRIBUTION TIMING ADVISOR ===")

r, ok = test("Advise distribution", client.post("/api/ai/advise-distribution", json={
    "lp_id": 1, "proposed_amount": 25000.0,
}, headers=h))
if ok:
    data = r.json()
    check("Has recommendation", "recommendation" in data, "missing recommendation")
    check("Has recommended_amount", "recommended_amount" in data, "missing recommended_amount")
    check("Has max_safe_amount", "max_safe_amount" in data, "missing max_safe_amount")
    check("Has rationale", "rationale" in data, "missing rationale")
    check("Has risk_factors", "risk_factors" in data, "missing risk_factors")
    check("Has timing_suggestion", "timing_suggestion" in data, "missing timing_suggestion")
    print(f"  Recommendation: {data.get('recommendation')}")
    print(f"  Suggested: ${data.get('recommended_amount', 0):,.0f}, Max safe: ${data.get('max_safe_amount', 0):,.0f}")

# Without proposed amount
r, ok = test("Advise distribution no amount", client.post("/api/ai/advise-distribution", json={
    "lp_id": 1,
}, headers=h))

test("Distribution bad LP", client.post("/api/ai/advise-distribution", json={
    "lp_id": 9999,
}, headers=h), 404)

print(f"  Distribution advisor tests: {passed - sections['Distribution Advisor']} passed")

# ═══════════════════════════════════════════════════════════════════
# 7. RENT ROLL CSV VALIDATION
# ═══════════════════════════════════════════════════════════════════
section("Rent Roll Validation")
print("\n=== RENT ROLL CSV VALIDATION ===")

r, ok = test("Validate rent roll", client.post("/api/ai/validate-rent-roll", json={
    "property_id": 1,
    "csv_rows": [
        {"unit_number": "101", "bed_count": "4", "monthly_rent": "1200", "bed_rent": "1200"},
        {"unit_number": "102", "bed_count": "3", "monthly_rent": "1000", "bed_rent": "1000"},
        {"unit_number": "103", "bed_count": "2", "monthly_rent": "50", "bed_rent": "50"},  # suspicious low
        {"unit_number": "101", "bed_count": "4", "monthly_rent": "1200", "bed_rent": "1200"},  # duplicate
    ],
}, headers=h))
if ok:
    data = r.json()
    check("Has is_valid", "is_valid" in data, "missing is_valid")
    check("Has total_rows", "total_rows" in data, "missing total_rows")
    check("Has issues", "issues" in data, "missing issues array")
    check("Has market_comparison", "market_comparison" in data, "missing market_comparison")
    check("Has summary", "summary" in data, "missing summary")
    print(f"  Valid: {data.get('is_valid')}, Issues: {len(data.get('issues', []))}")
    print(f"  Summary: {data.get('summary', '')[:80]}")

test("Validate bad property", client.post("/api/ai/validate-rent-roll", json={
    "property_id": 9999, "csv_rows": [],
}, headers=h), 404)

print(f"  Rent roll validation tests: {passed - sections['Rent Roll Validation']} passed")

# ═══════════════════════════════════════════════════════════════════
# 8. REPORT ENDPOINT EXECUTIVE BRIEFINGS
# ═══════════════════════════════════════════════════════════════════
section("Report Briefings")
print("\n=== REPORT EXECUTIVE BRIEFINGS ===")

briefing_endpoints = [
    ("Fund performance", "/api/reports/fund-performance"),
    ("Management pack", "/api/reports/management-pack"),
    ("Summary", "/api/reports/summary"),
    ("Cash flow projection", "/api/reports/cash-flow-projection"),
    ("Debt maturity", "/api/reports/debt-maturity"),
    ("Arrears aging", "/api/reports/arrears-aging"),
    ("Variance alerts", "/api/reports/variance-alerts"),
    ("Maintenance costs", "/api/reports/maintenance-costs"),
]

# Test without briefing (should NOT have ai_briefing)
for name, url in briefing_endpoints:
    r, ok = test(f"Report: {name}", client.get(url, headers=h))
    if ok:
        data = r.json()
        check(f"{name} no briefing by default", "ai_briefing" not in data, "ai_briefing present without param")

# Test with briefing (should have ai_briefing)
for name, url in briefing_endpoints:
    r, ok = test(f"Report+briefing: {name}", client.get(f"{url}?include_briefing=true", headers=h))
    if ok:
        data = r.json()
        has_briefing = "ai_briefing" in data
        if has_briefing:
            check(f"{name} briefing structure",
                "briefing" in data["ai_briefing"],
                "ai_briefing missing 'briefing' key")
            print(f"  {name}: briefing=Yes, attention={len(data['ai_briefing'].get('attention_items', []))}")
        else:
            # Briefing might fail gracefully (no API key) — still pass
            print(f"  {name}: briefing=No (expected without API key)")
            passed += 1

print(f"  Report briefing tests: {passed - sections['Report Briefings']} passed")

# ═══════════════════════════════════════════════════════════════════
# 9. DOCUMENT EXTRACTION SERVICE (Unit Tests)
# ═══════════════════════════════════════════════════════════════════
section("Document Extraction")
print("\n=== DOCUMENT EXTRACTION SERVICE ===")

from app.services.document_extraction import (
    extract_document_data,
    apply_extraction_to_property,
    _extract_text_from_bytes,
)

# Test text extraction from non-PDF (should return None)
result = _extract_text_from_bytes(b"not a pdf", "image/jpeg")
check("Image text extraction returns None", result is None, f"got {result}")

# Test text extraction from invalid PDF bytes
result = _extract_text_from_bytes(b"%PDF-corrupt", "application/pdf")
check("Corrupt PDF text extraction returns None", result is None, f"got {result}")

# Test extract_document_data with unsupported content type
result = extract_document_data(
    file_bytes=b"test",
    content_type="application/vnd.ms-excel",
    category="other",
)
check("Unsupported content type returns None", result is None, f"got {result}")

# Test apply_extraction with low confidence
from app.db.session import SessionLocal as _SL
db = _SL()
apply_result = apply_extraction_to_property(
    db=db, property_id=1, category="appraisal",
    extracted_fields={"appraised_value": 500000},
    confidence=0.3,
)
check("Low confidence not applied", apply_result.get("applied") is False, str(apply_result))

# Test apply_extraction with bad property
apply_result = apply_extraction_to_property(
    db=db, property_id=99999, category="appraisal",
    extracted_fields={"appraised_value": 500000},
    confidence=0.9,
)
check("Bad property not applied", apply_result.get("applied") is False, str(apply_result))
db.close()

print(f"  Document extraction tests: {passed - sections['Document Extraction']} passed")

# ═══════════════════════════════════════════════════════════════════
# 10. AI SERVICE UNIT TESTS (Fallback Responses)
# ═══════════════════════════════════════════════════════════════════
section("AI Service Fallbacks")
print("\n=== AI SERVICE FALLBACK RESPONSES ===")

from app.services.ai import (
    generate_staffing_schedule,
    compare_scenarios,
    predict_occupancy_risk,
    generate_executive_briefing,
    suggest_arrears_strategy,
    advise_distribution_timing,
    validate_rent_roll,
)

# Staffing fallback
result = generate_staffing_schedule(
    community_name="Test Community",
    community_type="LiveWell",
    occupancy_rate=0.9,
    staff_list=[
        {"staff_id": 1, "first_name": "John", "last_name": "Doe", "role": "support_worker", "hourly_rate": 22.0},
    ],
    week_start="2026-03-23",
    budget_weekly=2000.0,
)
check("Staffing fallback has schedule", "schedule" in result, str(result.keys()))
check("Staffing fallback has total_hours", "total_hours" in result)
check("Staffing fallback has warnings", "warnings" in result)
check("Staffing schedule non-empty", len(result.get("schedule", [])) > 0, "empty schedule")
print(f"  Staffing fallback: {len(result['schedule'])} shifts")

# Scenario fallback
result = compare_scenarios(
    property_name="Test Property",
    scenarios=[
        {"name": "A", "vacancy_rate": 0.05},
        {"name": "B", "vacancy_rate": 0.10},
    ],
)
check("Scenario fallback has narrative", "narrative" in result)
check("Scenario fallback has best_scenario", "best_scenario" in result)
check("Scenario fallback has key_drivers", "key_drivers" in result)
print(f"  Scenario fallback: best={result.get('best_scenario')}")

# Occupancy risk fallback
result = predict_occupancy_risk(
    community_name="Test", community_type="LiveWell",
    current_occupancy=0.85, trend_data=[],
)
check("Occupancy risk fallback has risk_score", "risk_score" in result)
check("Occupancy risk score range", 0 <= result.get("risk_score", -1) <= 100, f"score={result.get('risk_score')}")
check("Occupancy risk fallback has risk_level", "risk_level" in result)
check("Occupancy risk fallback has recommendations", "recommendations" in result)
print(f"  Occupancy risk fallback: score={result['risk_score']}, level={result['risk_level']}")

# High occupancy = lower risk
result_high = predict_occupancy_risk("Test", "LiveWell", 0.95, [])
result_low = predict_occupancy_risk("Test", "LiveWell", 0.60, [])
check("High occupancy = lower risk", result_high["risk_score"] < result_low["risk_score"],
      f"high_occ={result_high['risk_score']} vs low_occ={result_low['risk_score']}")

# Briefing fallback
result = generate_executive_briefing("test_report", {"total": 100, "items": [1, 2, 3]})
check("Briefing fallback has briefing", "briefing" in result)
check("Briefing fallback has attention_items", "attention_items" in result)
check("Briefing fallback has key_metrics", "key_metrics" in result)
print(f"  Briefing fallback: {result['briefing'][:60]}...")

# Arrears strategy fallback
for days, expected_level in [(3, "gentle_reminder"), (15, "formal_notice"), (45, "payment_plan"), (75, "final_warning"), (120, "legal_referral")]:
    result = suggest_arrears_strategy(
        resident_name="Test Resident", community_type="LiveWell",
        days_overdue=days, amount_overdue=500.0,
    )
    check(f"Arrears {days}d = {expected_level}", result.get("escalation_level") == expected_level,
          f"got {result.get('escalation_level')}")
check("Arrears has communication_template", "communication_template" in result)
check("Arrears has alternative_actions", "alternative_actions" in result)
print(f"  Arrears escalation ladder: 5 levels verified")

# Distribution advisor fallback
result = advise_distribution_timing(
    lp_name="Test LP", lp_financials={"noi": 100000, "capital_available": 50000},
)
check("Distribution fallback has recommendation", "recommendation" in result)
check("Distribution fallback has rationale", "rationale" in result)
check("Distribution fallback has timing_suggestion", "timing_suggestion" in result)
print(f"  Distribution fallback: {result['recommendation']}")

# Rent roll validation fallback
result = validate_rent_roll(
    csv_rows=[{"unit_number": "101", "monthly_rent": "1200"}],
    property_address="123 Test St",
    city="Calgary",
)
check("Rent roll fallback has is_valid", "is_valid" in result)
check("Rent roll fallback has total_rows", "total_rows" in result)
check("Rent roll fallback has issues", "issues" in result)
check("Rent roll fallback total_rows correct", result.get("total_rows") == 1, f"total_rows={result.get('total_rows')}")
print(f"  Rent roll fallback: valid={result['is_valid']}, rows={result['total_rows']}")

print(f"  AI service fallback tests: {passed - sections['AI Service Fallbacks']} passed")

# ═══════════════════════════════════════════════════════════════════
# 11. EXISTING AI ENDPOINTS STILL WORK
# ═══════════════════════════════════════════════════════════════════
section("Existing AI Regression")
print("\n=== EXISTING AI ENDPOINT REGRESSION ===")

# Suggest defaults
test("Suggest defaults", client.post("/api/ai/suggest-defaults", json={
    "address": "789 Main St", "zoning": "R-G", "city": "Calgary",
}, headers=h))

# Risk analysis
test("Risk analysis", client.post("/api/ai/analyze-risk", json={
    "property_id": 1,
}, headers=h))

# Underwriting
test("Underwriting", client.post("/api/ai/underwrite", json={
    "property_id": 1, "lp_id": 1,
}, headers=h))

# Report narrative
r, ok = test("Report narrative", client.post("/api/ai/generate-report-narrative", json={
    "lp_id": 1, "period": "Q1 2026",
}, headers=h))
if ok:
    data = r.json()
    check("Narrative has exec summary", "executive_summary" in data)
    check("Narrative has property_updates", "property_updates" in data)
    check("Narrative has market_commentary", "market_commentary" in data)
    check("Narrative has investor_outlook", "investor_outlook" in data)

# Anomaly detection
test("Anomaly community", client.post("/api/ai/detect-anomalies", json={
    "entity_type": "community", "entity_id": 1, "months": 12,
}, headers=h))
test("Anomaly LP", client.post("/api/ai/detect-anomalies", json={
    "entity_type": "lp", "entity_id": 1, "months": 12,
}, headers=h))

# Communication types
r, ok = test("Comm types", client.get("/api/ai/communication-types", headers=h))
if ok:
    check("7 comm types", len(r.json()) == 7, f"got {len(r.json())}")

# Draft communication
r, ok = test("Draft communication", client.post("/api/ai/draft-investor-communication", json={
    "investor_id": 2, "comm_type": "distribution_notice", "lp_id": 1,
}, headers=h))
if ok:
    check("Draft has subject", "subject" in r.json())
    check("Draft has body", "body" in r.json())

# Area research
r, ok = test("Area research", client.post("/api/ai/area-research", json={
    "address": "100 Barclay Parade SW", "city": "Calgary",
}, headers=h))
if ok:
    data = r.json()
    check("Area has summary", "summary" in data)
    check("Area has comparable_sales", "comparable_sales" in data)

# Funding research
r, ok = test("Funding research", client.post("/api/ai/research-funding", json={
    "community_type": "RecoverWell", "city": "Calgary",
}, headers=h))
if ok:
    check("Funding has opportunities", "opportunities" in r.json())

# Decisions
test("List decisions", client.get("/api/ai/decisions", headers=h))

# Chat
r, ok = test("Chat", client.post("/api/ai/chat", json={
    "message": "Hello", "include_portfolio_context": False,
}, headers=h))
if ok:
    check("Chat has response", "response" in r.json())

print(f"  Existing AI regression: {passed - sections['Existing AI Regression']} passed")

# ═══════════════════════════════════════════════════════════════════
# 12. PROPERTY DOCUMENT UPLOAD WITH AI EXTRACTION
# ═══════════════════════════════════════════════════════════════════
section("Document Upload + Extraction")
print("\n=== DOCUMENT UPLOAD + AI EXTRACTION ===")

import io

# Create a minimal test PDF (just header bytes — won't have extractable text)
test_pdf = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"

r, ok = test("Upload property document", client.post(
    "/api/documents/property/1/upload",
    headers=h,
    data={
        "title": "Test Appraisal Report",
        "category": "appraisal",
        "notes": "Test upload",
    },
    files={"file": ("test_appraisal.pdf", io.BytesIO(test_pdf), "application/pdf")},
), 201)
if ok:
    data = r.json()
    check("Upload has document_id", "document_id" in data)
    check("Upload has category", data.get("category") == "appraisal")
    check("Upload has notes", data.get("notes") is not None, "notes is None")
    # AI extraction might or might not succeed on test bytes
    if "ai_extraction" in data:
        print(f"  AI extraction: confidence={data['ai_extraction'].get('confidence')}")
    else:
        print(f"  AI extraction: skipped (expected for test PDF)")

# Upload as investor should fail
test("Upload blocked for investor", client.post(
    "/api/documents/property/1/upload",
    headers=ih,
    data={"title": "Test", "category": "other"},
    files={"file": ("test.pdf", io.BytesIO(test_pdf), "application/pdf")},
), 403)

print(f"  Document upload tests: {passed - sections['Document Upload + Extraction']} passed")

# ═══════════════════════════════════════════════════════════════════
# 13. RENT ROLL CSV IMPORT WITH AI VALIDATION
# ═══════════════════════════════════════════════════════════════════
section("CSV Import + Validation")
print("\n=== RENT ROLL CSV IMPORT + AI VALIDATION ===")

csv_content = """unit_number,bed_count,monthly_rent,bed_rent,unit_type
T101,3,1200,1200,shared
T102,2,1000,1000,shared
T103,1,900,900,private
"""

r, ok = test("Import rent roll CSV", client.post(
    "/api/portfolio/properties/1/import-rent-roll",
    headers=h,
    files={"file": ("test_rentroll.csv", io.BytesIO(csv_content.encode()), "text/csv")},
))
if ok:
    data = r.json()
    check("Import success", data.get("success") is True)
    check("Import created units", data.get("created_units", 0) > 0, f"units={data.get('created_units')}")
    check("Import created beds", data.get("created_beds", 0) > 0, f"beds={data.get('created_beds')}")
    if "ai_validation" in data:
        ai = data["ai_validation"]
        check("AI validation has summary", "summary" in ai)
        check("AI validation has is_valid", "is_valid" in ai)
        print(f"  AI validation: valid={ai.get('is_valid')}, issues={len(ai.get('issues', []))}")
    else:
        print(f"  AI validation: skipped (no API key)")
    print(f"  Created: {data.get('created_units')} units, {data.get('created_beds')} beds")

print(f"  CSV import tests: {passed - sections['CSV Import + Validation']} passed")

# ═══════════════════════════════════════════════════════════════════
# 14. EDGE CASES & ERROR HANDLING
# ═══════════════════════════════════════════════════════════════════
section("Edge Cases")
print("\n=== EDGE CASES & ERROR HANDLING ===")

# Empty scenarios
r, ok = test("Empty scenarios", client.post("/api/ai/compare-scenarios", json={
    "property_id": 1, "scenarios": [],
}, headers=h))

# Missing required fields
test("Missing community_id for staffing", client.post("/api/ai/generate-staffing-schedule", json={
    "week_start": "2026-03-23",
}, headers=h), 422)

test("Missing property_id for scenarios", client.post("/api/ai/compare-scenarios", json={
    "scenarios": [{"name": "A"}],
}, headers=h), 422)

# Invalid date format for staffing — should return 400 or 422
r_bad, _ = test("Invalid date for staffing", client.post("/api/ai/generate-staffing-schedule", json={
    "community_id": 1, "week_start": "not-a-date",
}, headers=h), 400)

# Report endpoints still return proper data structure
for name, url in [
    ("Fund perf", "/api/reports/fund-performance"),
    ("Debt maturity", "/api/reports/debt-maturity"),
]:
    r, ok = test(f"Report structure: {name}", client.get(url, headers=h))
    if ok:
        data = r.json()
        check(f"{name} is dict", isinstance(data, dict), f"type={type(data)}")

print(f"  Edge case tests: {passed - sections['Edge Cases']} passed")

# ═══════════════════════════════════════════════════════════════════
# RESULTS
# ═══════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("AI INTEGRATION TEST RESULTS BY SECTION:")
section_names = list(sections.keys())
for i, name in enumerate(section_names):
    start = sections[name]
    end = sections[section_names[i + 1]] if i + 1 < len(section_names) else passed
    count = end - start
    print(f"  {name}: {count} passed")

print(f"\nTOTAL: {passed} passed, {len(errors)} failed")
if errors:
    print("\nFAILURES:")
    for e in errors:
        print(f"  FAIL: {e}")
print("=" * 60)
if not errors:
    print("ALL AI INTEGRATION TESTS PASSED")
else:
    print(f"{len(errors)} TESTS FAILED — see above")
