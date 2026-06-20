/**
 * BörsPulsen — Yahoo Finance Quote Proxy med crumb-autentisering
 *
 * Yahoo Finance kräver sedan 2024 en crumb-cookie för server-side API-anrop.
 * Denna funktion hämtar crumb automatiskt och cacchar den i minnet.
 *
 * GET /.netlify/functions/quote?symbols=VOLV-B.ST,ERIC-B.ST,^OMXS30
 */

const { corsHeaders, getOrigin, requireAllowedOrigin, rateLimit, clientIp, tooMany } = require('./lib/security');

// Crumb-cache (in-memory per Lambda-container)
let _crumb = null;
let _cookie = null;
let _crumbTs = 0;
const CRUMB_TTL = 55 * 60 * 1000; // 55 minuter

const BASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
};

async function fetchCrumb() {
  // Steg 1: Hämta consent-cookie från Yahoo
  const consentRes = await fetch('https://fc.yahoo.com', {
    headers: BASE_HEADERS,
    redirect: 'follow',
  });
  const rawCookie = consentRes.headers.get('set-cookie') || '';
  // Extrahera A3/A1-cookie
  const cookieMatch = rawCookie.match(/A3=[^;]+/) || rawCookie.match(/A1=[^;]+/);
  const cookie = cookieMatch ? cookieMatch[0] : 'A3=d=AQABBMQ7Zl8CELp2SRXwZj9gQzY8mYg&S=AQAAAi';

  // Steg 2: Hämta crumb med cookie
  const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
    headers: {
      ...BASE_HEADERS,
      'Cookie': cookie,
      'Accept': 'text/plain',
    },
  });
  if (!crumbRes.ok) throw new Error(`Crumb fetch failed: ${crumbRes.status}`);
  const crumb = (await crumbRes.text()).trim();
  if (!crumb || crumb.includes('<')) throw new Error('Invalid crumb response');

  return { crumb, cookie };
}

async function getCrumb() {
  const now = Date.now();
  if (_crumb && _cookie && now - _crumbTs < CRUMB_TTL) {
    return { crumb: _crumb, cookie: _cookie };
  }
  const result = await fetchCrumb();
  _crumb = result.crumb;
  _cookie = result.cookie;
  _crumbTs = now;
  return result;
}

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
  if (!rawSymbols) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'symbol/symbols saknas' }) };

  const symbols = rawSymbols.split(',').map(s => s.trim()).filter(s => isValidSymbol(s)).slice(0, 20);
  if (!symbols.length) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Inga giltiga symboler' }) };

  try {
    const { crumb, cookie } = await getCrumb();
    const joined = symbols.map(encodeURIComponent).join('%2C');
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${joined}&crumb=${encodeURIComponent(crumb)}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketPreviousClose,regularMarketOpen,regularMarketDayHigh,regularMarketDayLow,regularMarketVolume,shortName,currency,marketState`;

    const res = await fetch(url, {
      headers: {
        ...BASE_HEADERS,
        'Cookie': cookie,
        'Accept': 'application/json',
        'Referer': 'https://finance.yahoo.com/',
      },
    });

    if (!res.ok) {
      // Rensa crumb-cache vid auth-fel så nästa anrop hämtar nytt
      if (res.status === 401 || res.status === 403) {
        _crumb = null;
        _cookie = null;
      }
      const txt = await res.text();
      console.error('Yahoo Finance error:', res.status, txt.slice(0, 300));
      return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: `Yahoo Finance: ${res.status}` }) };
    }

    const data = await res.json();
    const results = data?.quoteResponse?.result || [];

    const quotes = {};
    for (const r of results) {
      quotes[r.symbol] = {
        symbol:    r.symbol,
        name:      r.shortName || r.symbol,
        price:     r.regularMarketPrice ?? null,
        change:    r.regularMarketChange ?? null,
        changePct: r.regularMarketChangePercent ?? null,
        prevClose: r.regularMarketPreviousClose ?? null,
        open:      r.regularMarketOpen ?? null,
        high:      r.regularMarketDayHigh ?? null,
        low:       r.regularMarketDayLow ?? null,
        volume:    r.regularMarketVolume ?? null,
        currency:  r.currency ?? null,
        state:     r.marketState ?? null,
      };
    }

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' },
      body: JSON.stringify({ quotes, ts: Date.now(), crumbOk: true }),
    };
  } catch (err) {
    console.error('quote.js error:', err.message);
    // Rensa crumb-cache vid fel
    _crumb = null;
    _cookie = null;
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'Kunde inte hämta marknadsdata' }) };
  }
};
