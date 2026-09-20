# cointraq

A personal expense tracker for one person in India. It is a private ledger of
cash, bank, and credit-card money so you can see what you actually have, what
you spent this cycle, and what you still owe — without a shared household or
multi-user app.

## Stack

Next.js (App Router, v16) · TypeScript · Tailwind v4 · Drizzle ORM · Postgres
(local via `node-postgres`) · Zod · Recharts · date-fns · next-themes · jose ·
bcryptjs · Vitest.

## Requirements

- Node.js 24 and npm (the runtime used by CI).
- PostgreSQL 17 (the database version used by CI), running locally or hosted.
- A database you can create and migrate. Local setup below uses the Postgres
  `createdb` command; a hosted provider can create the database for you.

## Local setup

1. **Install deps**

   ```bash
   npm ci
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

4. **Create the schema using the committed migrations**

   ```bash
   npm run db:migrate
   ```

   For actual use, creating the database and running migrations is all the
   database setup you need. **Do not run the seed command for your real ledger.**
   Migrations create the schema without sample accounts or transactions.
   `db:generate` is only needed when developing schema changes; `db:push` is a
   development shortcut, not the normal installation or upgrade path.

5. **Run**

   ```bash
   npm run dev
   ```

Open http://localhost:3000 and sign in with the password you chose. For a fresh
ledger, visit **Settings** to create your own accounts with their opening
balances, payment methods, and categories before logging transactions. The
first-run dashboard can be skipped while you configure these in Settings.

## Optional dummy data for testing

The seed is **only for testing or exploring the app with dummy data**. It creates
4 sample accounts, 6 payment methods, 6 categories, sample opening balances, and
roughly two months of transactions. It is not required to use the actual app.

Use a separate disposable database, point `DATABASE_URL` at it, and run:

```bash
npm run db:migrate
npm run db:seed
```

The seed skips insertion if any accounts already exist; it does not reset an
existing ledger. Keep dummy data separate from your real financial records.

## Production and updates

Configure the same environment variables on your host, use HTTPS, and run:

```bash
npm ci
npm run db:migrate
npm run build
npm start
```

Back up your database before applying migrations when upgrading. Never run
`db:seed` against your real database. See [SECURITY.md](SECURITY.md) for deployment
and private vulnerability reporting guidance.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Vitest unit tests for `lib/` (cycle math, balances, hero formula, INR) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:push` | Push schema to the DB (dev) |
| `npm run db:generate` / `db:migrate` | SQL migration workflow |
| `npm run db:seed` | Optional dummy data for testing only; skips when accounts exist |
| `npm run hash-password -- 'pw'` | Print a bcrypt hash for `APP_PASSWORD_HASH` |

## Code layout

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
- Database access uses `node-postgres`; configure `DATABASE_URL` for your own
  Postgres instance.

## Issues and contributions

Bug reports and feature suggestions are welcome. Pull requests and external
patches are not accepted. You may fork and modify the project; see
[CONTRIBUTING.md](CONTRIBUTING.md) for the policy and reporting guidance.
