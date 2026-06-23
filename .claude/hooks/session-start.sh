#!/bin/bash
set -euo pipefail

# Only run in remote Claude Code on the web environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR"

SKILLS_DIR="$PROJECT_DIR/.agents/skills"

install_skills_npx() {
  echo "[skills] Installing NPX skills from skills-lock.json (non-interactive)..."
  echo "y" | npx --yes skills experimental_install 2>&1
}

recover_skills_git() {
  echo "[skills] Recovery: restoring skills from git..."
  mkdir -p "$SKILLS_DIR"
  # Check out .agents/skills from HEAD if available in git
  git checkout HEAD -- .agents/skills 2>&1 && echo "[skills] Restored from git." || echo "[skills] Not found in git."
}

# Primary: try npx install
if install_skills_npx; then
  echo "[skills] Skills installed successfully via NPX."
else
  echo "[skills] NPX install failed, attempting git recovery..."
  if recover_skills_git; then
    echo "[skills] Recovery successful."
  else
    echo "[skills] WARNING: Skills installation failed. Session continues without skills."
  fi
fi
