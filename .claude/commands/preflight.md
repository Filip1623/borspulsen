---
description: Kör alla säkerhets- och sundhetskontroller före push/deploy.
---

Delegera till agenten **release-verifier** och kör hela dess checklista mot repot:
läckta nycklar, `node --check` på alla funktioner, CSP-täckning, whitelist-konsistens
och säkerhets-headers.

Returnera en tydlig **GRÖN / RÖD**-dom överst, följt av ✅/❌ per punkt med fil:rad.
Vid RÖD: föreslå minsta åtgärd och vilken agent som bör fixa. Ändra ingen kod.
