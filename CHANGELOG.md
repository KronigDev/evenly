# Changelog

All notable changes to Evenly are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] — 2026-06-29

### Changed

- **Upgraded the entire stack to the latest stable majors:** Next.js 16, React 19.2, TypeScript 6,
  Tailwind CSS v4, Prisma 7, next-intl 4, zod 4, Vitest 4, Motion 12 (replacing framer-motion),
  nodemailer 9, tailwind-merge 3, plus latest `@types/*`. Base images bumped to **Node 24** and
  **PostgreSQL 18**.
- **Prisma 7** now uses the **node-postgres driver adapter** (`@prisma/adapter-pg` + `pg`): the
  connection URL moved out of the schema into `prisma.config.ts`, and the client is constructed with
  an adapter (`src/lib/db.ts`).
- **Tailwind v4**: PostCSS now uses `@tailwindcss/postcss`; `globals.css` imports Tailwind v4 and
  bridges the existing token theme via `@config`.
- **ESLint** migrated to flat config (`eslint.config.mjs`) using `eslint-config-next` 16's native
  flat configs; `next lint` (removed in Next 16) replaced by `eslint .`.
- **Motion**: imports switched from `framer-motion` to `motion/react` (the renamed package).

### Removed

- **Dropped Mailpit and Adminer** from the dev stack — it is now just **app + PostgreSQL**. With no
  SMTP configured (dev default), outgoing emails and their links are printed to the app logs instead
  of being sent.

### Notes

- ESLint is pinned to the latest **9.x** (not 10): `eslint-config-next` 16's bundled
  `eslint-plugin-react` does not yet support ESLint 10.

### Verified

- `pnpm typecheck` / `pnpm lint` / `pnpm format:check` clean · 40 Vitest unit tests pass ·
  `pnpm build` clean · `docker compose up` brings up app + PostgreSQL 18 and serves.

## [1.0.0] — 2026-06-29

Initial release. A complete, production-ready, dockerized Splitwise-style expense-sharing app.

### Added

- **Groups & members** — create / edit / archive / delete groups (emoji, color, description),
  admin / member roles, remove & leave, and 1:1 "friend" balances without a group.
- **Invites by email + link** — invited people appear instantly as an "Invited" placeholder member
  and can be included in expenses before they have an account. A designed invitation email carries a
  secure, expiring token; plus "Copy link", "Share via WhatsApp" and native Web Share. Accepting
  merges the placeholder into the real account and preserves all balances. Existing-member, expired,
  already-accepted and duplicate invites are handled cleanly (email is case-insensitive).
- **Expenses** — one or multiple payers; split **equally, by exact amounts, percentages,
  shares/weights, +/- adjustments, or itemized**; categories with icons, notes, receipt/photo
  attachments, comments, recurring expenses (daily/weekly/monthly), and multi-currency with
  conversion (base currency per group, default per user). Search & filter by category, person,
  date range and text.
- **Balances & settling** — "you owe" / "you are owed" totals overall, per group and per person;
  toggleable **debt simplification** (minimum transfers); manual settlements including partial
  amounts with full history; reminders by email + in-app.
- **Overview & insights** — dashboard summary, activity feed, in-app + optional email notifications,
  statistics & charts (over time, by category, by person), and per-group **CSV + PDF** export.
- **Account** — profile (name, avatar, default currency, language, theme, notification
  preferences), secure password change, account deletion; light / dark / auto theme with full
  parity; full **German + English** i18n; installable **PWA** with offline fallback.
- **Money correctness** — all amounts are integer minor units; the split engine apportions with the
  largest-remainder method so splits always sum to the total exactly; the debt engine computes
  net balances, exact pairwise debts and a minimum-transfer plan — all property-tested.
- **Security** — custom auth (argon2 password hashing, DB-backed httpOnly sessions, magic-link /
  email-verification / password-reset tokens), double-submit CSRF, rate limiting, and per-group
  authorization on every data access.
- **Tooling & infrastructure** — Next.js 15 + React 19 + TypeScript (strict); Prisma + PostgreSQL;
  multi-stage `Dockerfile`; `docker-compose.yml` (dev: app + Postgres + Mailpit) and
  `docker-compose.prod.yml` (production: app + Postgres); a Windows `dev.bat` control menu; Vitest
  unit tests + Playwright E2E; GitHub Actions CI (lint/typecheck/test/build) and a self-hosted
  Auto-Deploy workflow; a complete README with a Debian 13 production deployment guide.

### Verified

- `pnpm typecheck` → 0 errors · `pnpm lint` → clean · `pnpm format:check` → clean.
- 40 unit tests pass (incl. a 200-iteration property test reconciling pairwise debts with net
  balances) · Playwright happy-path E2E passes.
- `pnpm build` clean · `docker compose up` brings up the full stack (migrate + seed + serve) · email
  delivery verified against Mailpit.

[1.1.0]: https://github.com/KronigDev/evenly/releases/tag/v1.1.0
[1.0.0]: https://github.com/KronigDev/evenly/releases/tag/v1.0.0
