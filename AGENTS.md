<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Repository skills

Before changing authored files, read the applicable repository-local skill:

- `skills/enforce-file-size/SKILL.md` for additions, edits, or refactors.
- `skills/organize-by-purpose/SKILL.md` when adding, moving, or substantially
  restructuring application code.
- `skills/hands-diff-start-change/SKILL.md` before starting a governed change.
- `skills/hands-diff-prepare-pr/SKILL.md` before handing off a pull request.
- `skills/hands-diff-ui-validation/SKILL.md` for user-interface changes.
- `skills/hands-diff-prisma-migration/SKILL.md` before changing the Prisma schema
  or creating a migration.
- `skills/hands-diff-github-issues/SKILL.md` when work begins from a GitHub Issue.
- `skills/hands-diff-branch-work-audit/SKILL.md` when auditing recent work that has not reached `develop`.
- `skills/hands-diff-daily-branch-reconcile/SKILL.md` when collecting and reconciling the past day's branch commits.

Use `feature/<kebab-title>`, `fix/<kebab-title>`, or `chore/<kebab-title>`
branches from `origin/develop`, and target `develop` through a pull request.
Promote the integrated `develop` branch to `main` through a separate pull
request only when the set is ready to go live. For an explicitly selected
same-repository issue, use
`<type>/<issue>-<kebab-title>` and include `Closes #<issue>` in the PR body.
Do not automatically assign, label, close, or edit GitHub Issues. Install these
repository skills with `./scripts/install-repository-skills.sh`.

`main` is the production-candidate branch, but this application is not currently
connected to a public domain. A push or merge to `main` therefore does not make
the application live.

## Readability and file organization

Keep authored files at or below 800 nonblank lines. Treat that as a ceiling, not
a target: split files by clear product responsibility when it improves ownership
or readability, never by arbitrary ranges. Keep reusable behavior under its
feature directory and leave `app/` route entry points thin.

Keep code lines at or below 90 characters. Use logical line breaks, indentation,
and blank lines to make data construction and control flow easy to scan; do not
compress code or remove useful whitespace to avoid a refactor. Run the
repository file-size/readability check before handoff.
