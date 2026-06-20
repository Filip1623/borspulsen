/**
 * BörsPulsen — Stock Quote Proxy
 *
 * Använder Yahoo Finance v8/chart-endpointen som INTE kräver crumb.
 * Hämtar symboler parallellt med timeout per symbol.
 *
 * GET /.netlify/functions/quote?symbols=VOLV-B.ST,AAPL,^OMXS30
 */

const { corsHeaders, getOrigin, requireAllowedOrigin, rateLimit, clientIp, tooMany } = require('./lib/security');

const FETCH_TIMEOUT_MS = 5000;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://finance.yahoo.com',
  'Referer': 'https://finance.yahoo.com/',
};

function isValidSymbol(s) {
  return /^[\w\-\.\^=]{1,20}$/.test(s);
}

async function fetchWithTimeout(url, opts = {}, ms = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function fetchOneSymbol(symbol) {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d&includePrePost=false`;
  try {
    const res = await fetchWithTimeout(url, { headers: HEADERS });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta || !meta.regularMarketPrice) return null;
    return {
      symbol,
      price:     meta.regularMarketPrice,
      prevClose: meta.chartPreviousClose ?? meta.previousClose ?? null,
      change:    meta.regularMarketPrice - (meta.chartPreviousClose ?? meta.previousClose ?? meta.regularMarketPrice),
      changePct: meta.chartPreviousClose
        ? ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100
        : 0,
      volume:    meta.regularMarketVolume ?? null,
      currency:  meta.currency ?? null,
      state:     meta.marketState ?? null,
    };
  } catch {
    return null;
  }
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
  if (!rawSymbols) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'symbol/symbols saknas' }) };

  const symbols = rawSymbols.split(',').map(s => s.trim()).filter(s => isValidSymbol(s)).slice(0, 20);
  if (!symbols.length) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Inga giltiga symboler' }) };

  // Hämta alla symboler parallellt
  const results = await Promise.all(symbols.map(fetchOneSymbol));

  const quotes = {};
  for (const r of results) {
    if (r) quotes[r.symbol] = r;
  }

  const hitCount = Object.keys(quotes).length;

  return {
    statusCode: 200,
    headers: {
      ...CORS,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=30',
    },
    body: JSON.stringify({ quotes, ts: Date.now(), hits: hitCount, total: symbols.length }),
  };
};
