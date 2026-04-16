#!/usr/bin/env node
/**
 * AI Analyst — Wall Street-analytiker i konsolen
 *
 * Rankar publika aktier inom en sektor och lyfter fram de mest
 * undervärderade enligt flera värderingsramverk (P/E, PEG, EV/EBITDA,
 * DCF, FCF-yield). Använder Claude med adaptive thinking + web search
 * för färsk marknadsdata.
 *
 * Användning:
 *   export ANTHROPIC_API_KEY=sk-ant-...
 *   node analyst.js "semiconductors"
 *   node analyst.js "swedish banks" --count 8 --region nordic
 *   node analyst.js "renewable energy" --market-cap large
 *
 * Flaggor:
 *   --count N          Antal aktier att analysera (default 10)
 *   --region R         global | us | europe | nordic | asia (default global)
 *   --market-cap SIZE  any | large | mid | small (default any)
 *   --horizon H        short | medium | long (default medium, 12-24 mån)
 */

'use strict';

const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT = `Du är en rutinerad Wall Street equity analyst med 20+ års erfarenhet från toppbanker (Goldman Sachs, Morgan Stanley, JPMorgan). Din specialitet är att hitta undervärderade aktier inom specifika sektorer.

ARBETSFLÖDE
1. Identifiera de största och mest likvida publika bolagen i sektorn (enligt användarens filter).
2. För varje bolag — hämta aktuell data via web_search när du är osäker (priser, P/E, EPS-estimat, senaste kvartalsrapport, consensus price targets).
3. Värdera med MINST fyra av följande ramverk:
   - P/E (trailing + forward) vs sektorsmedian
   - PEG-tal (tillväxtjusterat P/E)
   - EV/EBITDA vs peers
   - P/B och P/S där det är relevant för sektorn
   - DCF-grov uppskattning (enkel 2-stegs, rimliga antaganden)
   - Free cash flow yield
   - Utdelningsyield + payout ratio (för utdelningssektorer)
4. Ranka bolagen från MEST undervärderade till MINST undervärderade.
5. Flagga tydligt om ett bolag är en "value trap" (billigt av goda skäl: strukturellt fallande marginaler, hög skuldsättning, disruptions-risk).

OUTPUT-FORMAT (strikt markdown)
Börja med en kort sektor-sammanfattning (3-4 rader: makro-drivkrafter, aktuella tailwinds/headwinds, värderingsläge vs historik).

Därefter en rankningstabell:
| Rank | Ticker | Bolag | Pris | Fair value | Upside | P/E | PEG | EV/EBITDA | Thesis (en rad) |

Sedan DJUPANALYS per bolag (de 3-5 högst rankade får fullt djup, resten kortare):
### #N TICKER — Bolagsnamn
- **Nuvarande pris:** $X (datum)
- **Fair value:** $Y (metod: DCF / multiple-expansion / sum-of-parts)
- **Upside/downside:** +Z%
- **Värderingsmultiplar:** P/E, PEG, EV/EBITDA, FCF-yield
- **Bull case:** 2-3 meningar — katalysatorer, moat, marginalexpansion
- **Bear case:** 2-3 meningar — största hot mot tesen
- **Key risk:** en mening — den enskilt viktigaste risken
- **Rekommendation:** Strong Buy / Buy / Hold / Avoid (med kort motivering)

Avsluta med en "Portfolio construction"-sektion: förslag på viktning om man skulle bygga en sektor-position av top 5 (ex: 30/25/20/15/10).

REGLER
- Var konkret och siffertung. Generiska fraser som "stark balansräkning" räknas inte — säg Net Debt/EBITDA = 1.2x.
- Om data är osäker eller gammal: säg det explicit ("estimat per Q3 2025, kan vara stale").
- Cross-checka consensus price targets mot din egen DCF — förklara skillnader.
- Jämför ALLTID mot sektor-medianen, inte absoluta värden ("P/E 15" betyder inget utan kontext).
- Flagga redovisningsmässiga red flags: aggressiv capitalization, "adjusted" EBITDA-spread, insider selling, SBC som % av revenue.
- Svara på svenska om användarens prompt är på svenska, annars engelska.
- Detta är INTE personlig investeringsrådgivning. Du är en analytiker som delar ett analysramverk — slutanvändaren ansvarar själv för sina beslut.`;

function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    return { help: true };
  }

  const flags = {
    sector: null,
    count: 10,
    region: 'global',
    marketCap: 'any',
    horizon: 'medium',
  };

  const positionals = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--count') flags.count = parseInt(args[++i], 10);
    else if (a === '--region') flags.region = args[++i];
    else if (a === '--market-cap') flags.marketCap = args[++i];
    else if (a === '--horizon') flags.horizon = args[++i];
    else positionals.push(a);
  }

  flags.sector = positionals.join(' ').trim();
  if (!flags.sector) return { help: true };
  if (!Number.isFinite(flags.count) || flags.count < 3 || flags.count > 25) {
    throw new Error('--count måste vara mellan 3 och 25');
  }
  return flags;
}

function printHelp() {
  process.stdout.write(`
AI Analyst — hittar undervärderade aktier inom en sektor.

Användning:
  node analyst.js <sektor> [flaggor]

Exempel:
  node analyst.js "semiconductors"
  node analyst.js "swedish banks" --count 8 --region nordic
  node analyst.js "renewable energy" --market-cap large --horizon long

Flaggor:
  --count N          Antal aktier att ranka (3-25, default 10)
  --region R         global | us | europe | nordic | asia (default global)
  --market-cap SIZE  any | large | mid | small (default any)
  --horizon H        short | medium | long (default medium)

Miljö:
  ANTHROPIC_API_KEY  krävs
`);
}

function buildUserPrompt(flags) {
  const horizonMap = {
    short: '3-6 månader (taktisk, katalysator-driven)',
    medium: '12-24 månader (fundamental värdering)',
    long: '3-5 år (strukturell tes, compounding)',
  };
  const regionMap = {
    global: 'globalt, alla större börser',
    us: 'USA (NYSE, Nasdaq)',
    europe: 'Europa (LSE, Euronext, Xetra, SIX)',
    nordic: 'Norden (Stockholm, Oslo, Helsingfors, Köpenhamn)',
    asia: 'Asien (Tokyo, HKEX, SSE, KOSPI)',
  };
  const capMap = {
    any: 'alla storlekar',
    large: 'large cap (>$10B market cap)',
    mid: 'mid cap ($2-10B)',
    small: 'small cap ($300M-$2B)',
  };

  return `Sektor: ${flags.sector}
Region: ${regionMap[flags.region] || flags.region}
Market cap: ${capMap[flags.marketCap] || flags.marketCap}
Investeringshorisont: ${horizonMap[flags.horizon] || flags.horizon}
Antal aktier att ranka: ${flags.count}

Kör fullständig analys enligt ditt vanliga ramverk. Använd web_search för att hämta aktuella priser, multiplar och analytiker-consensus. Prioritera senaste kvartalsrapporten (Q3/Q4 2025 eller senare). Leverera tabell + djupanalys + portföljförslag.`;
}

async function main() {
  let flags;
  try {
    flags = parseArgs(process.argv);
  } catch (err) {
    process.stderr.write(`Fel: ${err.message}\n`);
    process.exit(1);
  }

  if (flags.help) {
    printHelp();
    process.exit(0);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    process.stderr.write('Fel: ANTHROPIC_API_KEY saknas. Sätt miljövariabeln först.\n');
    process.exit(1);
  }

  const client = new Anthropic();

  process.stderr.write(`\n→ Analyserar sektor: ${flags.sector}\n`);
  process.stderr.write(`  Region: ${flags.region} | Market cap: ${flags.marketCap} | Horisont: ${flags.horizon}\n`);
  process.stderr.write(`  Hämtar färsk marknadsdata via web search…\n\n`);

  const stream = client.messages.stream({
    model: 'claude-opus-4-7',
    max_tokens: 64000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    system: SYSTEM_PROMPT,
    tools: [
      { type: 'web_search_20260209', name: 'web_search', max_uses: 15 },
      { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 10 },
    ],
    messages: [{ role: 'user', content: buildUserPrompt(flags) }],
  });

  let sawThinking = false;
  let sawText = false;

  for await (const event of stream) {
    if (event.type === 'content_block_start') {
      const block = event.content_block;
      if (block.type === 'thinking' && !sawThinking) {
        process.stderr.write('  [thinking…]\n');
        sawThinking = true;
      } else if (block.type === 'server_tool_use') {
        const query = block.input?.query || block.input?.url || '';
        process.stderr.write(`  [${block.name}: ${query}]\n`);
      } else if (block.type === 'text' && !sawText) {
        process.stderr.write('\n--- ANALYS ---\n\n');
        sawText = true;
      }
    } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      process.stdout.write(event.delta.text);
    }
  }

  const finalMessage = await stream.finalMessage();
  const usage = finalMessage.usage;
  process.stderr.write(
    `\n\n---\nTokens: ${usage.input_tokens} in / ${usage.output_tokens} out` +
      (usage.cache_read_input_tokens ? ` (${usage.cache_read_input_tokens} från cache)` : '') +
      `\nStop reason: ${finalMessage.stop_reason}\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`\nFel: ${err.message}\n`);
  if (err.status) process.stderr.write(`HTTP ${err.status}\n`);
  process.exit(1);
});
