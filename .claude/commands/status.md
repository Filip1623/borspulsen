---
description: Visa en dashboard över projektets nuläge — gren, ändringar, funktioner, skills.
---

Ge en kort, läsbar lägesrapport för BörsPulsen. Kör och sammanfatta:

1. `git status -s` och aktuell gren (`git branch --show-current`).
2. Senaste 3 commits (`git log --oneline -3`).
3. Antal Netlify-funktioner (`ls netlify/functions/`).
4. Skills-läge: antal poster i `skills-lock.json` vs mappar i `.agents/skills/`.

Presentera som en kompakt dashboard med rubriker. Avsluta med en rad:
"Nästa rimliga steg: ..." baserat på vad du ser. Ändra ingenting.
