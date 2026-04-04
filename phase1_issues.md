# Phase 1 As-Is Seed — Issues Found

## Property ID: 11 (1847 Bowness Road NW)

### Issue 1: Bed creation requires `unit_id` in body (CRITICAL)
- The POST endpoint for beds requires `unit_id` in the request body, even though it's already in the URL path
- Only the first bed was created successfully (the rest failed with 422)
- **Fix**: Include `unit_id` in the bed creation payload

### Issue 2: Underwriting summary shows gross_potential_rent = 0 (CRITICAL)
- The underwriting summary is not picking up bed rents
- `gross_potential_rent: 0.00` even though beds exist with rents
- Root cause: beds were not created (see Issue 1), but also need to verify the rent calculation logic
- **Fix**: After fixing bed creation, verify the rent roll calculation

### Issue 3: Debt creation returns 405 Method Not Allowed (CRITICAL)
- POST to `/api/portfolio/properties/{id}/debt` returns 405
- Need to check the correct endpoint path for debt creation
- **Fix**: Find correct debt endpoint

### Issue 4: Pro forma endpoint returns 404
- GET `/api/portfolio/properties/{id}/proforma` returns 404
- Need to check if this endpoint exists or has a different path

### Issue 5: Management fee calculated on wrong EGI
- Management fee of $411.08 = 8% of $5,138.55 (ancillary only)
- Should be 8% of full EGI including bed revenue
- This will auto-correct once bed revenue is properly calculated

### Issue 6: Ancillary revenue rounding
- Storage: 3 × 67% × $75 × 12 = $1,809.00 ✓
- Total ancillary: $5,409.00 ✓ (matches expected)

### Status: NEEDS FIXES before proceeding
