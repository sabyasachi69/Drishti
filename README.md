# DRISHTI

DRISHTI is a peer-learning web app with email/password accounts, HTTP-only session cookies, Postgres storage, task tracking, course progress, forums, study groups, offline pack manifests, and rule-based recommendations.

## Local Setup

1. Use Node 20 or newer, then install dependencies:

```bash
npm install
```

2. Create a Postgres database and add a local connection string:

```bash
cp .env.example .env.local
```

Set `DATABASE_URL` in `.env.local`.

3. Create tables and starter catalog records:

```bash
npm run db:migrate
```

4. Start the app:

```bash
npm run dev
```

Open `http://localhost:4323/app`.

## Vercel Setup

Create a Neon Postgres database from the Vercel Marketplace or use an existing Postgres database. Add `DATABASE_URL` to the Vercel project, run `npm run db:migrate` with that environment, then deploy.

The app intentionally does not fall back to fake users or JSON storage. If `DATABASE_URL` is missing, API writes return `SETUP_REQUIRED`.
