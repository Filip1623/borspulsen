# BörsPulsen

Realtidsapp för svenska börsen — aktiekurser, nyckeltal, nyheter och AI-assistent.
Publik sajt: **https://borspulsen.com**

## Projektkarta

```
borspulsen/
├── index.html              ← Hela frontend. Vanilla JS, ingen build-step. Dark-theme SPA.
├── netlify.toml            ← Säkerhets-headers (CSP), SPA-redirect.
├── skills-lock.json        ← Låsfil för design-skills (npx skills).
│
├── netlify/
│   └── functions/          ← Serverless-proxys som döljer API-nycklar:
│       ├── quote.js              · Aktiepris (Finnhub)
│       ├── stock-profile.js      · Bolagsinfo (Finnhub)
│       ├── stock-fundamentals.js · P/E, P/S, P/B m.m. (Yahoo Finance)
│       ├── news.js               · Nyheter
│       ├── news-context.js       · Nyhetskontext
│       ├── news-impact.js        · Nyhetspåverkan
│       └── ai-chat.js            · AI-assistent (Anthropic Claude)
│
├── .agents/skills/         ← Design-/taste-skills (hanteras av npx skills).
│
├── CLAUDE.md               ← Projektminne för Claude (arkitektur + regler).
└── .claude/                ← Claude-ekosystem: agenter, kommandon, hooks.
    └── README.md                · Förklarar ekosystemet.
```

## Arkitektur i en mening

`index.html` hämtar all data via `/.netlify/functions/*`, som i sin tur proxar mot
Finnhub, Yahoo Finance, Frankfurter och Anthropic — så att API-nycklarna aldrig
exponeras i frontend.

## Miljövariabler (sätts i Netlify Dashboard)

| Nyckel | Används av |
|--------|------------|
| `FINNHUB_TOKEN` | `quote.js`, `stock-profile.js` |
| `ANTHROPIC_API_KEY` | `ai-chat.js` |

## Utveckling

Ingen build-step. Öppna `index.html` direkt, eller kör `netlify dev` för att även
köra funktionerna lokalt. Hela appen är en statisk sajt + serverless-funktioner.

## Arbeta med Claude

Se [`CLAUDE.md`](./CLAUDE.md) och [`.claude/README.md`](./.claude/README.md).
Snabba kommandon: `/status`, `/preflight`, `/new-stock`, `/ui-review`, `/sync-skills`.
