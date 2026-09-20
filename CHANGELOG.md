# Changelog

Notable changes are recorded here for each tagged release.

## Unreleased

## 0.1.0 — 2026-09-20

Initial tagged release of cointraq, a self-hosted personal expense tracker for
one person using whole rupees and the Asia/Kolkata time zone.

### Included

- Password-protected access to a Postgres-backed ledger.
- Bank, cash, and credit-card accounts, payment methods, and categories.
- Expenses, income, transfers, withdrawals, credit-card spends, and bill payments.
- Balance reconciliation, budgets, recurring templates, and CSV import.
- Dashboard insights and date-range filtering.
- Database migrations and an optional dummy-data seed for testing.
- Setup documentation, contribution boundaries, and a security reporting policy.
- GitHub Actions checks for tests, types, migrations, and production builds.
- MIT license.

### Known limitations

- Single-user access; no separate users or household permissions.
- Amounts use whole rupees and dates use the Asia/Kolkata time zone.
- Existing React Hooks lint errors and two lint warnings remain in application
  code. Lint is not yet a CI gate; run `npm run lint` to inspect them.
- `npm audit` on 2026-09-20 reports 15 dependency vulnerabilities (7 moderate,
  7 high, 1 critical), including a critical advisory affecting Next.js. Dependency
  remediation remains outstanding before recommending internet-facing deployment.
- Maintenance is best effort, and external pull requests are not accepted.
