# `.claude/` — BörsPulsens Claude-ekosystem

Det här är "manöverpanelen" för hur Claude jobbar i projektet. Syftet är att göra
arbetet **självständigt** men ändå **lätt att avläsa** — du ska alltid kunna se vad
som händer och varför.

## Karta över mappen

```
.claude/
├── README.md          ← du är här: förklarar helheten
├── settings.json      ← behörigheter + hooks (automatik). Committad, delas i teamet.
├── agents/            ← specialiserade subagenter (en expert per område)
│   ├── frontend-engineer.md
│   ├── api-functions.md
│   ├── design-critic.md
│   ├── market-data-analyst.md
│   └── release-verifier.md
└── commands/          ← slash-kommandon (/status, /preflight, /new-stock ...)
    ├── status.md
    ├── preflight.md
    ├── new-stock.md
    ├── ui-review.md
    └── sync-skills.md
```

Plus `../CLAUDE.md` = projektminnet som Claude alltid läser först.

## De tre lagren — så hänger det ihop

1. **CLAUDE.md (minne):** Fakta om projektet. Läses automatiskt. "Vad är detta?"
2. **Agents (experter):** Avgränsade roller med eget fokus och egna verktyg.
   Du delegerar en uppgift → agenten löser den självständigt → rapporterar tillbaka.
   "Vem gör jobbet?"
3. **Commands (genvägar):** Färdiga arbetsflöden du startar med `/namn`.
   "Hur startar jag ett vanligt jobb?"

## Hur du använder det (snabbstart)

| Du vill... | Skriv |
|------------|-------|
| Se nuläget på projektet | `/status` |
| Kolla att allt är redo att de:as | `/preflight` |
| Lägga till en ny aktie | `/new-stock VOLV-B` |
| Få UI:t granskat på smak/design | `/ui-review` |
| Verifiera skills-installationen | `/sync-skills` |

För större jobb kan du säga t.ex. *"använd design-critic för att se över startsidan"*
så plockar Claude rätt expert.

## Automatik (hooks i `settings.json`)

- **SessionStart** → skriver ut en liten dashboard så du direkt ser läget.
- **PostToolUse på `.js`** → kör `node --check` automatiskt, fångar syntaxfel innan de committas.
- **Stop** → påminner om `/preflight` om backend-funktioner ändrats.

Allt detta är synligt och loggas i klartext — inget händer "i det dolda".

## Principer

- **Transparens före magi.** Hellre en tydlig rad i terminalen än smart automatik
  man inte förstår.
- **Säkert som standard.** Behörigheterna i `settings.json` tillåter läsning/bygge
  fritt, men håller känsliga saker (push, radering) bekräftade.
- **En sanning.** `CLAUDE.md` är källan. Stämmer den inte med koden → rätta minnet.
