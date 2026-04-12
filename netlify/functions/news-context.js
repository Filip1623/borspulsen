// netlify/functions/news-context.js
// Analyserar nyhetsrubriker med Claude och returnerar vilket instrument som påverkas mest

const SYSTEM_PROMPT = `Du är en erfaren finansanalytiker specialiserad på hur nyheter påverkar finansiella marknader.

Du får ett antal nyhetsrubriker och ska identifiera VILKET finansiellt instrument som sannolikt påverkas mest av nyheterna just nu.

Svara ALLTID med exakt detta JSON-format utan markdown eller extra text:
{
  "symbol": "EXCHANGE:TICKER",
  "name": "Instrumentets namn på svenska",
  "reason": "Kort förklaring på svenska, max 15 ord",
  "confidence": "high" | "medium" | "low"
}

TradingView-symboler att använda:
- Råolja (WTI): NYMEX:CL1!
- Guld: COMEX:GC1!
- Silver: COMEX:SI1!
- OMXS30: OMXSTO:OMXS30
- OMXS30 (default): OMXSTO:OMXS30
- S&P 500: SP:SPX
- NASDAQ: NASDAQ:NDX
- Dow Jones: DJ:DJI
- EUR/USD: FX:EURUSD
- USD/SEK: FX:USDSEK
- EUR/SEK: FX:EURSEK
- Bitcoin: BITSTAMP:BTCUSD
- Ericsson: OMXSTO:ERIC_B
- Volvo B: OMXSTO:VOLV_B
- Handelsbanken: OMXSTO:SHB_A
- H&M: OMXSTO:HM_B
- Atlas Copco: OMXSTO:ATCO_A
- Nordea: OMXSTO:NDA_SE
- ABB: OMXSTO:ABB
- Hexagon: OMXSTO:HEXA_B
- Riksbank/ränta: OMXSTO:OMXS30
- Naturgas: NYMEX:NG1!
- Koppar: COMEX:HG1!
- Vete: CBOT:ZW1!

Om nyheterna inte tydligt pekar på ett specifikt instrument, returnera OMXS30 som default med "low" confidence.
Prioritera alltid svenska/nordiska instrument om relevant.`;

exports.handler = async function (event) {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Metod ej tillåten' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'API-nyckel saknas' }) };
  }

  let headlines;
  try {
    const body = JSON.parse(event.body || '{}');
    headlines = body.headlines;
    if (!Array.isArray(headlines) || headlines.length === 0) {
      throw new Error('Inga rubriker');
    }
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Ogiltigt format' }) };
  }

  // Begränsa till max 8 rubriker
  const headlineText = headlines.slice(0, 8).map((h, i) => `${i + 1}. ${h}`).join('\n');

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Nyhetsrubriker just nu:\n${headlineText}` }],
      }),
    });

    if (!res.ok) throw new Error(`Anthropic svarade ${res.status}`);

    const data = await res.json();
    const text = data.content?.[0]?.text?.trim() || '';

    // Extrahera JSON från svaret
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Inget JSON i svaret');

    const result = JSON.parse(jsonMatch[0]);

    // Validera att vi fick rätt fält
    if (!result.symbol || !result.name || !result.reason) {
      throw new Error('Ofullständigt svar');
    }

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=120' },
      body: JSON.stringify(result),
    };
  } catch (err) {
    // Fallback till OMXS30
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: 'OMXSTO:OMXS30',
        name: 'OMXS30',
        reason: 'Visar Stockholmsbörsens huvudindex',
        confidence: 'low',
      }),
    };
  }
};
