---
name: enforce-file-size
description: Keep Hands Diff web's authored files at or below 800 nonblank lines and code at or below 90 columns. Use when adding, editing, splitting, or reviewing application code, tests, scripts, documentation, configuration, or repository skills in this repository.
---

# Enforce File Size

Keep every authored text file at or below 800 nonblank lines. Keep code lines at
or below 90 characters.

Run `npm run check:file-size` before handoff. Treat a failure as work that must
be resolved, not waived.

Treat the limits as ceilings, not targets. When a file approaches a limit,
extract a cohesive responsibility into a purpose-named sibling module or feature
directory. Preserve public behavior and keep imports explicit; use meaningful
line breaks and indentation rather than compressing code to avoid a refactor.

The check excludes generated and dependency artifacts, including `node_modules`,
`.next`, `.git`, `package-lock.json`, and Prisma-generated output. Do not edit
those artifacts to satisfy this policy.
