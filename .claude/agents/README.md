---
name: borspulsen-oversikt
description: Övergripande agent för BörsPulsen-projektet. Använd när uppgiften spänner över flera sektorer eller rör infrastruktur (Netlify Functions, CSP, säkerhet, design, deploy).
---

# BörsPulsen — Agent-översikt

## Projektstruktur
- `index.html` — hela frontend (5500+ rader, single-file)
- `netlify/functions/quote.js` — aktiekurs-proxy via Stooq
- `netlify/functions/stock-fundamentals.js` — P/E och nyckeltal via Yahoo
- `netlify/functions/lib/security.js` — CORS, rate limiting, IP-hantering
- `netlify.toml` — headers, CSP, redirects

## Specialiserade agenter (använd dessa för sektorspecifika uppgifter)
| Agent | Sektorer/Fokus |
|-------|---------------|
| `tech-sektor` | Ericsson, Hexagon, Apple, Microsoft, Nvidia |
| `finans-sektor` | SEB, Nordea, Handelsbanken, Investor |
| `industri-sektor` | Volvo, Atlas Copco, Sandvik, SKF, ABB |
| `energi-sektor` | Equinor, Aker BP, ExxonMobil |
| `halsa-sektor` | Getinge, Essity, J&J, Pfizer |
| `konsument-sektor` | H&M, Swedish Match, Amazon, Tesla |
| `material-sektor` | SSAB, Boliden, Hexpol |

## Datahämtning
- Aktiekurser: Stooq CSV-API (gratis, ingen nyckel)
- Yahoo-symbol → Stooq-symbol konvertering i `quote.js`
- Batch-format: pipe-separerat (`%7C`), max 20 symboler per anrop
- Stooq CSV-format: `Symbol,Date,Time,Open,High,Low,Close,Volume`

## Aktiv branch
`claude/peaceful-bardeen-fs3z03` → Deploy preview: https://deploy-preview-2--verdant-souffle-b10db3.netlify.app
