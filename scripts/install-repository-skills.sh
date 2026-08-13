#!/usr/bin/env bash
set -euo pipefail

repository_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
target_root=${CODEX_HOME:-"$HOME/.codex"}/skills

mkdir -p "$target_root"
for skill in "$repository_root"/skills/*; do
  test -d "$skill" || continue
  skill_name=$(basename "$skill")
  case "$skill_name" in
    hands-diff-*) ;;
    *) continue ;;
  esac
  ln -sfn "$skill" "$target_root/$skill_name"
done

printf 'Installed Hands Diff repository skills in %s\n' "$target_root"
