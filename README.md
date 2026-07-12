# cointraq

A personal expense tracker for one person in India. It is a private ledger of
cash, bank, and credit-card money so you can see what you actually have, what
you spent this cycle, and what you still owe — without a shared household or
multi-user app.

## Stack

Next.js (App Router, v16) · TypeScript · Tailwind v4 · Drizzle ORM · Postgres
(local via `node-postgres`) · Zod · Recharts · date-fns · next-themes · jose ·
bcryptjs · Vitest.

## Local setup

1. **Install deps**

   ```bash
   npm install
   ```

2. **Postgres** — create a local database:

   ```bash
   createdb cointraq
   ```

   Copy env and point `DATABASE_URL` at it:

   ```bash
   cp .env.example .env
   # edit .env: DATABASE_URL=postgres://localhost:5432/cointraq
   ```

3. **Auth** — generate a password hash and a session secret, put them in `.env`:

   ```bash
   npm run hash-password -- 'your-password'   # prints APP_PASSWORD_HASH (base64, paste as-is)
   openssl rand -base64 48                     # SESSION_SECRET
   ```

   > The hash is printed base64-encoded on purpose: Next.js runs dotenv-expand
   > over `.env`, which would mangle the `$` characters in a raw bcrypt hash.
   > Base64 has no `$`, so you paste it verbatim and the app decodes it at login.

4. **Schema + seed**

   ```bash
   npm run db:push     # or: db:generate && db:migrate
   npm run db:seed     # 4 accounts, 6 methods, 6 categories (SPEC §3)
   ```

5. **Run**

   ```bash
   npm run dev
   ```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Vitest unit tests for `lib/` (cycle math, balances, hero formula, INR) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:push` | Push schema to the DB (dev) |
| `npm run db:generate` / `db:migrate` | SQL migration workflow |
| `npm run db:seed` | Seed initial data (idempotent) |
| `npm run hash-password -- 'pw'` | Print a bcrypt hash for `APP_PASSWORD_HASH` |

## Code layout (SPEC §13)

- `src/db/` — Drizzle schema, client (pg driver), seed, read queries
- `src/lib/` — pure domain logic (framework-free): `money`, `dates`, `cycle`,
  `balances`, `aggregations`, `statement`, `txn-rules`, `compute`, `constants`
- `src/actions/` — server actions (all mutations, Zod-validated)
- `src/app/` — routes (`(app)` group = authed shell; `/login`)
- `src/components/` — UI
- `src/proxy.ts` — route protection (Next 16 renamed middleware → proxy)

## Notes

- Money is whole rupees (`integer`), always positive; direction comes from the
  transaction type. All formatting goes through `formatINR`.
- Dates are plain `yyyy-MM-dd` strings; "today" is computed in `Asia/Kolkata`.
- Balances are derived per request — no running-balance column, no caches.
- Deployed target in SPEC is Neon on Vercel; local dev swaps to `node-postgres`.
  To deploy on Neon, set `DATABASE_URL` to the Neon string (the pg driver works
  with Neon's pooled connection) or switch `src/db/client.ts` to the Neon HTTP
  driver.
