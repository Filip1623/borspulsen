---
description: Verifiera att skills-installationen är komplett och i synk med lock-filen.
---

Kontrollera skills-hälsan utan att ändra något:

1. Lista poster i `skills-lock.json` (namn + skillPath).
2. Lista mappar i `.agents/skills/`.
3. Jämför: flagga (a) lock-poster som saknar mapp/SKILL.md, (b) mappar som saknas i lock.
4. Bekräfta att varje refererad `SKILL.md` faktiskt finns på sin sökväg.

Rapportera ✅ om allt stämmer, annars en exakt lista på vad som saknas och
föreslagen åtgärd (t.ex. `npx skills add <källa>` eller ta bort en föräldralös post).
