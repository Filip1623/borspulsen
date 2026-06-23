/**
 * BörsPulsen — AI-Chat via Claude (Anthropic)
 *
 * En allmänbildad AI-assistent med spetskompetens inom börs och ekonomi.
 * Får live-marknadsdata och konversationshistorik från frontend.
 * Stödjer valfritt djupanalys-läge per aktie: analys | risk
 *
 * Miljövariabel som krävs i Netlify Dashboard:
 *   ANTHROPIC_API_KEY = din_anthropic_api_nyckel
 *
 * Anropas av frontend som:
 *   POST /.netlify/functions/ai-chat
 *   Body: {
 *     "question": "...",
 *     "history":  [...],
 *     "context":  { "indices": [...], "stocks": [...] },
 *     "mode":     "analys"
 *   }
 */

const { corsHeaders, getOrigin, requireAllowedOrigin, rateLimit, clientIp, tooMany } = require('./lib/security');

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1024;
const MAX_HISTORY = 10;

const SYSTEM_PROMPT = `Du är BörsPulsens AI-assistent — en skarp, hjälpsam och bred AI som är expert på börs och ekonomi men som även kan svara på frågor om i stort sett vad som helst.

## Din kärnkompetens (din specialitet)
- Svenska börsen (OMXS30, Stockholmsbörsen, First North, NGM, Spotlight)
- Nordiska aktier: Sverige, Norge, Finland, Danmark
- Internationella marknader: USA (S&P 500, Nasdaq, Dow Jones), Europa, Asien
- Makroekonomi: räntor, inflation, valutor, råvaror, centralbanker (Riksbanken, Fed, ECB)
- Bolagsanalys: P/E, EPS, direktavkastning, P/B, EV/EBITDA, kassaflöde, soliditet
- Teknisk analys: trender, stöd/motstånd, RSI, MACD, glidande medelvärden, volym
- Fundamentalanalys, värdering och portföljteori (diversifiering, risk, Sharpe-kvot)
- Kryptovalutor, fonder, ETF:er, optioner, terminer, certifikat
- Skatt på aktier i Sverige (ISK, kapitalförsäkring, aktie- och fondkonto, reavinst)
- Insynshandel, blankning, utdelningar, IPO:er och nyemissioner

## Bredd utöver finans
Du kan också svara på allmänna frågor — historia, teknik, vetenskap, språk, vardagsfrågor,
matematik, programmering, m.m. Var lika hjälpsam där som inom finans.

## Stil och format
- Svara på svenska om inte användaren skriver på ett annat språk.
- Var konkret, pedagogisk och förklara facktermer kort första gången de används.
- Använd gärna punktlistor och **fet text** för struktur när det hjälper läsbarheten.
- Anpassa längden efter frågan: korta frågor → korta svar; komplexa frågor → mer djup.
- Hänvisa till live-marknadsdatan nedan när den är relevant för frågan.
- Avsluta inte med tomma standardfraser som "Kom ihåg att...".

## Viktigt
Du är INTE en licensierad finansiell rådgivare. Du kan resonera kring aktier, risker och
strategier på ett utbildande sätt, men ge inte personliga "köp/sälj"-order.`;

const ANALYSIS_FRAMEWORKS = {
  analys: `LÄGE: Värdering & Analys (institutionell nivå). Agera som senior equity-analytiker.
Ge en samlad men koncis analys med tydliga rubriker (korta punktlistor, inte långa stycken):
- Värdering i kontext: P/E, P/S, P/B vs sektorgenomsnitt
- Tillväxt & lönsamhet: intäktstrend, marginaler, EPS-utveckling
- DCF-light: viktigaste antaganden, WACC, uppskattat intrinsiskt värde vs aktuell kurs
- Resultat: historik vs förväntningar, ledningens guidance, typiska kursreaktioner vid rapport
- Konkurrensmässig vallgrav (moat)
- Tjur- och björn-scenario med indikativa riktkurser
- Slutsats: övervärderad / rimligt värderad / undervärderad + riskpoäng (1–10)`,

  risk: `LÄGE: Risk & Portfölj. Agera som riskanalytiker och portföljstrateg.
Ge en samlad men koncis analys med tydliga rubriker (korta punktlistor, inte långa stycken):
- Sektor- och koncentrationsrisk samt geografisk exponering
- Ränte- och konjunkturkänslighet
- Recessions-stresstest: hur klarar bolaget en nedgång
- Likviditet och balansräkningsstyrka
- Portföljroll: kärna vs satellit, hur den kompletterar en diversifierad portfölj
- Resonemang om positionsstorlek och tänkbar drawdown
- Möjliga hedging-strategier
- Praktiskt: skatteeffektivt ägande (ISK/KF), rebalansering och DCA (månadssparande)`,
};

function isValidRole(r) { return r === 'user' || r === 'assistant'; }

function buildMarketContext(context) {
  if (!context || typeof context !== 'object') return '';
  const parts = [];
  if (Array.isArray(context.indices) && context.indices.length) {
    const idx = context.indices.slice(0, 10).map(i => {
      const chg = typeof i.change === 'number' ? (i.change >= 0 ? '+' : '') + i.change : i.change;
      return `${i.name}: ${i.value} (${chg})`;
    }).join(', ');
    parts.push(`Index just nu: ${idx}`);
  }
  if (Array.isArray(context.stocks) && context.stocks.length) {
    const rows = context.stocks.slice(0, 60).map(s => {
      const pct = typeof s.changePct === 'number' ? (s.changePct >= 0 ? '+' : '') + s.changePct.toFixed(2) + '%' : '';
      return `${s.name} (${s.ticker}): ${s.price} ${s.currency || ''} ${pct}`.trim();
    }).join('\n');
    parts.push(`Aktiekurser just nu (urval):\n${rows}`);
  }
  if (!parts.length) return '';
  return `\n\n## Live-marknadsdata (snapshot från sidan, kan vara fördröjd)\n${parts.join('\n\n')}`;
}

exports.handler = async function (event) {
  const origin = getOrigin(event);
  const CORS = corsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  if (!requireAllowedOrigin(origin)) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Otillåten ursprungsdomän' }) };

  const rl = rateLimit(`ai:${clientIp(event)}`, { limit: 20, windowMs: 60000 });
  if (!rl.ok) return tooMany(CORS, rl.retryAfter);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'AI-tjänsten är inte konfigurerad' }) };

  let question, history, context, mode;
  try {
    const body = JSON.parse(event.body || '{}');
    question = (body.question || '').trim();
    history = Array.isArray(body.history) ? body.history : [];
    context = body.context || null;
    mode = (body.mode || '').trim();
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Ogiltig förfrågan' }) };
  }

  if (mode && !ANALYSIS_FRAMEWORKS[mode]) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Okänt analysläge' }) };
  }
  if (!question || question.length < 2) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Frågan är för kort' }) };
  }
  const maxLen = mode ? 1000 : 2000;
  if (question.length > maxLen) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: `Frågan är för lång (max ${maxLen} tecken)` }) };
  }

  const systemPrompt = mode
    ? `${SYSTEM_PROMPT}\n\n${ANALYSIS_FRAMEWORKS[mode]}\n\nVar konkret och pedagogisk. Märk tydligt alla siffror du uppskattar som illustrativa antaganden — du har inte tillgång till live-bokslut. Avsluta med en kort rad om att detta är utbildning, inte personlig rådgivning.`
    : SYSTEM_PROMPT + buildMarketContext(context);
  const maxTokens = mode ? 1800 : MAX_TOKENS;

  const messages = [];
  if (!mode) {
    for (const m of history.slice(-MAX_HISTORY)) {
      if (m && isValidRole(m.role) && typeof m.content === 'string' && m.content.trim()) {
        messages.push({ role: m.role, content: m.content.slice(0, 2000) });
      }
    }
  }
  if (!messages.length || messages[messages.length - 1].content !== question) {
    messages.push({ role: 'user', content: question });
  }
  while (messages.length && messages[0].role !== 'user') messages.shift();

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system: systemPrompt, messages }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic API error:', response.status, err.slice(0, 300));
      return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'AI-tjänsten svarade inte korrekt' }) };
    }

    const data = await response.json();
    const answer = data.content?.map(c => c.text).filter(Boolean).join('\n') || '';
    return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ answer }) };
  } catch (err) {
    console.error('AI-chat error:', err);
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'Kunde inte nå AI-tjänsten' }) };
  }
};
