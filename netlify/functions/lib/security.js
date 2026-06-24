/**
 * BörsPulsen — Delad säkerhetsmodul för Netlify Functions
 * CORS-allowlist, rate limiting (token bucket), IP-extraktion
 */

const ALLOWED_ORIGINS = [
  'https://borspulsen.com',
  'https://www.borspulsen.com',
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Tillåt Netlify deploy-previews
  if (/^https:\/\/[a-z0-9-]+--verdant-souffle-b10db3\.netlify\.app$/.test(origin)) return true;
  return false;
}

function getOrigin(event) {
  return (event.headers && (event.headers.origin || event.headers.Origin)) || '';
}

function corsHeaders(origin) {
  const allowed = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function requireAllowedOrigin(origin) {
  // Same-origin GET-anrop från browsern skickar INGEN Origin-header.
  // Saknad origin = same-origin (eller server-till-server) → tillåt.
  // Endast närvarande men ej tillåten origin blockeras (cross-site hotlinking).
  if (!origin) return true;
  return isAllowedOrigin(origin);
}

// In-memory token bucket rate limiter (per warm Lambda container)
const buckets = {};
function rateLimit(key, { limit = 30, windowMs = 60000 } = {}) {
  const now = Date.now();
  if (!buckets[key] || now - buckets[key].ts > windowMs) {
    buckets[key] = { ts: now, count: 0 };
  }
  buckets[key].count++;
  const ok = buckets[key].count <= limit;
  const retryAfter = ok ? 0 : Math.ceil((windowMs - (now - buckets[key].ts)) / 1000);
  return { ok, retryAfter };
}

function clientIp(event) {
  const h = event.headers || {};
  return h['x-nf-client-connection-ip'] || h['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
}

function tooMany(headers, retryAfter = 60) {
  return {
    statusCode: 429,
    headers: { ...headers, 'Retry-After': String(retryAfter), 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'För många förfrågningar – försök igen om en stund.' }),
  };
}

module.exports = { ALLOWED_ORIGINS, isAllowedOrigin, getOrigin, corsHeaders, requireAllowedOrigin, rateLimit, clientIp, tooMany };
