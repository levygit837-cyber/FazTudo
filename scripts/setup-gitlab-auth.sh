#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${GITLAB_TOKEN:-}" ]]; then
  echo "Error: GITLAB_TOKEN is not set." >&2
  echo "Run: export GITLAB_TOKEN=\"<your_gitlab_token>\"" >&2
  exit 1
fi

if [[ $# -gt 1 ]]; then
  echo "Usage: $0 [gitlab_remote_url]" >&2
  exit 1
fi

if [[ $# -eq 1 ]]; then
  remote_url="$1"
  if [[ "$remote_url" != https://gitlab.com/* ]]; then
    echo "Error: remote URL must start with https://gitlab.com/" >&2
    exit 1
  fi
  git remote set-url origin "$remote_url"
fi

git config --local credential.username oauth2
git config --local credential.helper \
  '!f() { \
    if [ -z "${GITLAB_TOKEN:-}" ]; then \
      echo "GITLAB_TOKEN is not set." >&2; \
      exit 1; \
    fi; \
    echo "username=oauth2"; \
    echo "password=$GITLAB_TOKEN"; \
  }; f'

origin_url="$(git remote get-url origin 2>/dev/null || true)"
if [[ -n "$origin_url" && "$origin_url" == *github.com* ]]; then
  echo "Warning: origin still points to GitHub: $origin_url" >&2
  echo "Set GitLab origin with: $0 https://gitlab.com/<group>/<project>.git" >&2
fi

echo "OK: local Git credentials configured for GitLab using GITLAB_TOKEN."
