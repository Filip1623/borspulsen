/**
 * BörsPulsen — Stock Quote Proxy via Stooq (gratis, ingen API-nyckel)
 *
 * Yahoo Finance blockerar Netlifys datacenter-IP:er (429), därför använder
 * vi Stooq som fungerar server-side. Stooq batchar flera symboler i ETT
 * CSV-anrop.
 *
 * Frontend skickar Yahoo-stil-symboler (VOLV-B.ST, AAPL, ^OMXS30) som
 * konverteras till Stooq-format här.
 *
 * GET /.netlify/functions/quote?symbols=VOLV-B.ST,AAPL,^OMXS30
 */

const { corsHeaders, getOrigin, requireAllowedOrigin, rateLimit, clientIp, tooMany } = require('./lib/security');

const FETCH_TIMEOUT_MS = 8000;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/csv,text/plain,*/*',
};

function isValidSymbol(s) {
  return /^[\w\-\.\^=]{1,20}$/.test(s);
}

// Konverterar en Yahoo-stil-symbol till Stooq-format
function toStooq(yahooSymbol) {
  const s = yahooSymbol.toUpperCase();
  // Index
  const indexMap = {
    '^OMXS30': '^OMXS30',
    '^GSPC':   '^SPX',
    '^IXIC':   '^NDQ',
    '^DJI':    '^DJI',
  };
  if (indexMap[s]) return indexMap[s].toLowerCase().replace('^', '%5E');

  // Aktier med suffix
  if (s.endsWith('.ST')) return s.slice(0, -3).toLowerCase() + '.st'; // Stockholm
  if (s.endsWith('.OL')) return s.slice(0, -3).toLowerCase() + '.no'; // Oslo
  if (s.endsWith('.HE')) return s.slice(0, -3).toLowerCase() + '.fi'; // Helsingfors
  if (s.endsWith('.DE')) return s.slice(0, -3).toLowerCase() + '.de'; // Xetra

  // USA – inget suffix i Yahoo → .us i Stooq
  return s.toLowerCase() + '.us';
}

// Bygg en omvänd map: Stooq-symbol (uppercase) → original Yahoo-symbol
function buildReverseMap(yahooSymbols) {
  const map = {};
  for (const y of yahooSymbols) {
    map[toStooq(y).toUpperCase()] = y;
  }
  return map;
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

// Parsar Stooq CSV-svar
// Format: Symbol,Date,Time,Open,High,Low,Close,Volume
function parseStooqCsv(csv, reverseMap) {
  const quotes = {};
  const errors = [];
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return { quotes, errors: ['tomt CSV-svar'] };

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 8) continue;
    const [stooqSym, date, time, open, high, low, close, volume] = cols;
    const yahooSym = reverseMap[stooqSym.toUpperCase()] || stooqSym;

    const closeNum = parseFloat(close);
    const openNum  = parseFloat(open);
    if (!isFinite(closeNum) || close === 'N/D' || closeNum === 0) {
      errors.push(`${yahooSym} → ingen data`);
      continue;
    }

    // Dagsförändring uppskattas från open (Stooq light-quote saknar prev close)
    const change    = isFinite(openNum) && openNum > 0 ? closeNum - openNum : 0;
    const changePct = isFinite(openNum) && openNum > 0 ? (change / openNum) * 100 : 0;

    quotes[yahooSym] = {
      symbol:    yahooSym,
      price:     closeNum,
      open:      isFinite(openNum) ? openNum : null,
      high:      parseFloat(high) || null,
      low:       parseFloat(low) || null,
      change,
      changePct,
      volume:    parseInt(volume, 10) || null,
      asof:      `${date} ${time}`,
    };
  }
  return { quotes, errors };
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

  const reverseMap = buildReverseMap(symbols);
  const stooqSymbols = symbols.map(toStooq).join('%7C'); // pipe-separated: Stooq batch format
  const url = `https://stooq.com/q/l/?s=${stooqSymbols}&f=sd2t2ohlcv&h&e=csv`;

  try {
    const res = await fetchWithTimeout(url, { headers: HEADERS });
    if (!res.ok) {
      const txt = await res.text();
      console.error('Stooq error:', res.status, txt.slice(0, 200));
      return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: `Stooq: ${res.status}`, hits: 0, total: symbols.length }) };
    }

    const csv = await res.text();
    const { quotes, errors } = parseStooqCsv(csv, reverseMap);
    const hits = Object.keys(quotes).length;

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' },
      body: JSON.stringify({ quotes, ts: Date.now(), hits, total: symbols.length, errors: errors.slice(0, 8), source: 'stooq' }),
    };
  } catch (err) {
    console.error('quote.js error:', err.message);
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'Kunde inte hämta marknadsdata', hits: 0, total: symbols.length }) };
  }
};
