---
name: enforce-file-size
description: Keep Handscheck web's authored files under 400 nonblank lines. Use when adding, editing, splitting, or reviewing application code, tests, scripts, documentation, configuration, or repository skills in this repository.
---

# Enforce File Size

Keep every authored text file at or below 400 nonblank lines.

Run `npm run check:file-size` before handoff. Treat a failure as work that must
be resolved, not waived.

When a file approaches the limit, extract a cohesive responsibility into a
purpose-named sibling module or feature directory. Preserve public behavior and
keep imports explicit; do not split a file arbitrarily just to reduce its count.

The check excludes generated and dependency artifacts, including `node_modules`,
`.next`, `.git`, `package-lock.json`, and Prisma-generated output. Do not edit
those artifacts to satisfy this policy.
