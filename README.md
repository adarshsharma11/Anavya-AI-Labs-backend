# 🚀 Anvaya AI Labs Backend (Bun + Hono + PostgreSQL)

Production-ready SaaS backend for dynamic AI tool pricing and future Stripe integration.

Built using **Bun + Hono + Drizzle ORM + PostgreSQL**

---

# 🧱 Tech Stack

* Bun runtime (fast)
* Hono framework
* PostgreSQL
* Drizzle ORM
* TypeScript
* Versioned API (v1)

---

# 📦 Project Setup

## 1. Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
```

Verify:

```bash
bun --version
```

---

## 2. Install dependencies

Inside backend folder:

```bash
bun install
```

---

# 🗄 PostgreSQL Setup (Mac)

Start postgres:

```bash
brew services start postgresql@16
```

Open postgres:

```bash
psql postgres
```

Create DB + user:

```sql
CREATE USER anvayaailabs WITH PASSWORD 'password';
CREATE DATABASE anvaya_backend;
ALTER DATABASE anvaya_backend OWNER TO anvayaailabs;
GRANT ALL PRIVILEGES ON DATABASE anvaya_backend TO anvayaailabs;
\q
```

---

# 🔐 Environment Setup

Create `.env` in root:

```
PORT=3001
DATABASE_URL=postgresql://anvayaailabs:password@localhost:5432/anvaya_backend
```

---

# 🧬 Run Migrations

Generate schema:

```bash
bunx drizzle-kit generate
```

Push to database:

```bash
bunx drizzle-kit push
```

---

# 🌱 Seed Pricing Data

Seeds dynamic pricing plans into database.

Run:

```bash
bun run src/db/seed/pricing.seed.ts
```

---

# 🌱 Seed Services Data

Seeds AI services into database.

Run:

```bash
bun run src/db/seed/services.seed.ts
```

---

# ▶️ Start Server

```bash
bun run dev
```

Server:

```
http://localhost:3001
```

Health check:

```
GET /
```

---

# 🌍 API Endpoints (V1)

## Public Pricing

Fetch all plans:

```
GET /api/v1/public/pricing
```

Fetch single plan:

```
GET /api/v1/public/pricing/:id
```

Response includes:

* name
* price
* cadence
* features
* badge
* highlight
* discount

All pricing is dynamic from database.

---

# 📁 Project Structure

```
src/
 ├ api/v1/public/pricing.route.ts
 ├ modules/pricing/
 │   ├ pricing.controller.ts
 │   ├ pricing.service.ts
 │   ├ pricing.repository.ts
 │   └ pricing.types.ts
 │
 ├ db/
 │   ├ db.ts
 │   ├ schema/plan.ts
 │   └ seed/pricing.seed.ts
 │
 ├ app.ts
 └ server.ts
```

---

# 🧠 Developer Notes

* Prices stored in cents
* -1 scanLimit = unlimited
* Pricing fully dynamic
* Do NOT hardcode pricing in frontend
* Always run migrations after schema change
* Use seed script for initial pricing

---

# 🚀 Upcoming Backend Modules

Planned next:

* Stripe payment integration
* Subscription system
* Scan/report storage
* Usage tracking
* Admin dashboard APIs
* Auth system (JWT)

---

# 🏆 Production Tips

* Never commit `.env`
* Use strong DB password
* Use staging DB for testing
* Keep pricing in DB only
* Use versioned APIs `/api/v1`

---
