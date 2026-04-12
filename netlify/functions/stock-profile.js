// netlify/functions/stock-profile.js
// Hämtar bolagsprofil, aktuell kurs och bolagsnyheter från Finnhub

exports.handler = async function (event) {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  const token = process.env.Finnhub_Token || process.env.FINNHUB_TOKEN;
  if (!token) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Token saknas' }) };

  const symbol = event.queryStringParameters?.symbol;
  if (!symbol) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Symbol saknas' }) };

  try {
    const base = 'https://finnhub.io/api/v1';
    const [profileRes, quoteRes, newsRes, metricsRes] = await Promise.all([
      fetch(`${base}/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${token}`),
      fetch(`${base}/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`),
      fetch(`${base}/company-news?symbol=${encodeURIComponent(symbol)}&from=${getFromDate()}&to=${getToDate()}&token=${token}`),
      fetch(`${base}/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${token}`),
    ]);

    const [profile, quote, newsRaw, metricsData] = await Promise.all([
      profileRes.json(),
      quoteRes.json(),
      newsRes.json(),
      metricsRes.json(),
    ]);

    const metrics = metricsData?.metric || {};

    const news = Array.isArray(newsRaw)
      ? newsRaw.filter(n => n.headline && n.url).slice(0, 6).map(n => ({
          title:   n.headline,
          summary: n.summary || '',
          source:  n.source,
          url:     n.url,
          image:   n.image || '',
          time:    n.datetime,
        }))
      : [];

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
      body: JSON.stringify({ profile, quote, news, metrics }),
    };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};

function getFromDate() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
}
function getToDate() {
  return new Date().toISOString().split('T')[0];
}
