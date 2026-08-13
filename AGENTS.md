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

Use `feature/<kebab-title>`, `fix/<kebab-title>`, or `chore/<kebab-title>`
branches from `origin/main`, and target `main` through a pull request. For an
explicitly selected same-repository issue, use
`<type>/<issue>-<kebab-title>` and include `Closes #<issue>` in the PR body.
Do not automatically assign, label, close, or edit GitHub Issues. Install these
repository skills with `./scripts/install-repository-skills.sh`.
