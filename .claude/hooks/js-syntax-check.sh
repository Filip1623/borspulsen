#!/usr/bin/env bash
# PostToolUse-hook: kör `node --check` på en .js-fil som just redigerats.
# Fångar syntaxfel direkt så de aldrig committas. Blockerar inte — informerar bara.
set +e

# Hook-payload kommer som JSON på stdin; plocka ut file_path utan beroenden.
payload=$(cat)
file=$(printf '%s' "$payload" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)

case "$file" in
  *.js)
    if command -v node >/dev/null 2>&1; then
      if node --check "$file" 2>/tmp/js-syntax-err; then
        echo "✅ node --check OK: $file"
      else
        echo "❌ Syntaxfel i $file:"
        cat /tmp/js-syntax-err
      fi
    fi
    ;;
esac

exit 0
