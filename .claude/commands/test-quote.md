---
description: Testa Stooq-data för en eller flera ticker symboler. Användning: /test-quote TICKER1,TICKER2,...
argument-hint: TICKER1[,TICKER2,...]
---

# Testa aktiekursdata

Testa att tickern/tickrarna `$ARGUMENTS` fungerar mot vårt Stooq-proxy.

## Steg

1. **Parsa argumenten**: Komma-separerad lista av ticker (max 20).
2. **Bygg URL**:
   ```
   https://deploy-preview-2--verdant-souffle-b10db3.netlify.app/.netlify/functions/quote?symbols=$ARGUMENTS
   ```
3. **Anropa via Bash**:
   ```bash
   curl -s "https://deploy-preview-2--verdant-souffle-b10db3.netlify.app/.netlify/functions/quote?symbols=$ARGUMENTS"
   ```
4. **Parsa JSON-svaret** och presentera resultatet i en tabell:

   ```
   | Ticker    | Pris     | Förändring | Volym       | Källa  | Status |
   |-----------|----------|------------|-------------|--------|--------|
   | VOLV-B.ST | 248.50   | +1.2%      | 5 400 000   | stooq  | ✅     |
   | AAPL      | 225.75   | -0.3%      | 45 000 000  | stooq  | ✅     |
   | XXX       | -        | -          | -           | -      | ❌     |
   ```

5. **Rapportera fel** om `errors`-arrayen i svaret är icke-tom.
6. **Beräkna hit-rate**: `hits / total * 100%`.
7. **Föreslå åtgärder** om hit-rate < 100%:
   - Kolla ticker-formatet (saknas suffix? Fel skiljetecken?)
   - Pröva alternativ Stooq-symbol manuellt: `stooq.com/q/l/?s=TICKER.us&e=csv`
   - Verifiera på TradingView att aktien handlas på rätt börs

## Format-tips
- Svenska aktier: `VOLV-B.ST` eller bara `VOLV-B` (proxy konverterar)
- USA: `AAPL`, `MSFT` (inget suffix)
- Index: `^OMXS30`, `^GSPC`
- Norska: `EQNR.OL`
- Tyska: `BMW.DE`

## Stäng av med koncis rapport
Visa tabellen + en sammanfattningsrad: "X/Y symboler returnerade data ({pct}% hit-rate)".
