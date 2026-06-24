/**
 * BörsPulsen — AI-fördjupning per NEXUS-1-innehav
 *
 * POST /.netlify/functions/holding-explain
 * Body: { ticker, name, sector, score, strategy, pl, weight,
 *         rsi, volatility, contribs, summary }
 */

const { corsHeaders, getOrigin, requireAllowedOrigin, rateLimit, clientIp, tooMany } = require('./lib/security');

const SYSTEM_PROMPT = `Du är NEXUS-1:s inbyggda analysmotor på BörsPulsen — en avancerad AI-portföljförvaltare.
Din uppgift är att ge en kort men insiktsfull fördjupningsanalys av ett specifikt innehav i portföljen.

Skriv alltid på svenska. Var direkt, kunnig och nyanserad.
Undvik generiska fraser. Lyft fram det som faktiskt är intressant med just denna situation.
Max 3 korta stycken. Inga rubriker. Ingen lista. Inga asterisker.
Avsluta inte med "Kom ihåg" eller standardfraser om riskhantering.
Du är inte en finansiell rådgivare — men du låtsas inte heller vara det. Du är en AI-portföljmodell som förklarar sitt resonemang.`;

exports.handler = async function (event) {
  const origin = getOrigin(event);
  const CORS = corsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  if (!requireAllowedOrigin(origin)) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Otillåten ursprungsdomän' }) };

  const rl = rateLimit(`explain:${clientIp(event)}`, { limit: 20, windowMs: 60000 });
  if (!rl.ok) return tooMany(CORS, rl.retryAfter);

  if ((event.body || '').length > 3000) return { statusCode: 413, headers: CORS, body: JSON.stringify({ error: 'Payload för stor' }) };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'AI ej konfigurerad' }) };

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Ogiltig JSON' }) }; }

  const { ticker, name, sector, score, strategy, pl, weight, rsi, volatility, contribs = [], summary } = payload;
  if (!ticker || !name) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Saknar ticker/name' }) };

  const topPos = contribs.filter(c => c.c > 0.01).slice(0, 3).map(c => `${c.k} (${c.c > 0 ? '+' : ''}${c.c.toFixed(2)}): ${c.d}`).join('; ');
  const topNeg = contribs.filter(c => c.c < -0.01).slice(0, 2).map(c => `${c.k} (${c.c.toFixed(2)}): ${c.d}`).join('; ');

  const userMsg = `Innehav: ${name} (${ticker}), sektor: ${sector}
Strategi: ${strategy} | Signalpoäng: ${score}/100
Portföljvikt: ${weight}% | Avkastning sedan köp: ${pl >= 0 ? '+' : ''}${pl}%
RSI: ${rsi} | Dagsvolatilitet: ${volatility}%
Positiva signaler: ${topPos || 'inga starka'}
Negativa signaler: ${topNeg || 'inga starka'}
NEXUS-1 sammanfattning: ${summary}

Ge en fördjupad analys av detta innehav och varför NEXUS-1 håller det just nu. Lyft fram det mest intressanta.`;

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
        messages: [{ role: 'user', content: userMsg }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Anthropic error:', err);
      return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'AI svarade inte' }) };
    }

    const data = await res.json();
    const analysis = data.content?.[0]?.text || '';
    return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ analysis }) };
  } catch (err) {
    console.error('holding-explain error:', err);
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'Nätverksfel mot AI' }) };
  }
};
