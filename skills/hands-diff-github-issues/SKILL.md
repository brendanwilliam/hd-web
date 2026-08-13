---
name: hands-diff-github-issues
description: Discover an explicitly selected assigned Hands Diff GitHub Issue and begin governed issue-backed work. Use when listing assigned Hands Diff issues, selecting one, or creating its branch and pull request plan.
---

# Hands Diff GitHub Issues

1. Confirm this is the `hd-web` repository, then run `gh auth status`. Stop and ask the user to authenticate if it fails; never substitute another identity or repository.
2. List only open issues assigned to the authenticated current user in this repository, for example with `gh issue list --assignee @me --state open`. Wait for the user to explicitly select an issue number or URL.
3. Fetch the selected issue's full title, body, labels, and comments. Reconcile it with the requested work; ask before proceeding if it materially conflicts.
4. Fetch `origin`, inspect the worktree, and create exactly one branch from `origin/develop`: `feature/<issue>-<slug>`, `fix/<issue>-<slug>`, or `chore/<issue>-<slug>`.
5. Target `develop` and include `Closes #<issue>` in the same-repository issue-backed PR body.
6. Never automatically assign, label, close, edit, or otherwise mutate GitHub Issues. Follow the relevant delivery, UI-validation, and Prisma-migration skills.
