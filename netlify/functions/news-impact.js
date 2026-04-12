// netlify/functions/news-impact.js
// Analyserar en nyhet och returnerar vilka svenska aktier som sannolikt påverkas

const SWEDISH_STOCKS = [
  'Ericsson', 'Volvo', 'H&M', 'Handelsbanken', 'SEB', 'Swedbank', 'Nordea',
  'Atlas Copco', 'Sandvik', 'SKF', 'ABB', 'Hexagon', 'Evolution Gaming',
  'Kinnevik', 'Investor', 'SSAB', 'LKAB', 'Boliden', 'Nibe', 'Alfa Laval',
  'Essity', 'SCA', 'Tele2', 'Telia', 'Sinch', 'Autoliv', 'Electrolux',
  'ICA Gruppen', 'Axfood', 'Hoist Finance', 'Skandia', 'Huddinge',
  'AstraZeneca', 'Sobi', 'Hansa Biopharma',
];

const SYSTEM_PROMPT = `Du är en senior aktieanalytiker med djup kunskap om svenska och nordiska börsen.

Du får en nyhetsrubrik och sammanfattning. Din uppgift är att identifiera vilka svenska börsnoterade bolag som sannolikt påverkas av denna nyhet.

Svara ALLTID med exakt detta JSON-format, inga andra ord:
{
  "stocks": [
    {
      "name": "Bolagsnamn",
      "ticker": "TICKER",
      "exchange": "OMXSTO",
      "direction": "up" | "down" | "neutral",
      "confidence": "high" | "medium" | "low",
      "reason": "Max 10 ord på svenska"
    }
  ],
  "sector": "Sektorn som påverkas mest på svenska",
  "summary": "En mening på svenska om den övergripande marknadseffekten"
}

Regler:
- Returnera MAX 5 aktier
- Fokusera på direkta effekter, inte spekulativa
- Om nyheten inte påverkar svenska aktier, returnera tom array för stocks
- Ticker-format: ERIC_B, VOLV_B, HM_B, SHB_A, SEB_A, NDA_SE, ATCO_A, SAND, SKF_B, ABB, HEXA_B, EVO, KINV_B, INVE_B, SSAB_A, BOL, NIBE_B, ALFA, ESSITY_B, TEL2_B, TELIA, SINCH, ALV, ELUX_B

Känd sektor-påverkan:
- Olja/energi: SSAB, Boliden, SCA
- Räntor: Handelsbanken, SEB, Swedbank, Nordea
- Teknik/halvledare: Ericsson, Hexagon, Sinch
- Fordon/transport: Volvo, SKF, Autoliv, Sandvik
- Hälsa/pharma: AstraZeneca, Sobi
- Konsument: H&M, Electrolux, Axfood, ICA
- Geopolitik/försvar: Saab, Autoliv`;

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

  let headline, summary;
  try {
    const body = JSON.parse(event.body || '{}');
    headline = body.headline;
    summary  = body.summary;
    if (!headline) throw new Error('Rubrik saknas');
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Ogiltigt format' }) };
  }

  const userMessage = `Nyhet:\nRubrik: ${headline}\nSammanfattning: ${summary || 'Ej tillgänglig'}`;

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
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!res.ok) throw new Error(`Anthropic ${res.status}`);

    const data = await res.json();
    const text = data.content?.[0]?.text?.trim() || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Inget JSON');

    const result = JSON.parse(jsonMatch[0]);

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
      body: JSON.stringify(result),
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ stocks: [], sector: null, summary: null }),
    };
  }
};
