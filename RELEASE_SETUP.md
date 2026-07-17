# Release Setup Guide

Pharmacy Sys API — installation, local development, and production deployment.

---

## 1. Local setup

### Prerequisites

- Node.js 20.x or 22.x
- PostgreSQL 14+ running locally
- Git

### Steps

```bash
git clone https://github.com/codesolutioneg/pharmacy-sys-backend.git
cd pharmacy-sys-backend
cp .env.example .env
```

Edit `.env`:

1. Set `DATABASE_URL` to your local Postgres instance.
2. Set `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` to random strings (≥ 32 characters).
3. Optionally change `SEED_ADMIN_*` and `QA_PASSWORD`.

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run db:qa-seed    # optional demo data
npm run build
npm run dev           # or: npm start
```

Verify:

- `GET http://localhost:3010/api/health` → `{ "success": true, "data": { "status": "ok" } }`
- `GET http://localhost:3010/api/docs` → Swagger UI
- `POST http://localhost:3010/api/v1/auth/login` with seed admin credentials

### Docker Postgres (optional)

```bash
docker compose up -d
# Update DATABASE_URL in .env to match docker-compose.yml
```

---

## 2. Database initialization

### First-time setup

```bash
createdb pharmacy_sys
npx prisma migrate deploy
npm run db:seed
```

### Reset (development only — destroys data)

```bash
npx prisma migrate reset
# Re-runs migrations and seed.ts
```

### QA / demo dataset

```bash
npm run db:qa-seed
```

Creates Egyptian pharmacy demo data, role-based users (`owner@alnoor.eg`, etc.), and a second shop for isolation tests.

---

## 3. Production setup

### Environment

| Variable | Production guidance |
|----------|---------------------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Managed Postgres URL with SSL |
| `JWT_ACCESS_SECRET` | Cryptographically random, ≥ 32 chars, unique per environment |
| `JWT_REFRESH_SECRET` | Different from access secret |
| `CORS_ORIGINS` | Your frontend origin(s) only |
| `LOG_LEVEL` | `info` or `warn` |
| `BCRYPT_ROUNDS` | `12` recommended for production |
| `SMTP_*` | Real SMTP for invoice email |

Never use default JWT secrets or seed passwords in production.

### Build & run

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
NODE_ENV=production node dist/server.js
```

Use a process manager (PM2, systemd, Docker, or your platform's native runner).

### Example PM2

```bash
pm2 start dist/server.js --name pharmacy-api
pm2 save
```

### Health check

Configure your load balancer or orchestrator to probe:

```
GET /api/health
```

Expected: HTTP 200, `success: true`.

---

## 4. Deployment steps (checklist)

1. **Provision** PostgreSQL database (dedicated user, least privilege).
2. **Set secrets** in your secrets manager or platform env (never in git).
3. **Clone** repository on the server or build in CI.
4. **Install:** `npm ci --omit=dev` (production) or `npm ci` + `npm run build`.
5. **Migrate:** `npx prisma migrate deploy`.
6. **Seed once:** `npm run db:seed` (first deploy only; use admin credentials from env).
7. **Start:** `npm start` or `node dist/server.js`.
8. **Verify:** health, login, one authenticated API call.
9. **Expose** HTTPS via reverse proxy (nginx, Caddy, cloud LB).
10. **Restrict** Postgres to application subnet only.

### CI/CD recommendations

```bash
npm ci
npm run build
npx prisma validate
npm run test:all
npx prisma migrate deploy
```

Run tests against a disposable test database (`DATABASE_URL` in CI).

---

## 4b. Deploying to Vercel

The repo includes `vercel.json` and `api/index.ts`, which wrap the Express app as a
serverless function. Two things are mandatory or the function crashes at startup
with `500 FUNCTION_INVOCATION_FAILED`:

1. **Environment variables** — the app validates its env on boot and throws if any
   required variable is missing. In the Vercel dashboard (Project → Settings →
   Environment Variables) set at minimum:

   | Variable | Notes |
   |----------|-------|
   | `DATABASE_URL` | Must point to a **hosted** PostgreSQL (Neon, Supabase, Railway, RDS...). `localhost` will not work from Vercel. |
   | `JWT_ACCESS_SECRET` | Random string, minimum 32 characters |
   | `JWT_REFRESH_SECRET` | Random string, minimum 32 characters |
   | `NODE_ENV` | `production` |
   | `CORS_ORIGINS` | Comma-separated allowed frontend origins |

   All other variables from `.env.example` are optional and have defaults.

2. **Database migrations + seed** — run once against the hosted database from your
   machine:

   ```bash
   DATABASE_URL="postgresql://...hosted-db..." npx prisma migrate deploy
   DATABASE_URL="postgresql://...hosted-db..." npm run db:seed
   ```

After redeploying, verify `https://<your-domain>/api/health` and open Swagger at
`https://<your-domain>/api/docs`.

> Note: Vercel functions are stateless and short-lived. For heavy report
> generation (PDF/Excel) or long-running workloads, a persistent Node host
> (Railway, Render, a VPS with PM2) is the better fit — see section 4 above.

---

## 5. Post-deploy verification

| Check | Command / URL |
|-------|----------------|
| Health | `curl https://your-api.example.com/api/health` |
| OpenAPI | `curl https://your-api.example.com/api/docs.json` |
| Auth | `POST /api/v1/auth/login` |
| DB | Application logs show no Prisma connection errors |

---

## 6. Troubleshooting

| Issue | Fix |
|-------|-----|
| `Invalid environment configuration` | Compare `.env` against `.env.example`; JWT secrets must be ≥ 32 chars |
| Prisma migrate fails | Ensure database exists and `DATABASE_URL` is correct |
| Port in use | Change `PORT` in `.env` |
| CORS errors | Add frontend origin to `CORS_ORIGINS` |
| 401 on all routes | Check JWT secrets match between restarts; re-login |

---

## 7. Security notes

- Rotate JWT secrets if compromised; all sessions invalidate.
- Use HTTPS in production.
- Do not run `db:qa-seed` in production unless intentional.
- Review `npm audit` periodically.
- Store SMTP credentials securely; consider secrets manager integration.
