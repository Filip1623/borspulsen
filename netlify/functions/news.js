// netlify/functions/news.js
// Hämtar verkliga börsnyheter från Finnhub och returnerar till frontend

exports.handler = async function (event) {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  const token = process.env.Finnhub_Token || process.env.FINNHUB_TOKEN;
  if (!token) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'API-nyckel saknas' }),
    };
  }

  try {
    // Hämta generella börsnyheter
    const url = `https://finnhub.io/api/v1/news?category=general&minId=0&token=${token}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Finnhub svarade med status ${res.status}`);
    }

    const data = await res.json();

    // Filtrera och formatera — max 12 nyheter, måste ha rubrik och källa
    const articles = data
      .filter(a => a.headline && a.source && a.url)
      .slice(0, 12)
      .map(a => ({
        id:       a.id,
        title:    a.headline,
        summary:  a.summary || '',
        source:   a.source,
        url:      a.url,
        image:    a.image || '',
        time:     a.datetime, // unix timestamp
        category: a.category,
      }));

    return {
      statusCode: 200,
      headers: {
        ...CORS,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300', // cacha 5 min
      },
      body: JSON.stringify({ articles }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
