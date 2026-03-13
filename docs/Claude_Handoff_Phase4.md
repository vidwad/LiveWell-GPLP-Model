# LiveWell GPLP Platform: Phase 4 Handoff Document

## 1. Project Overview & Current State

The LiveWell GPLP Platform is an enterprise-scale application for managing General Partner / Limited Partner (GP/LP) real estate investments, specifically focused on purpose-built communities (RecoverWell, StudyWell, RetireWell).

**Tech Stack:**
- **Backend:** FastAPI, SQLAlchemy (SQLite for dev, PostgreSQL for prod), Pydantic, JWT Auth
- **Frontend:** Next.js 14 (App Router), React 18, Tailwind CSS, `@base-ui/react` (headless UI), React Query, Axios
- **Architecture:** Monorepo structure (`/backend` and `/livingwell-frontend`)

**Completed Phases (1-3):**
- **Phase 1:** Core LP-centric data models, role-based access control (RBAC), basic portfolio and community management.
- **Phase 2:** Investor dashboard, waterfall distribution engine, AI assistant integration.
- **Phase 3:** Property lifecycle workflow (stage transitions, milestones), operator layer (budgets, expenses), enhanced investor portal (quarterly reports, eTransfer tracking).

---

## 2. Phase 4 Priorities & Implementation Guide

This phase focuses on completing the enterprise feature set. Please implement these features in the following priority order.

### Priority 1: Document Management System
Enable secure document sharing between GPs and LPs (K-1s, subscription agreements, capital call notices).

**Backend Implementation:**
1. **Model Updates:** The `InvestorDocument` model exists in `app/db/models.py` (lines 743-754). It needs endpoints for CRUD operations.
2. **Storage Service:** Create `app/services/storage.py` to handle file uploads. For local dev, save to a local `/uploads` directory. Ensure the service is interface-based so it can be swapped for S3 in production.
3. **API Routes:** Create `app/routes/documents.py` with endpoints:
   - `POST /api/documents/upload` (accepts `UploadFile` and `investor_id`)
   - `GET /api/documents/investor/{investor_id}`
   - `GET /api/documents/{document_id}/download`
   - `PATCH /api/documents/{document_id}/viewed` (marks as read)

**Frontend Implementation:**
1. **API Client:** Add document endpoints to `src/lib/api.ts`.
2. **UI Components:** Create a `DocumentList` component with a data table showing document type, upload date, and a download button.
3. **Upload Modal:** Create a dialog using `@base-ui/react` for GP Admins to upload documents and assign them to specific investors.
4. **Integration:** Add the `DocumentList` to the Investor detail page (`/investors/[id]`) and the Investor Dashboard.

### Priority 2: Notification Engine
System-wide notifications for key events (stage transitions, distributions, new documents).

**Backend Implementation:**
1. **Model:** Create a `Notification` model in `models.py`:
   - Fields: `notification_id`, `user_id`, `title`, `message`, `type` (enum), `is_read`, `created_at`, `action_url`.
2. **Service:** Create `app/services/notifications.py` with a `create_notification` function.
3. **Event Hooks:** Integrate the notification service into existing workflows:
   - When a property stage changes (`app/services/lifecycle.py`)
   - When a quarterly report is published (`app/services/quarterly_reports.py`)
   - When an eTransfer is sent (`app/routes/lifecycle.py`)
4. **API Routes:** Add `GET /api/notifications` and `PATCH /api/notifications/{id}/read`.

**Frontend Implementation:**
1. **UI Component:** Add a notification bell icon to the `Sidebar` or a new top header.
2. **Dropdown:** Implement a popover showing recent unread notifications.
3. **State Management:** Use React Query to poll or fetch notifications on load.

### Priority 3: Role-Based Dashboard Views
Tailor the `/dashboard` experience based on the user's role.

**Implementation:**
1. **Current State:** The dashboard currently shows GP-level metrics.
2. **Refactoring `page.tsx`:** Modify `src/app/(dashboard)/dashboard/page.tsx` to render different sub-components based on `user.role`:
   - `GP_ADMIN` / `OPERATIONS_MANAGER`: Current portfolio-wide metrics.
   - `PROPERTY_MANAGER`: Focus on specific assigned properties, occupancy rates, and open maintenance requests.
   - `INVESTOR`: Redirect to or render the Investor Dashboard (capital deployed, distributions received, recent documents).
   - `RESIDENT`: Show rent payment status, active maintenance requests, and community announcements.

### Priority 4: Advanced Financial Modeling
Enhance the existing waterfall engine with IRR and equity multiple calculations.

**Backend Implementation:**
1. **Service Update:** Extend `app/services/calculations.py` or `app/services/modeling.py`.
2. **IRR Calculation:** Implement an XIRR function using `numpy-financial` (already in `requirements.txt`). It needs to take a series of cash flows (dates and amounts) from the `Holding` and `DistributionEvent` models.
3. **Equity Multiple:** Calculate Total Distributions / Total Invested Capital.
4. **API Endpoint:** Add `GET /api/portfolio/metrics/returns` to expose these calculations.

**Frontend Implementation:**
1. **UI Integration:** Add IRR and Equity Multiple KPI cards to the Portfolio and Investor dashboards.

---

## 3. Code Patterns & Conventions

When building these features, please adhere to the established patterns in the codebase:

### Backend (FastAPI)
- **Dependency Injection:** Always use `Depends(get_db)` for database sessions and `Depends(get_current_user)` for authentication.
- **Role Guards:** Use the decorators in `app/core/deps.py` (e.g., `require_gp_admin`, `require_gp_or_ops`) to protect routes.
- **Schemas:** Define strict Pydantic models in `app/schemas/` for all request and response bodies. Never return raw SQLAlchemy models directly from routes.
- **Services:** Keep business logic out of route handlers. Place complex logic in `app/services/`.

### Frontend (Next.js & React)
- **UI Library:** We use `@base-ui/react` for headless components, styled with Tailwind CSS. **Do not use Radix UI or shadcn/ui patterns** (e.g., `asChild` is not supported by Base UI).
- **Data Fetching:** Use `@tanstack/react-query` for all API calls. Create custom hooks in `src/hooks/` (e.g., `useDocuments`, `useNotifications`).
- **API Client:** All API calls must go through the configured Axios instance in `src/lib/api.ts`, which handles token injection and refresh logic.
- **Type Safety:** Ensure all API responses are typed using interfaces in `src/types/`.

---

## 4. Getting Started on Localhost

1. **Start the Backend:**
   ```bash
   cd backend
   source venv/bin/activate  # If using a virtual environment
   pip install -r requirements.txt
   python seed.py  # To ensure you have the latest Phase 3 data
   uvicorn app.main:app --reload
   ```

2. **Start the Frontend:**
   ```bash
   cd livingwell-frontend
   npm install
   npm run dev
   ```

3. **Testing Credentials:**
   - GP Admin: `admin@livewell.com` / `admin123`
   - Investor: `investor1@example.com` / `investor123`

Please begin with **Priority 1: Document Management System**. Let me know if you need any clarification on the existing architecture before writing code.
