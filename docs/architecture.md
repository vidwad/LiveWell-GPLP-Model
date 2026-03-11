# Living Well Communities Platform Architecture

## 1. Core System Layers

- Core Platform (backend monolith, microservices later): portfolio properties, development planning, financial projections, investor relations, reporting.
- Community Apps: RecoverWell, StudyWell, RetireWell. Connect via shared REST API / GraphQL with tenant scoping.
- Investor Portal: LP investor UI for documents, reports, ownership, distributions.
- AI Decision Layer: OpenAI-integrated services for modeling validation, scenario analysis, market intelligence, compliance guidance.

## 2. Recommended stack

- Backend: Python 3.11+, FastAPI
- DB: PostgreSQL
- ORM: SQLAlchemy + Alembic
- Auth: JWT + role-based permissions
- Frontend: React + Next.js
- Mobile: React Native
- Cloud: AWS (ECS/EKS/RDS/S3), Vercel for frontend
- AI: OpenAI API with history store for conversations

## 3. Security and RBAC

- Roles: GP_ADMIN, OPERATIONS_MANAGER, PROPERTY_MANAGER, INVESTOR, RESIDENT
- Permissions in middleware/ dependency injection.

## 4. Phase 1 MVP

- Property/project data model
- Development modeling engine module
- Investor BI/API + portal open endpoints
- RecoverWell community app backend endpoints
- AI decision support skeleton
