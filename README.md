# Handscheck

Handscheck is the public, privacy-safe companion service for Input Activity OBS League recaps. It accepts only schema-version-4 reports and stores aggregate input telemetry, never individual keystrokes.

## Local development

1. Copy `.env.example` to `.env` and fill in a Neon Postgres `DATABASE_URL`, GitHub OAuth credentials, and a long random `SESSION_SECRET`.
2. In this directory, run `npm install`, `npx prisma migrate dev`, and `npm run dev`.
3. Create a GitHub OAuth app with callback URL `http://localhost:3000/api/auth/github/callback`.

## Deploy to Vercel and Neon

Create a Neon database, add its pooled connection URL as `DATABASE_URL` in Vercel, and configure `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`, `APP_URL=https://handscheck.vercel.app`, and a random `CRON_SECRET`. Deploy this repository root as the Vercel project root, then run `npx prisma migrate deploy` against production.

Set the GitHub OAuth callback URL to `https://handscheck.vercel.app/api/auth/github/callback`. If a custom domain replaces the Vercel hostname, update both `APP_URL` and that callback URL. Vercel automatically authenticates the configured daily cron using `CRON_SECRET`.

The OBS plugin defaults to `https://handscheck.vercel.app`; packaging can override it with `-DONLINE_REPORTS_SERVICE_URL=https://your-host`.
