/**
 * BörsPulsen — Finnhub Quote Proxy
 *
 * Proxar prisanrop till Finnhub så att API-nyckeln aldrig
 * exponeras i frontend-källkoden.
 *
 * Miljövariabel som krävs i Netlify Dashboard:
 *   FINNHUB_TOKEN = din_finnhub_api_nyckel
 *
 * Anropas av frontend som:
 *   GET /.netlify/functions/quote?symbol=VOLV-B.ST
 */

// Tillåtna Finnhub-symboler (whitelist för att förhindra missbruk)
const ALLOWED_SYMBOLS = new Set([
  'VOLV-B.ST','ERIC-B.ST','HM-B.ST','ATCO-A.ST','INVE-B.ST','SEB-A.ST',
  'NDA-SE.ST','SHB-A.ST','ABB.ST','SAND.ST','SKF-B.ST','SSAB-A.ST',
  'BOL.ST','TEL2-B.ST','HEXA-B.ST','ALFA.ST','EVO.ST','KINV-B.ST',
  'ESSITY-B.ST','SWMA.ST','ALV.ST','GETI-B.ST','HPOL-B.ST','NIBE-B.ST',
  'EKTA-B.ST','AXFO.ST','CLAS-B.ST','ADDT-B.ST','INDT.ST','BIL-A.ST',
  'BEIJ-B.ST','BILL.ST','HUSQ-B.ST','SAGA-D.ST','BALD-B.ST',
]);

exports.handler = async function (event) {
  // Endast GET tillåtet
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const symbol = event.queryStringParameters?.symbol;

  // Validera symbol mot whitelist
  if (!symbol || !ALLOWED_SYMBOLS.has(symbol)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Ogiltig eller ej tillåten symbol' }),
    };
  }

  const token = process.env.Finnhub_Token || process.env.FINNHUB_TOKEN;
  if (!token) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'API-nyckel saknas på servern' }),
    };
  }

  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`;
    const resp = await fetch(url);

    if (!resp.ok) {
      return { statusCode: resp.status, body: JSON.stringify({ error: 'Finnhub svarade med fel' }) };
    }

    const data = await resp.json();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30', // cacha 30 sekunder
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: 'Kunde inte nå Finnhub' }),
    };
  }
};
