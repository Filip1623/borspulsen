/**
 * BörsPulsen — AI-Chat via Claude (Anthropic)
 *
 * Tar emot en fråga från användaren om börsen och svarar
 * med hjälp av Claude API. API-nyckeln hanteras säkert
 * som miljövariabel och exponeras aldrig i frontend.
 *
 * Miljövariabel som krävs i Netlify Dashboard:
 *   ANTHROPIC_API_KEY = din_anthropic_api_nyckel
 *
 * Anropas av frontend som:
 *   POST /.netlify/functions/ai-chat
 *   Body: { "question": "Varför gick Volvo ner idag?" }
 */

const SYSTEM_PROMPT = `Du är BörsPulsens AI-assistent — en kunnig och vänlig börsexpert som hjälper svenska investerare.

Du har djup kunskap om:
- Svenska börsen (OMXS30, Stockholmsbörsen, NGM, Spotlight)
- Nordiska aktier: Sverige, Norge, Finland, Danmark
- Internationella marknader: USA (S&P 500, Nasdaq, Dow Jones), Europa, Asien
- Makroekonomi: räntor, inflation, valuta, råvaror
- Bolagsanalys: P/E-tal, EPS, direktavkastning, P/B-tal, EBITDA
- Teknisk analys: trender, stöd/motstånd, RSI, MACD
- Fundamentalanalys och värdering
- Insynshandel och blankning (Finansinspektionen)
- Utdelningar och utdelningskalender
- IPO:er och nyemissioner på den svenska marknaden

Svara alltid på svenska om inte användaren skriver på engelska.
Var konkret, pedagogisk och undvik finansiell jargong utan förklaring.
Håll svaren fokuserade — max 3-4 korta stycken om inget annat behövs.
Avsluta aldrig med "Kom ihåg att..." eller liknande standardfraser.
Du är INTE en licensierad finansiell rådgivare och kan inte ge personliga investeringsrekommendationer.`;

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'AI-tjänsten är inte konfigurerad' }) };
  }

  let question;
  try {
    const body = JSON.parse(event.body || '{}');
    question = (body.question || '').trim();
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Ogiltig förfrågan' }) };
  }

  if (!question || question.length < 2) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Frågan är för kort' }) };
  }
  if (question.length > 500) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Frågan är för lång (max 500 tecken)' }) };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: question }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic API error:', err);
      return { statusCode: 502, body: JSON.stringify({ error: 'AI-tjänsten svarade inte korrekt' }) };
    }

    const data = await response.json();
    const answer = data.content?.[0]?.text || '';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer }),
    };
  } catch (err) {
    console.error('AI-chat error:', err);
    return { statusCode: 502, body: JSON.stringify({ error: 'Kunde inte nå AI-tjänsten' }) };
  }
};
