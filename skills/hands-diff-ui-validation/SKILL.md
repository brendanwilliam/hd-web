---
name: hands-diff-ui-validation
description: Validate Hands Diff user-interface changes with focused browser and manual checks. Use when routes, components, styles, navigation, or user-facing states change.
---

# Hands Diff UI Validation

1. Run the focused unit tests and `npm run test:e2e` when the changed path is covered by public smoke tests.
2. Manually test the affected route at desktop and a narrow viewport. Verify navigation, loading/empty/error states, keyboard access, labels, and visible focus behavior as applicable.
3. Do not use real production credentials or data. Smoke coverage must remain unauthenticated and independent of external services.
4. Include screenshots or a short recording for material visual changes and report browser checks in the pull request.
