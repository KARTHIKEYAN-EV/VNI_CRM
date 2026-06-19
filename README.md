# VNI CRM — Phase 1

Comp Copy Tracking System for Vijay Nicole Imprints, Chennai.

---

## Deployed link

| Service  | URL                          |
|----------|------------------------------|
| Frontend | https://vni-crm.netlify.app/      |
| API docs | https://vni-crm.onrender.com/api/docs |
| Database | https://supabase.com/   |

---

## Quick Start (Docker — recommended)

```bash
# 1. Clone and enter the project
cd vni-crm

# 2. Start all services (DB + backend + frontend)
docker compose up --build

# 3. Seed the admin user (first time only)
docker compose exec backend python seed.py
```


---

## Manual Setup (without Docker)

**Prerequisites:** Python 3.12, Node 20, PostgreSQL 16

### Database
```bash
createdb vni_crm
psql vni_crm < db/schema.sql
psql vni_crm < db/seed.sql
```

### Backend
```bash
cd backend
cp .env.example .env          # fill in JWT_SECRET_KEY
pip install -r requirements.txt
python seed.py                 # creates admin user
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Project Structure

```
vni-crm/
├── db/
│   ├── schema.sql          # Full PostgreSQL schema (all M_, T_, H_, P_ tables)
│   └── seed.sql            # P_ table seed data (app config + rejection reasons)
├── backend/
│   ├── app/
│   │   ├── main.py         # FastAPI app + CORS + router registration
│   │   ├── config.py       # Settings (pydantic-settings, reads .env)
│   │   ├── database.py     # SQLAlchemy engine + get_db dependency
│   │   ├── models/         # SQLAlchemy ORM models (M_, T_, H_, P_)
│   │   ├── schemas/        # Pydantic request/response schemas (camelCase output)
│   │   ├── routers/        # FastAPI routers (auth; more added per phase)
│   │   ├── auth/           # JWT handler + role-based dependency guards
│   │   └── utils/          # audit.py — log_status_change helper
│   ├── seed.py             # Bootstrap admin user + P_ defaults
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/client.js   # Axios instance + token injection + 401 handler
│   │   ├── auth/           # AuthContext (session state) + ProtectedRoute
│   │   ├── pages/          # Login, Dashboard (Phase A stubs)
│   │   └── components/     # Layout (sidebar + topbar)
│   ├── index.html
│   ├── vite.config.js      # Dev proxy: /api → localhost:8000
│   └── tailwind.config.js  # VNI brand tokens (brand-red, brand-navy)
└── docker-compose.yml
```

---

## Key Design Decisions (from Project Constitution)

| Rule | Implementation |
|------|---------------|
| No hard deletes | `is_active` flag on every table; never call DELETE |
| Audit trail | Every status change → `h_request_audit` via `utils/audit.py` |
| Append-only H_ tables | DB trigger raises error on UPDATE/DELETE |
| camelCase API | Pydantic `alias_generator=to_camel`; FastAPI serialises automatically |
| Role-based access | JWT embeds role; `require_roles()` factory in `auth/dependencies.py` |
| CEO approves | `approved_by` enforced at app layer to be role=ceo only |
| On-the-fly additions | `data_quality_flag=PENDING_REVIEW`; never auto-merged |
| Fuzzy search | `pg_trgm` extension + GIN indexes on college/faculty/book name fields |

---

## API Endpoints (Phase A)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/login` | None | Get JWT token |
| GET  | `/api/v1/auth/me` | Bearer | Current user profile |
| POST | `/api/v1/auth/change-password` | Bearer | Change own password |
| GET  | `/api/health` | None | Health check |

Full interactive docs at `/api/docs` (Swagger UI).

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://vni:vni@localhost:5432/vni_crm` | PostgreSQL connection string |
| `JWT_SECRET_KEY` | *(must set)* | Token signing secret — use `secrets.token_hex(32)` |
| `JWT_ALGORITHM` | `HS256` | JWT algorithm |
| `JWT_EXPIRE_MINUTES` | `480` | Token lifetime (8 hours) |
| `DEBUG` | `false` | SQLAlchemy echo + FastAPI debug mode |

---

## Phase Roadmap

| Phase | Scope |
|-------|-------|
| **A** ✅ | Schema, scaffolding, JWT auth, seed data |
| B | Master data CRUD — regions, colleges, faculty, books |
| C | Academic hierarchy — courses, subjects, syllabi |
| D | Comp request form (Rep mode) |
| E | Approval & fulfilment workflow |
| F | Faculty tokenised form (no-login link) |
| G | Follow-up reminders & notifications |
| H | MIS reports & CSV export |
| I | Admin panel & data quality tools |
