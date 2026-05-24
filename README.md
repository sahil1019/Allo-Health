# Allo Inventory – Take-Home Exercise

A Next.js inventory and order-fulfillment platform with race-condition-safe reservations across multiple warehouses.

## Live URL

> **[Deployed on Vercel →](https://allo-inventory.vercel.app)**  
> *(Seed data is pre-loaded — no setup required.)*

---

## Running Locally

### Prerequisites
- Node.js 18+
- A hosted PostgreSQL database (Supabase, Neon, or Railway — all have free tiers)
- A Redis instance (Upstash free tier works well)

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/allo-inventory.git
cd allo-inventory
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"
REDIS_URL="redis://default:PASSWORD@HOST:PORT"
CRON_SECRET="any-secret-string"
```

### 3. Run migrations and seed the database

```bash
npm run db:push    # Push the schema to your hosted DB
npm run db:seed    # Seed with 6 products, 3 warehouses, and stock levels
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## How Reservation Expiry Works in Production

### Mechanism: Vercel Cron + Lazy Cleanup

Two complementary strategies are used:

**1. Vercel Cron Job (active cleanup)**  
`vercel.json` schedules `GET /api/cron/expire-reservations` to run every minute. On each invocation it:
- Queries all `PENDING` reservations where `expiresAt < now()`
- Bulk-updates them to `RELEASED` in a single `$transaction`
- Decrements `stock.reserved` for each affected product/warehouse, grouped to minimize DB round trips
- The endpoint is protected by a `Bearer` token (`CRON_SECRET`) to prevent unauthorized calls

**2. Lazy Cleanup on Confirm (defensive)**  
When a client calls `POST /api/reservations/:id/confirm`, the handler checks `expiresAt` before confirming. If expired, it marks the reservation `RELEASED`, restores stock, and returns `410 Gone`. This ensures correctness even if the cron fires late.

This combination means stock is typically freed within 1 minute of expiry, with a hard correctness guarantee at confirm time regardless of cron reliability.

---

## Concurrency Correctness

The core race condition: two simultaneous requests for the last unit of a SKU.

### Approach: Distributed Lock (Redis `SET NX EX`)

When `POST /api/reservations` is called:

1. A **per-SKU+warehouse lock** is acquired via `SET lock:reserve:{productId}:{warehouseId} {token} NX EX 15`. Only one request proceeds at a time for that product/warehouse pair.
2. Inside the lock, we read `stock.reserved` and `stock.total`, compute `available`, and reject with `409` if insufficient.
3. If sufficient, a Prisma **transaction** atomically creates the `Reservation` row and increments `stock.reserved`.
4. The lock is released via a Lua compare-and-delete script, ensuring only the lock owner can release it.

**Why not just use a DB transaction with SELECT FOR UPDATE?**  
A `SELECT FOR UPDATE` in Postgres would also work and eliminate the Redis dependency. I chose Redis locking because:
- It's explicit and easy to reason about in a distributed/serverless environment
- It avoids holding a DB row lock open during any network latency between acquire and confirm
- It degrades gracefully: if Redis is unavailable, the endpoint returns `429` rather than silently double-booking

A Postgres advisory lock (`pg_advisory_xact_lock`) would be another valid approach.

---

## Idempotency (Bonus)

The `POST /api/reservations` and `POST /api/reservations/:id/confirm` endpoints support an `Idempotency-Key` request header.

**Implementation:**
- Before processing, we look up the key in the `idempotency_records` table.
- If found (and the key matches the same endpoint), we return the cached `statusCode` + `responseBody` immediately without any side effects.
- If not found, we process the request normally, then `upsert` the result into `idempotency_records`.
- Keys are scoped to endpoints — reusing the same key across different endpoints returns `422`.
- Storage is in Postgres (not Redis) so idempotency records survive server restarts and are consistent with the reservation data.

The frontend generates keys as `reserve-{productId}-{warehouseId}-{timestamp}` so normal flows never collide, but a network retry with the same key correctly deduplicates.

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/products` | List all products with per-warehouse stock |
| `GET` | `/api/warehouses` | List all warehouses |
| `POST` | `/api/reservations` | Create a reservation. Returns `409` if insufficient stock, `429` if lock contention |
| `GET` | `/api/reservations/:id` | Get reservation by ID |
| `POST` | `/api/reservations/:id/confirm` | Confirm reservation. Returns `410` if expired |
| `POST` | `/api/reservations/:id/release` | Release reservation early |
| `GET` | `/api/cron/expire-reservations` | Bulk-expire stale reservations (cron only) |

---

## Trade-offs and What I'd Do Differently

### What I'm happy with
- The lock + transaction pattern is correct and explainable
- Lazy cleanup at confirm time provides a hard safety net independent of cron reliability
- Idempotency is stored durably in Postgres alongside the reservation data
- The schema cleanly separates `total` (physical units) from `reserved` (held units): `available = total - reserved`

### What I'd improve with more time

**Auth**: There's no user identity — reservations aren't tied to a session. In production, `userId` would be on every reservation row, and the confirm/release endpoints would verify ownership.

**Optimistic UI**: The product listing doesn't re-fetch stock after a reservation succeeds. A real app would either update the client cache locally or use Server-Sent Events/WebSockets to push stock updates to all connected clients.

**Lock timeout edge case**: If the Node process crashes between acquiring the lock and releasing it, the lock expires after 15s. This is acceptable for a reservation flow but means a 15s window where that SKU appears unavailable. Postgres `SELECT FOR UPDATE SKIP LOCKED` would avoid this.

**Test coverage**: The concurrency logic deserves integration tests — ideally firing 50 simultaneous requests at the last unit and asserting exactly 49 `409`s. I'd use Vitest + a local Postgres + Fakeredis for this.

**Redis fallback**: If Redis is down, reservations currently return `429`. A production system might fall back to Postgres row-level locking (`SELECT FOR UPDATE`) in that case.

**Reservation TTL as config**: The 10-minute window is hardcoded. It should be configurable per product category or checkout flow type.

---

## Stack

- **Next.js 15** (App Router, React 19)
- **TypeScript** end-to-end
- **Prisma** ORM with hosted **PostgreSQL** (Neon/Supabase)
- **Redis** (Upstash) for distributed locking
- **Zod** for request validation
- **Vercel** for hosting + cron

---

## Git History

Commits are structured to show the progression:
1. Schema design + Prisma setup
2. API routes (products, warehouses, reservations)
3. Concurrency: Redis locking
4. Expiry: cron + lazy cleanup
5. Frontend: product listing + reservation page
6. Bonus: idempotency
7. Seed data + README
