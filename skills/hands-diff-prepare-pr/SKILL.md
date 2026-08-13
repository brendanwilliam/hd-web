---
name: hands-diff-prepare-pr
description: Prepare a complete Hands Diff pull request. Use when validating, documenting, committing, or handing off a Hands Diff change or develop-to-main promotion.
---

# Prepare a Hands Diff Pull Request

1. Target `develop` for ordinary feature, fix, and chore work. Target `main` only for a promotion pull request from `develop`; do not directly push either branch. `main` does not currently deploy to a public domain. Use a Conventional Commit subject and an explanatory body for non-trivial work.
2. Run `npm run lint`, `npm test`, and `npm run build`. Run `npm run test:e2e` for UI or navigation changes and report any intentionally unrun validation with its reason.
3. Follow `hands-diff-ui-validation` for user-visible changes and `hands-diff-prisma-migration` for schema or migration changes.
4. Complete `.github/pull_request_template.md`, including impact, validation, configuration or migration notes, risks, and visual evidence when applicable.
5. For a same-repository issue-backed branch, include `Closes #<issue>` in the PR body. Do not add it for non-issue work and do not mutate the Issue.
6. Synchronize with the target integration branch and resolve conflicts before requesting merge.
