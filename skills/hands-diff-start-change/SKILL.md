---
name: hands-diff-start-change
description: Start a governed Hands Diff feature, fix, or chore. Use when choosing a branch, synchronizing with develop, or planning validation for a web change.
---

# Start a Hands Diff Change

1. Inspect the worktree and current branch; preserve unrelated work.
2. Fetch `origin`, then branch from the latest `origin/develop` using `feature/<kebab-title>`, `fix/<kebab-title>`, or `chore/<kebab-title>`. For explicitly selected issue work, include the issue number immediately after the slash.
3. Target `develop` through a pull request. Do not push directly to `develop` or `main`.
4. State the applicable validation: file size and lint for every change; Vitest for behavior; build; and Playwright/manual validation for relevant UI work.
5. Use Conventional Commit subjects. Synchronize with `origin/develop` before handoff and preserve a reviewable history. Use a separate promotion pull request from `develop` to `main` only for an integrated release candidate; `main` has no public domain deployment today.
