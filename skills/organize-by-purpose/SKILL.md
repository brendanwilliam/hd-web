---
name: organize-by-purpose
description: Organize Handscheck web application code by product purpose and ownership. Use when adding, moving, or substantially restructuring routes, components, server logic, validation, integrations, tests, or shared utilities in this repository.
---

# Organize by Purpose

Use Next's `app/` directory for route definitions and route-local presentation
only. Keep `page.tsx`, `route.ts`, and server-action entry points thin:
authenticate, validate request-specific input, delegate, and render or return a
response.

Place reusable product behavior in `features/<purpose>/`:

- Put feature-specific server behavior in `server/`.
- Put feature-specific UI in `components/`.
- Put feature-specific parsing, types, and transformations in `domain/`.
- Place cross-feature infrastructure in `shared/`, not a generic catch-all
  utility directory.

Co-locate focused tests under `tests/<purpose>/`. Name directories for the
behavior they own, use the `@/` alias for application imports, and avoid
relative traversal imports. Prefer moving a cohesive responsibility over
creating broad folders such as `helpers`, `utils`, or `misc`.
