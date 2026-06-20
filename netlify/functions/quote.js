/**
 * BörsPulsen — Stock Quote Proxy (server-side)
 *
 * Browsern kan inte anropa Yahoo Finance direkt (ingen CORS-header),
 * därför proxas allt via denna funktion (same-origin).
 *
 * Primärkälla: Yahoo Finance v8/chart (query1 → query2 fallback)
 * Returnerar diagnostik (hits/total/errors) för felsökning.
 *
 * GET /.netlify/functions/quote?symbols=VOLV-B.ST,AAPL,^OMXS30
 */

const { corsHeaders, getOrigin, requireAllowedOrigin, rateLimit, clientIp, tooMany } = require('./lib/security');

const FETCH_TIMEOUT_MS = 6000;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json,text/plain,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com/',
  'Origin': 'https://finance.yahoo.com',
};

function isValidSymbol(s) {
  return /^[\w\-\.\^=]{1,20}$/.test(s);
}

async function fetchWithTimeout(url, opts = {}, ms = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

function parseChart(symbol, data) {
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta || meta.regularMarketPrice == null) return null;
  const prev = meta.chartPreviousClose ?? meta.previousClose ?? meta.regularMarketPrice;
  return {
    symbol,
    price:     meta.regularMarketPrice,
    prevClose: prev,
    change:    meta.regularMarketPrice - prev,
    changePct: prev ? ((meta.regularMarketPrice - prev) / prev) * 100 : 0,
    volume:    meta.regularMarketVolume ?? null,
    currency:  meta.currency ?? null,
    state:     meta.marketState ?? null,
  };
}

// Försöker query1 först, sen query2
async function fetchYahooChart(symbol) {
  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  let lastErr = null;
  for (const host of hosts) {
    try {
      const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d&includePrePost=false`;
      const res = await fetchWithTimeout(url, { headers: HEADERS });
      if (!res.ok) { lastErr = `${host}:${res.status}`; continue; }
      const data = await res.json();
      const parsed = parseChart(symbol, data);
      if (parsed) return { quote: parsed, err: null };
      lastErr = `${host}:empty`;
    } catch (e) {
      lastErr = `${host}:${e.name === 'AbortError' ? 'timeout' : 'neterr'}`;
    }
  }
  return { quote: null, err: lastErr };
}

exports.handler = async function (event) {
  const origin = getOrigin(event);
  const CORS = corsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  if (!requireAllowedOrigin(origin)) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Otillåten ursprungsdomän' }) };

  const rl = rateLimit(`quote:${clientIp(event)}`, { limit: 80, windowMs: 60000 });
  if (!rl.ok) return tooMany(CORS, rl.retryAfter);

  const params = event.queryStringParameters || {};
  const rawSymbols = (params.symbols || params.symbol || '').trim();
  if (!rawSymbols) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'symbol/symbols saknas' }) };

  const symbols = rawSymbols.split(',').map(s => s.trim()).filter(s => isValidSymbol(s)).slice(0, 20);
  if (!symbols.length) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Inga giltiga symboler' }) };

  const settled = await Promise.all(symbols.map(fetchYahooChart));

  const quotes = {};
  const errors = [];
  for (let i = 0; i < settled.length; i++) {
    if (settled[i].quote) quotes[settled[i].quote.symbol] = settled[i].quote;
    else if (settled[i].err) errors.push(`${symbols[i]} → ${settled[i].err}`);
  }

  const hits = Object.keys(quotes).length;

  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=20' },
    body: JSON.stringify({
      quotes,
      ts: Date.now(),
      hits,
      total: symbols.length,
      errors: errors.slice(0, 5), // diagnostik
    }),
  };
};
