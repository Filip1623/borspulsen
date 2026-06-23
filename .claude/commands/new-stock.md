---
description: Lägg till en ny aktie i BörsPulsen (whitelist + verifiering). Användning: /new-stock VOLV-B
argument-hint: <SYMBOL t.ex. VOLV-B>
---

Lägg till aktien **$ARGUMENTS** i BörsPulsen, säkert och komplett:

1. Lägg till symbolen (i `.ST`-format, t.ex. `VOLV-B.ST`) i `ALLOWED_SYMBOLS`
   i `netlify/functions/quote.js`. Hoppa över om den redan finns.
2. Kontrollera att UI:t i `index.html` listar/kan visa aktien (delegera till
   `frontend-engineer` om markup/lista behöver kompletteras).
3. Be `market-data-analyst` verifiera att symbol-mappningen Finnhub↔Yahoo blir rätt
   för fundamentals (`OMXSTO:<sym>` → `<sym>.ST`).
4. Kör `node --check netlify/functions/quote.js`.

Rapportera vad som ändrades och vad som bör testas. Pusha INTE utan att jag säger till.
