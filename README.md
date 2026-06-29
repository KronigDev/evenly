# Evenly

A premium, **Splitwise-style expense-sharing app** for flatmates, trips, couples and friend groups.
Track shared spending, see exactly **who owes whom**, and settle up — fairly and to the cent. Evenly
runs entirely on its own stack (custom auth + API, **PostgreSQL via Prisma**), ships with full
**German / English** i18n and an installable **PWA**, and deliberately has **no payment-provider
integration**: settling a debt is recorded **manually** ("mark as paid"), like a shared notebook.

**Codebase size:** 177 source files · 20,224 lines (tracked `.ts` / `.tsx` / `.css` / `.mjs` /
`.prisma`; excludes `node_modules`, build artifacts and lockfiles). 63 UI components, 39 API route
handlers, 19 pages.

---

## Table of Contents

1. [Installation (Debian 13)](#installation-debian-13)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Features](#features)
5. [Production: Debian 13 Setup](#production-debian-13-setup)
6. [Environment Variables](#environment-variables)
7. [Updates & Maintenance](#updates--maintenance)
8. [Backups](#backups)
9. [Auto-Deploy (GitHub Actions, self-hosted runner)](#auto-deploy-github-actions-self-hosted-runner)
10. [Continuous Integration](#continuous-integration)
11. [Local Development](#local-development)
12. [Testing](#testing)

---

## Installation (Debian 13)

The quickest way to a running instance is **Docker Compose**. For a hardened production setup
(dedicated non-root `deploy` user, reverse proxy, TLS, auto-deploy), follow the full
[Production setup](#production-debian-13-setup) below; this quick start is the condensed version of it.

**Prerequisites:** Docker Engine + the Compose plugin (Debian 13 / _trixie_). If Docker is not
installed yet, see [Prerequisites in the production setup](#prerequisites--root). Evenly bundles its
own PostgreSQL — no external database is required.

**Run it**

This is a **private repo**, so `git clone` will ask for credentials: enter your GitHub **username**
and a **Personal Access Token** as the _password_ (GitHub → _Settings → Developer settings → Personal
access tokens_; _fine-grained_ with **Contents: Read** on this repo, or _classic_ with the `repo`
scope).

```bash
# 1) Install git and clone the repo into the app directory
#    (git prompts: username + token-as-password)
sudo apt-get update && sudo apt-get install -y git
sudo mkdir -p /opt/evenly && sudo chown "$USER" /opt/evenly
git clone https://github.com/KronigDev/evenly.git /opt/evenly
cd /opt/evenly

# 2) Create .env from the example and fill it in.
#    Required for production: a strong POSTGRES_PASSWORD and AUTH_SECRET, your public
#    APP_URL, and real SMTP settings. Keep RUN_SEED=false in production.
cp .env.example .env
nano .env
chmod 600 .env

# 3) Build and start the production stack (app + PostgreSQL, bound to localhost).
#    Database migrations run automatically on start.
docker compose -f docker-compose.prod.yml up -d --build
```

**After it finishes**

- The app listens on **`127.0.0.1:3000`** (the production compose binds to localhost). Point your
  domain / TLS terminator (nginx, Caddy, Cloudflare, …) at that port; this quick start does **not**
  set up TLS (see [Nginx reverse proxy](#nginx-reverse-proxy-tls) in the production setup).
- Database **migrations apply automatically** on container start (`prisma migrate deploy`). With
  `RUN_SEED=false` (the production default) **no demo data** is created.
- Set `APP_URL` to your real public URL so invite / magic-link emails contain working links, and
  configure a real **SMTP** provider (see [Environment Variables](#environment-variables)).
- Update later with [`./update.sh`](#updates--maintenance) or the
  [auto-deploy runner](#auto-deploy-github-actions-self-hosted-runner).

> Want full control over each step (dedicated `deploy` user, reverse proxy, TLS, self-hosted runner)?
> See **[Production: Debian 13 Setup](#production-debian-13-setup)** further down.

---

## Tech Stack

### App (`src/app`, `src/components`, `src/lib`)

- **Next.js 15** (App Router) + **React 19** + **TypeScript** (strict, `noUncheckedIndexedAccess`).
- **Tailwind CSS v3** with a CSS-variable token system tuned for equal light / dark parity.
- **Custom auth** — argon2 (`@node-rs/argon2`) password hashing, DB-backed httpOnly sessions,
  magic-link / email-verification / password-reset tokens, double-submit CSRF, rate limiting.
- **Prisma + PostgreSQL**, integer-cents money model; a pure, property-tested split + debt engine.
- **next-intl** cookie-based i18n (German + English), **TanStack Query**, **framer-motion**,
  **Phosphor** icons, self-hosted **Geist** fonts.
- **nodemailer** for email; **pdf-lib** for PDF export; installable **PWA** (manifest + service worker).

### Infrastructure

- **Docker** (multi-stage `Dockerfile`) running the built app + Prisma migrations on start.
- `docker-compose.yml` (development: app + PostgreSQL + **Mailpit** mail catcher) and
  `docker-compose.prod.yml` (production: app + PostgreSQL, localhost-bound).
- **GitHub Actions**: a CI workflow (lint / typecheck / test / build) and a self-hosted
  push-to-`main` Auto-Deploy workflow.

---

## Architecture

Evenly is a self-contained app: a Next.js front-end, its own API (Route Handlers), and a PostgreSQL
database. There is no third-party backend and no payment integration.

```
Next.js 15 (App Router, RSC) ── React 19 + Tailwind design system (light/dark tokens)
        │
        ├─ Route Handlers (/src/app/api/**) ── zod-validated, CSRF-protected, rate-limited
        │     └─ service layer (/src/lib): auth · invites · expenses · settlements · balances
        │            money/split/debt engine (integer cents, exact splits) · currency
        │     └─ Prisma ── PostgreSQL
        │
        ├─ Custom auth: argon2 hashing, DB-backed httpOnly sessions, magic-link / verify /
        │   reset tokens, double-submit CSRF, per-instance rate limiting
        ├─ Email: nodemailer → Mailpit (dev) / any SMTP (prod), localized templates
        ├─ i18n: next-intl, cookie-based locale (en/de), all strings externalized
        └─ PWA: manifest + service worker + offline fallback + install prompt
```

- **Money is never a float.** All amounts are integer minor units (cents). Balance math runs in each
  group's base currency: an expense total is converted to base once, then payments and splits are
  apportioned with the **largest-remainder method**, so a split always sums to the total exactly.
- **The debt engine** computes per-member net balances, exact pairwise "who owes whom" (a
  deterministic water-fill that preserves every member's balance to the cent) and a minimum-transfer
  **simplified** plan. Both views are property-tested.
- **Invites carry balances.** An invited email becomes a placeholder member immediately and can take
  part in expenses; on acceptance the placeholder is merged into the real account (re-pointing all
  payments / splits / settlements), so balances stay correct.
- **Authorization everywhere.** Every data access checks group membership / role, so users only ever
  see and modify data for groups they belong to — enforced server-side.

---

## Features

- **Groups & members** — create / edit / archive / delete groups (emoji, color, description); admin
  / member roles; remove & leave; plus **1:1 balances** without a group ("friends").
- **Invites (email + link)** — invite by email; the person appears immediately as an **"Invited"**
  placeholder and can be included in expenses before signing up. A designed invitation email with a
  secure, expiring link, plus **Copy link**, **Share via WhatsApp** and native **Web Share**.
  Accepting merges the placeholder into the real account and preserves all balances.
- **Expenses** — one or **multiple payers**; split **equally / exact / percentages / shares /
  +- adjustments / itemized**; categories with icons, notes, **receipt** attachments, **comments**,
  **recurring** expenses, and **multiple currencies** with conversion.
- **Balances & settling** — "you owe" / "you are owed" totals overall, per group and per person;
  toggleable **debt simplification**; manual settlements incl. **partial** amounts with history;
  **reminders** by email + in-app.
- **Overview & insights** — dashboard, **activity feed**, in-app + optional email notifications,
  **statistics & charts** (over time, by category, by person), and per-group **CSV + PDF** export.
- **Account** — profile (name, avatar, currency, language, theme, notifications), secure password
  change, account deletion. **Light / dark / auto** theme (system + manual), both equally polished.
- **i18n** — full **German + English**, switchable in-app, stored per user; all strings externalized.
- **PWA** — installable on iOS / Android / desktop with an offline fallback page.

---

## Production: Debian 13 Setup

> **Manual installation** — the full step-by-step version of the [Quick start](#installation-debian-13)
> at the top. Use this for a hardened setup: a dedicated `deploy` user, reverse proxy and TLS.

> **Run model:** system-level setup (packages, Docker) is done **as root**. Everything app-specific
> (cloning, configuration, building and running the containers) runs as a dedicated **non-root
> `deploy` user** — the same user the [Auto-Deploy runner](#auto-deploy-github-actions-self-hosted-runner)
> uses. Steps are tagged **[root]** / **[deploy]**: switch to the deploy user with `su - deploy`,
> back to root with `exit`. `deploy` has **no password** and never calls `sudo`.

### Prerequisites — [root]

```bash
# Update the system
apt update && apt upgrade -y

# Install dependencies
apt install -y git curl ca-certificates gnupg

# Install Docker (official repository)
curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

> Debian 13's codename is `trixie`. If Docker's repo does not yet publish `trixie` packages on your
> mirror, replace `$(. /etc/os-release && echo "$VERSION_CODENAME")` with `bookworm`.

### Create the deploy user — [root]

The app does **not** run as root. Create the dedicated `deploy` user once, give it Docker access, and
hand it the app directory under `/opt`:

```bash
useradd -m -s /bin/bash deploy
usermod -aG docker deploy                 # run docker without sudo
mkdir -p /opt/evenly
chown deploy:deploy /opt/evenly
```

### Clone the repository — [deploy]

```bash
su - deploy                               # switch to the deploy user (exit returns to root)
git clone https://github.com/KronigDev/evenly.git /opt/evenly
cd /opt/evenly
```

> The production server is **Docker-only** — it needs no Node on the host. The image installs its own
> dependencies and runs `next build` during the Docker build; the host only ever does `git pull` +
> `docker compose ... up -d --build`. Node on the host is only for **local development**.

### Configuration — [deploy]

```bash
cp .env.example .env
nano .env
chmod 600 .env                            # contains DB password + AUTH_SECRET - restrict it
```

Minimum fields for production in `.env`:

```env
# Database (use a STRONG password; the prod compose refuses to start without it)
POSTGRES_USER=evenly
POSTGRES_PASSWORD=<a-long-random-password>
POSTGRES_DB=evenly

# Public URL of the site (used to build links in emails) + host port nginx proxies to
APP_URL=https://evenly.your-domain.com
APP_PORT=3000

# Session/CSRF signing secret — generate with: openssl rand -hex 32
AUTH_SECRET=<64-hex-chars>

# Real SMTP provider (Mailpit is dev-only). Example: Resend / Postmark / SES.
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=<smtp-user>
SMTP_PASS=<smtp-pass>
SMTP_SECURE=false
EMAIL_FROM=Evenly <no-reply@your-domain.com>

# Do not seed demo data in production
RUN_SEED=false
```

### First start — [deploy]

```bash
# Build and start the production stack (app + PostgreSQL; migrations run on start).
docker compose -f docker-compose.prod.yml up -d --build

# Watch the logs (you should see: migrate deploy -> Next.js ready)
docker compose -f docker-compose.prod.yml logs -f

# Check status
docker compose -f docker-compose.prod.yml ps
```

The app listens on **`127.0.0.1:3000`** only — put nginx in front for TLS.

### Nginx reverse proxy (TLS)

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

`/etc/nginx/sites-available/evenly`:

```nginx
server {
    listen 80;
    server_name evenly.your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name evenly.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/evenly.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/evenly.your-domain.com/privkey.pem;

    # Receipt uploads can be a few MB.
    client_max_body_size 16m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/evenly /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Obtain the SSL certificate
sudo certbot --nginx -d evenly.your-domain.com
```

> Cookies are marked `Secure` automatically when `APP_URL` starts with `https://`. Make sure your TLS
> terminator forwards `X-Forwarded-Proto` (as above). Consider a firewall:
> `ufw allow OpenSSH`, `ufw allow 'Nginx Full'`.

---

## Environment Variables

| Variable                              | Description                                                                         | Example                                |
| ------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------- |
| `POSTGRES_USER` / `POSTGRES_DB`       | Postgres role and database name.                                                    | `evenly` / `evenly`                    |
| `POSTGRES_PASSWORD`                   | Postgres password. **Required in prod** — compose refuses to start without it.      | `<long-random>`                        |
| `DATABASE_URL`                        | Full connection string. In Docker it is built from the `POSTGRES_*` values for you. | `postgresql://evenly:…@db:5432/evenly` |
| `APP_URL` / `NEXT_PUBLIC_APP_URL`     | Public base URL — used to build links in emails. **Required in prod.**              | `https://evenly.example.com`           |
| `APP_PORT`                            | Host port the app is published on (prod binds it to `127.0.0.1`).                   | `3000`                                 |
| `AUTH_SECRET`                         | Session/CSRF signing secret. **Set a long random value** (`openssl rand -hex 32`).  | `<64 hex chars>`                       |
| `SMTP_HOST` / `SMTP_PORT`             | SMTP server. Dev uses Mailpit; prod uses a real provider.                           | `smtp.resend.com` / `587`              |
| `SMTP_USER` / `SMTP_PASS`             | SMTP credentials (leave empty for Mailpit).                                         | `resend` / `re_…`                      |
| `SMTP_SECURE`                         | `true` only for implicit TLS on connect (port 465).                                 | `false`                                |
| `EMAIL_FROM`                          | From header for outgoing mail.                                                      | `Evenly <no-reply@example.com>`        |
| `EXCHANGE_RATE_API_URL` / `…_API_KEY` | Optional. Refresh FX rates from a provider; otherwise bundled rates are used.       | _(empty)_                              |
| `UPLOAD_DIR`                          | Where receipts/avatars are stored (a writable volume).                              | `/app/uploads`                         |
| `RUN_SEED`                            | Seed demo data on start. **`false` in production.**                                 | `false`                                |

---

## Updates & Maintenance

### Regular update (code + rebuild)

```bash
cd /opt/evenly
./update.sh
```

`update.sh` runs `git pull` (fast-forward) + `docker compose -f docker-compose.prod.yml up -d --build`

- an image prune. **Database migrations run automatically** on container start
  (`prisma migrate deploy`). It is the same thing the
  [auto-deploy runner](#auto-deploy-github-actions-self-hosted-runner) does on every push to `main`.

### Only an .env variable changed

```bash
cd /opt/evenly
# Server-side variable (SMTP_*, AUTH_SECRET, EXCHANGE_RATE_*) — restart is enough
docker compose -f docker-compose.prod.yml up -d

# A NEXT_PUBLIC_* variable (e.g. APP_URL) is baked into the bundle — rebuild
docker compose -f docker-compose.prod.yml up -d --build
```

### Useful Docker commands

```bash
cd /opt/evenly
docker compose -f docker-compose.prod.yml logs -f      # live logs
docker compose -f docker-compose.prod.yml ps           # status
docker compose -f docker-compose.prod.yml restart      # restart
docker compose -f docker-compose.prod.yml exec db psql -U evenly -d evenly   # DB shell
```

---

## Backups

Unlike a stateless app, Evenly has real data: the **PostgreSQL database** and the **uploads**
(receipts / avatars) volume. Both live in named Docker volumes (`evenly_db_data`,
`evenly_uploads_data`) and should be backed up.

```bash
cd /opt/evenly

# Database dump (gzip)
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U evenly evenly | gzip > evenly-db-$(date +%F).sql.gz

# Restore a dump
gunzip -c evenly-db-2026-06-29.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U evenly -d evenly

# Uploads volume -> tar.gz
docker run --rm -v evenly_uploads_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/evenly-uploads-$(date +%F).tar.gz -C /data .
```

> `.env` is gitignored, so `git pull` / `git reset --hard` never touches your secrets. Keep an
> off-server copy of `.env` and your backups. A `git reset --hard` (used by auto-deploy) does **not**
> touch the database or uploads volumes.

---

## Auto-Deploy (GitHub Actions, self-hosted runner)

Push to `main` → the server updates itself automatically. A **self-hosted GitHub Actions runner**
runs on the server as the dedicated non-root **`deploy`** user and, on every push, runs
`git reset --hard origin/main` + `docker compose -f docker-compose.prod.yml up -d --build`. The
workflow `.github/workflows/deploy.yml` already ships in the repo (`runs-on: [self-hosted, deploy]`).

> The runner is registered **repo-scoped** and runs as user `deploy` — **not as root**. App and runner
> live under `/opt`. The app container itself runs as the non-root `nextjs` user. Database migrations
> run on container start; a deploy never destroys data (the DB/uploads live in named volumes).

### 1. Prerequisites

This assumes the app is **already installed and running** per
[Production: Debian 13 Setup](#production-debian-13-setup) — the `deploy` user exists, the repo is
cloned at `/opt/evenly`, `.env` is filled in, and `docker compose -f docker-compose.prod.yml up -d`
came up cleanly.

### 2. Create the runner directory — [root]

```bash
mkdir -p /opt/actions-runner
chown deploy:deploy /opt/actions-runner
```

### 3. Install the runner

Get a token: **Repo → Settings → Actions → Runners → New self-hosted runner** (repo-scoped token + version).

**[deploy] — download:**

```bash
su - deploy
cd /opt/actions-runner
RUNNER_VER=2.323.0                                   # use the version shown on the runner page
curl -o runner.tar.gz -L https://github.com/actions/runner/releases/download/v${RUNNER_VER}/actions-runner-linux-x64-${RUNNER_VER}.tar.gz
tar xzf runner.tar.gz
```

**[root] — dependencies (once):**

```bash
cd /opt/actions-runner
./bin/installdependencies.sh
apt-get install -y libicu76                          # Debian 13: install ICU
```

**[deploy] — register** (label `deploy`, matching the workflow's `runs-on`):

```bash
cd /opt/actions-runner
./config.sh --url https://github.com/KronigDev/evenly \
  --token <REPO_TOKEN> --name "$(hostname)" --labels deploy --unattended
```

**[root] — install as a service (runs as `deploy`):**

```bash
cd /opt/actions-runner
./svc.sh install deploy
./svc.sh start
./svc.sh status                                      # active (running)
```

### 4. Test

A `dev → main` merge (or push to `main`) → **Repo → Actions** shows the "Deploy" run. Check:

```bash
docker compose -f /opt/evenly/docker-compose.prod.yml ps
docker compose -f /opt/evenly/docker-compose.prod.yml logs -f app
```

---

## Continuous Integration

`.github/workflows/ci.yml` runs on every push / pull request to `main` and `dev` (GitHub-hosted
runners). It mirrors the local quality gate:

```
pnpm install --frozen-lockfile
pnpm prisma generate
pnpm format:check      # Prettier
pnpm lint              # ESLint
pnpm typecheck         # tsc --noEmit (strict)
pnpm test              # Vitest unit tests
pnpm build             # prisma generate + next build
```

This keeps `main` and `dev` green; the self-hosted **Deploy** workflow only runs on `main`.

---

## Local Development

The fastest way on **Windows** is **`dev.bat`** (double-click): it creates `.env` on first run,
checks Docker, and gives you a menu to start / rebuild / stop / reset the **dockerised dev stack**
(app + PostgreSQL + Mailpit) — the app comes up on **http://localhost:3001** with demo data seeded.

Cross-platform with Docker:

```bash
cp .env.example .env
docker compose up -d            # app :3001, Postgres :5432, Mailpit :8025
```

- **App** → http://localhost:3001 (demo login `ada@evenly.app` / `password123`)
- **Mailpit** (all outgoing email) → http://localhost:8025

Native dev with **Node 20.9+** (Node 24 recommended) + **pnpm**:

```bash
pnpm install
docker compose up -d db mailpit         # just the infra
cp .env.example .env
pnpm prisma migrate deploy && pnpm prisma:seed
pnpm dev                                # hot-reload dev server on http://localhost:3001
```

> The dev stack uses Mailpit as a mail catcher — open every invite / magic-link / reset email at
> http://localhost:8025. Production uses a real SMTP provider instead.

---

## Testing

```bash
pnpm test            # Vitest unit tests: money/split/debt engine, currency
                     # (incl. a property test reconciling pairwise debts with net balances)
pnpm test:e2e        # Playwright happy-path E2E (needs the app + DB running, e.g. docker compose up)
```

For E2E, point Playwright at the running app:

```bash
E2E_NO_SERVER=1 E2E_BASE_URL=http://localhost:3001 pnpm test:e2e
```

---

_Evenly records settlements manually and has no payment-provider integration. It serves only the
groups you belong to; all data access is authorized server-side._
