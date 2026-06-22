# BörsPulsen — Projektminne för Claude

> Detta är ett **levande projektminne**. Claude läser den här filen automatiskt vid varje
> session. Håll den kort, sann och uppdaterad. Om något här inte stämmer med koden —
> tro på koden och rätta den här filen.

## Vad är BörsPulsen?

En realtidsapp för svenska börsen (OMXS30, Stockholmsbörsen). Visar aktiekurser,
nyckeltal, nyheter och en AI-assistent. Publik sajt: **https://borspulsen.com**.

Språk i UI och kod-kommentarer: **svenska**.

## Arkitektur (håll i huvudet innan du ändrar något)

```
index.html ───────────────► Frontend. EN fil. Vanilla JS, ingen build-step.
  │                           Dark-theme SPA med egen router. ~200 KB.
  │   fetch /.netlify/functions/*
  ▼
netlify/functions/*.js ────► Serverless-proxys. Döljer API-nycklar.
  │                           Validerar input. Sätter CORS + cache.
  ▼
Externa API:er ────────────► Finnhub (pris), Yahoo Finance (nyckeltal),
                              Frankfurter (valuta), Anthropic (AI-chat).
netlify.toml ──────────────► CSP, säkerhets-headers, SPA-redirect.
```

### Funktionerna (`netlify/functions/`)
| Fil | Gör | Extern källa | Env-nyckel |
|-----|-----|--------------|------------|
| `quote.js` | Aktiepris | Finnhub | `FINNHUB_TOKEN` |
| `stock-fundamentals.js` | P/E, P/S, P/B m.m. | Yahoo Finance | – |
| `stock-profile.js` | Bolagsinfo | Finnhub | `FINNHUB_TOKEN` |
| `news.js` | Nyheter | – | – |
| `news-context.js` | Nyhetskontext | – | – |
| `news-impact.js` | Nyhetspåverkan | – | – |
| `ai-chat.js` | AI-assistent | Anthropic | `ANTHROPIC_API_KEY` |

## Hårda regler (bryt inte mot dessa)

1. **API-nycklar lever ENBART i Netlify-miljövariabler.** Aldrig i `index.html`,
   aldrig i committad kod. Frontend pratar bara med `/.netlify/functions/*`.
2. **Symbol-whitelist.** `quote.js` har en `ALLOWED_SYMBOLS`-mängd. Lägger du till
   en ny aktie måste den in där — annars blockeras den (anti-missbruk).
3. **CSP i `netlify.toml`.** Lägger du till ett externt script/CDN/API måste rätt
   `*-src`-direktiv uppdateras, annars blockerar webbläsaren det tyst.
4. **Ingen build-step.** `index.html` ska funka direkt i webbläsaren. Inga bundlers,
   inga npm-beroenden i frontend.
5. **Anthropic-modeller:** använd senaste Claude-modellen i `ai-chat.js`. Kolla
   skillen `claude-api` vid tveksamhet om modell-ID.

## Vanliga uppgifter → rätt agent/kommando

- Lägga till en aktie → `/new-stock` (uppdaterar whitelist + verifierar fundamentals)
- Ändra utseende/UI → agenten `design-critic` granskar mot taste-skills
- Ny/ändrad backend-funktion → agenten `api-functions`
- Innan push/deploy → `/preflight` (CSP, läckta nycklar, JS-syntax)
- Förstå nuläget → `/status`

## Konventioner

- Commit-meddelanden på svenska, kort och beskrivande (se git-loggen).
- Säkerhets-headers och CSP får aldrig försvagas utan uttrycklig anledning.
- Skills ligger i `.agents/skills/` och låses av `skills-lock.json`.
