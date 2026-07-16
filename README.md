# Pharmacy Sys API

Production-ready REST API for pharmacy management — inventory, purchases, POS/sales, accounting, clinical records, and operational reports.

Built with **Node.js 20+**, **Express**, **TypeScript**, **PostgreSQL**, and **Prisma ORM**. Business behavior is aligned with the Laravel pharmacy reference; architecture follows MVC + service layer + repository pattern.

**Primary market:** Egypt (EGP, `Africa/Cairo`, Arabic). **Secondary:** Saudi Arabia (SAR, `Asia/Riyadh`).

---

## Features

| Domain | Capabilities |
|--------|----------------|
| **Auth** | JWT login, refresh rotation, logout, forgot/reset password, profile |
| **RBAC** | Users, roles, permissions (Laravel `PermissionSeeder` names) |
| **Settings** | Shop profile, currency/tax/locale/timezone, invoice numbering, SMTP |
| **Catalog** | Medicines, categories, types, units, leaves, vendors, barcodes |
| **Parties** | Customers, suppliers, vendors, due tracking, payments |
| **Purchases** | Draft cart, commit, batches, supplier due, ledger |
| **Stock** | Batch lots, expiry, low/out/expiring reports |
| **POS / Sales** | Cart, checkout, invoices, PDF, email, returns, full delete reversal |
| **Clinical** | Doctors, patients, lab tests, prescriptions |
| **Accounting** | Chart of accounts, manual JE, trial balance, balance sheet, income statement |
| **Expenses** | Categories, expenses with ledger sync |
| **Reports** | Customer dues, supplier payables, sale/purchase, profit/loss + Excel export |
| **Dashboard** | Shop-scoped KPI summary |
| **i18n** | Language catalog + JSON terms |
| **Notifications** | In-app inbox |

**API docs:** Swagger UI at `/api/docs` (173 operations).

---

## Requirements

- Node.js **20.x** or **22.x**
- PostgreSQL **14+**
- npm **9+**

---

## Installation

```bash
git clone https://github.com/codesolutioneg/pharmacy-sys-backend.git
cd pharmacy-sys-backend
cp .env.example .env
# Edit .env — set DATABASE_URL and JWT secrets
npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run db:qa-seed   # optional: Egyptian demo data + role-based users
npm run build
npm start
```

Development (watch mode):

```bash
npm run dev
```

---

## Environment variables

Copy `.env.example` to `.env`. Required variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Access token signing secret (≥ 32 chars) |
| `JWT_REFRESH_SECRET` | Refresh token signing secret (≥ 32 chars) |
| `SEED_ADMIN_EMAIL` | Admin email for `db:seed` |
| `SEED_ADMIN_PASSWORD` | Admin password for `db:seed` |

See `.env.example` for the full list including market, SMTP, and `QA_PASSWORD`.

Never commit `.env` to version control.

---

## Database setup

```bash
# Create database (example)
createdb pharmacy_sys

# Apply migrations
npx prisma migrate deploy

# Generate Prisma client (also runs on npm install postinstall if configured)
npx prisma generate
```

Docker Compose (optional local Postgres):

```bash
docker compose up -d
```

---

## Seed commands

| Command | Purpose |
|---------|---------|
| `npm run db:seed` | Permissions, admin role/user, default shop, accounts 1–4, base catalog |
| `npm run db:qa-seed` | Realistic Egyptian demo data + Owner/Manager/Pharmacist/Cashier/Store Keeper users |

Demo staff password is set by `QA_PASSWORD` in `.env` (default `Pharmacy@123` in `.env.example`).

---

## Build & run

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript → `dist/` |
| `npm start` | Run production server (`dist/server.js`) |
| `npm run dev` | Development with hot reload (`tsx watch`) |

---

## Testing

```bash
npm test              # All Jest tests (unit + integration)
npm run test:unit     # Unit tests only
npm run test:qa       # QA / OpenAPI coverage suite
npm run test:all      # Full suite (184 tests)
npm run qa:openapi    # Validate OpenAPI spec
```

---

## Swagger / OpenAPI

| Resource | URL (default `PORT=3010`) |
|----------|---------------------------|
| Swagger UI | http://localhost:3010/api/docs |
| OpenAPI JSON | http://localhost:3010/api/docs.json |
| Health | http://localhost:3010/api/health |

---

## Folder structure

```
backend/
├── prisma/
│   ├── schema.prisma      # Database schema
│   ├── migrations/        # SQL migrations
│   ├── seed.ts            # Base seed
│   └── qa-seed.ts         # Demo / QA seed
├── src/
│   ├── config/            # Env validation, permissions catalog
│   ├── controllers/       # HTTP layer
│   ├── services/          # Business logic
│   ├── routes/            # Express routers
│   ├── validators/        # Zod schemas
│   ├── middlewares/       # Auth, RBAC, errors
│   ├── utils/             # Money, tokens, logger, etc.
│   ├── app.ts             # Express app assembly
│   └── server.ts          # Bootstrap
├── tests/
│   ├── unit/
│   ├── integration/       # BP1–BP7
│   └── qa/                # SDLC QA suites
├── openapi/
│   └── openapi.yaml
├── scripts/
│   └── validate-openapi.ts
├── package.json
└── tsconfig.json
```

---

## Available scripts

| Script | Purpose |
|--------|---------|
| `dev` | Watch mode development server |
| `build` | TypeScript compile |
| `start` | Production server |
| `test` | Jest (all tests) |
| `test:unit` | Unit tests |
| `test:qa` | QA test suite |
| `test:all` | Full test suite |
| `lint` | ESLint (requires eslint in devDependencies) |
| `prisma:generate` | `prisma generate` |
| `prisma:migrate` | `prisma migrate dev` |
| `prisma:deploy` | `prisma migrate deploy` |
| `db:seed` | Base database seed |
| `db:qa-seed` | QA / demo seed |
| `qa:openapi` | Validate OpenAPI file |

---

## Demo accounts (after seed)

| Role | Email | Password source |
|------|-------|-----------------|
| Administrator | `admin@pharmacy.local` | `SEED_ADMIN_PASSWORD` in `.env` |
| Owner | `owner@alnoor.eg` | `QA_PASSWORD` (after `db:qa-seed`) |
| Pharmacist | `pharmacist@alnoor.eg` | `QA_PASSWORD` |
| Cashier | `cashier@alnoor.eg` | `QA_PASSWORD` |

Default values in `.env.example`: `Admin123!` (admin), `Pharmacy@123` (QA staff).

---

## Production deployment

See [RELEASE_SETUP.md](./RELEASE_SETUP.md) for production checklist, migration deploy, and environment hardening.

---

## License

Private — CodeSolution EG.
