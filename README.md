# Handscheck

Handscheck is the public, privacy-safe companion service for Input Activity OBS League recaps. It accepts only schema-version-4 reports and stores aggregate input telemetry, never individual keystrokes.

## Local development

1. Start the development-only Postgres database:

   ```sh
   docker compose up -d db
   ```

   It listens on `127.0.0.1:5433` and retains its data in the named
   `handscheck_postgres` Docker volume.

2. Copy `.env.example` to `.env`. The example `DATABASE_URL` already targets
   the local Compose database. Fill in GitHub OAuth credentials, a long random
   `SESSION_SECRET`, and `CRON_SECRET`.
3. Create a GitHub OAuth app with callback URL
   `http://localhost:3000/api/auth/github/callback`.
4. Install dependencies, apply the committed migrations, and run the app:

   ```sh
   npm install
   npm run db:migrate
   npm run dev
   ```

   Visit <http://127.0.0.1:3000>. To stop the local database while preserving
   its data, run `docker compose down`. Use `docker compose down --volumes`
   only when you intentionally want to remove local development data.

## Deploy to Vercel and Neon

Create a Neon database, add its pooled connection URL as `DATABASE_URL` in Vercel, and configure `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`, `APP_URL=https://handscheck.vercel.app`, and a random `CRON_SECRET`. Deploy this repository root as the Vercel project root, then run `npx prisma migrate deploy` against production.

Set the GitHub OAuth callback URL to `https://handscheck.vercel.app/api/auth/github/callback`. If a custom domain replaces the Vercel hostname, update both `APP_URL` and that callback URL. Vercel automatically authenticates the configured daily cron using `CRON_SECRET`.

The OBS plugin defaults to `https://handscheck.vercel.app`; packaging can override it with `-DONLINE_REPORTS_SERVICE_URL=https://your-host`.
