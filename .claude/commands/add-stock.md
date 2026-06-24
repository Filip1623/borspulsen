---
description: Lägg till en ny aktie i BörsPulsen (index.html). Användning: /add-stock TICKER MARKET SECTOR
argument-hint: TICKER MARKET SECTOR
---

# Lägg till ny aktie

Lägg till aktien `$ARGUMENTS` i `index.html`.

## Steg

1. **Parsa argumenten**: `TICKER MARKET SECTOR` (t.ex. `AAPL US Tech` eller `VOLV-B SE Industri`)
2. **Validera**:
   - MARKET måste vara: `SE`, `NO`, `FI`, `US` eller `DE`
   - SECTOR måste vara: `Tech`, `Finans`, `Industri`, `Energi`, `Hälsa`, `Konsument` eller `Material`
   - TICKER får bara innehålla bokstäver, siffror, bindestreck (ingen `.ST`-suffix här)
3. **Kontrollera duplikat**: Sök i `index.html` om TICKER redan finns. Om ja → avbryt med felmeddelande.
4. **Hämta live-data** för att verifiera tickern existerar:
   ```bash
   curl -s "https://deploy-preview-2--verdant-souffle-b10db3.netlify.app/.netlify/functions/quote?symbols=TICKER" 
   ```
   - Om `hits: 0` → tickern finns inte på Stooq, avbryt
   - Om `hits: 1` → använd priset från svaret som initialvärde
5. **Bestäm bolagsnamn**: Be användaren bekräfta namnet (eller använd ticker som fallback)
6. **Konstruera objektet** baserat på marknad:
   ```javascript
   // SE-exempel:
   { name: 'BOLAG', ticker: 'TICKER', tvSymbol: 'OMXSTO:TICKER', price: X, mcap: 0, market: 'SE', currency: 'kr', pe: 0, sector: 'SECTOR' }
   
   // US-exempel:
   { name: 'BOLAG', ticker: 'TICKER', tvSymbol: 'NASDAQ:TICKER', price: X, mcap: 0, market: 'US', currency: '$', pe: 0, sector: 'SECTOR' }
   ```
7. **Hitta rätt array** i `index.html`:
   - `SE_DATA` för svenska aktier
   - `US_DATA` för amerikanska
   - `DE_DATA`, `NO_DATA`, `FI_DATA` för respektive
8. **Lägg till objektet** sist i arrayen (innan `];`)
9. **Rapportera tillbaka**: Vilket namn, ticker, pris, sektor som lagts till
10. **Påminn användaren** att verifiera P/E och mcap manuellt (default = 0)

## TradingView-symbol mappning
| Marknad | Prefix |
|---------|--------|
| SE | OMXSTO:TICKER (bindestreck → understreck) |
| US | NASDAQ:TICKER eller NYSE:TICKER (fråga vilken börs) |
| DE | XETR:TICKER |
| NO | OSLO:TICKER |
| FI | OMXHEX:TICKER |

## Felhantering
- Om duplikat: visa befintlig rad och avbryt
- Om Stooq saknar tickern: föreslå alternativ formatering (med/utan bindestreck)
- Om mcap/P/E saknas: lämna `0` och be användaren fylla i

## Committa INTE
Användaren får själv granska och committa.
