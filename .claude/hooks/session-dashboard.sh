#!/usr/bin/env bash
# SessionStart-hook: skriver ut en liten, läsbar dashboard så man direkt ser läget.
# Påverkar aldrig sessionen negativt — fel sväljs och vi avslutar alltid med 0.
set +e

branch=$(git branch --show-current 2>/dev/null)
changes=$(git status -s 2>/dev/null | wc -l | tr -d ' ')
last=$(git log --oneline -1 2>/dev/null)
fns=$(ls netlify/functions/*.js 2>/dev/null | wc -l | tr -d ' ')
skills=$(ls -d .agents/skills/*/ 2>/dev/null | wc -l | tr -d ' ')

echo "┌─ BörsPulsen ────────────────────────────"
echo "│ Gren:        ${branch:-?}"
echo "│ Ändringar:   ${changes:-0} fil(er) ej committade"
echo "│ Senaste:     ${last:-?}"
echo "│ Funktioner:  ${fns:-0} st i netlify/functions/"
echo "│ Skills:      ${skills:-0} st i .agents/skills/"
echo "├─ Genvägar ──────────────────────────────"
echo "│ /status  /preflight  /new-stock  /ui-review  /sync-skills"
echo "└─────────────────────────────────────────"

exit 0
