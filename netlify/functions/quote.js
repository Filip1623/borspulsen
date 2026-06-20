/**
 * BörsPulsen — Yahoo Finance Quote Proxy
 *
 * Hämtar realtidspriser via Yahoo Finance (gratis, ingen API-nyckel).
 * Stöder enskilda symboler och batch-anrop (kommaseparerade).
 *
 * GET /.netlify/functions/quote?symbol=VOLV-B.ST
 * GET /.netlify/functions/quote?symbols=VOLV-B.ST,ERIC-B.ST,^OMXS30
 */

const { corsHeaders, getOrigin, requireAllowedOrigin, rateLimit, clientIp, tooMany } = require('./lib/security');

const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; BörsPulsen/1.0)',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

// Tillåtna symbol-prefix för grundläggande validering
function isValidSymbol(s) {
  return /^[\w\-\.\^=]{1,20}$/.test(s);
}

exports.handler = async function (event) {
  const origin = getOrigin(event);
  const CORS = corsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  if (!requireAllowedOrigin(origin)) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Otillåten ursprungsdomän' }) };

  const rl = rateLimit(`quote:${clientIp(event)}`, { limit: 60, windowMs: 60000 });
  if (!rl.ok) return tooMany(CORS, rl.retryAfter);

  const params = event.queryStringParameters || {};
  const rawSymbols = (params.symbols || params.symbol || '').trim();

  if (!rawSymbols) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'symbol/symbols saknas' }) };
  }

  const symbols = rawSymbols.split(',').map(s => s.trim()).filter(s => isValidSymbol(s)).slice(0, 20);
  if (!symbols.length) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Inga giltiga symboler' }) };
  }

  const joined = symbols.map(encodeURIComponent).join('%2C');
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${joined}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketPreviousClose,regularMarketOpen,regularMarketDayHigh,regularMarketDayLow,regularMarketVolume,shortName,longName,currency,marketState`;

  try {
    const resp = await fetch(url, { headers: YAHOO_HEADERS });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error('Yahoo Finance error:', resp.status, txt.slice(0, 200));
      return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'Yahoo Finance svarade med fel' }) };
    }

    const data = await resp.json();
    const results = data?.quoteResponse?.result || [];

    // Normalisera till ett enkelt format
    const quotes = {};
    for (const r of results) {
      quotes[r.symbol] = {
        symbol: r.symbol,
        name: r.shortName || r.longName || r.symbol,
        price: r.regularMarketPrice ?? null,
        change: r.regularMarketChange ?? null,
        changePct: r.regularMarketChangePercent ?? null,
        prevClose: r.regularMarketPreviousClose ?? null,
        open: r.regularMarketOpen ?? null,
        high: r.regularMarketDayHigh ?? null,
        low: r.regularMarketDayLow ?? null,
        volume: r.regularMarketVolume ?? null,
        currency: r.currency ?? null,
        marketState: r.marketState ?? null,
      };
    }

    return {
      statusCode: 200,
      headers: {
        ...CORS,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30',
      },
      body: JSON.stringify({ quotes, ts: Date.now() }),
    };
  } catch (err) {
    console.error('quote.js error:', err);
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'Nätverksfel mot Yahoo Finance' }) };
  }
};
