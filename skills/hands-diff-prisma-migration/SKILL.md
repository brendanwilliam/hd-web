---
name: hands-diff-prisma-migration
description: Safely create and validate Hands Diff Prisma migrations. Use before changing prisma/schema.prisma or adding a Prisma migration.
---

# Hands Diff Prisma Migration

1. Inspect `prisma/schema.prisma`, existing migration history, and the worktree. Confirm the requested schema change and preserve unrelated work.
2. Generate migrations with Prisma from the schema in a local development database. Do not hand-author migration history or edit generated migration SQL except to abandon and regenerate a local, uncommitted migration after correcting the schema.
3. Inspect the generated SQL for unintended locks, data loss, destructive operations, and compatibility risks. Ask for explicit approval before any destructive local database reset.
4. Run `prisma migrate status` and `prisma migrate deploy` against a local development database, then run focused tests plus `npm run lint` and `npm run build`.
5. Never apply migrations to shared, staging, or production databases from this workflow. Document migration and configuration requirements in the pull request.
