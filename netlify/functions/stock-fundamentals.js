// netlify/functions/stock-fundamentals.js
// Hämtar nyckeltal (P/E, P/S, P/B m.m.) från Yahoo Finance för svenska aktier
// Finnhub saknar dessa för OMXSTO på gratis-nivå, Yahoo Finance är gratis och täcker .ST-aktier

exports.handler = async function (event) {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  // symbol i Finnhub-format: OMXSTO:ERIC-B  →  Yahoo: ERIC-B.ST
  const symbol = event.queryStringParameters?.symbol;
  if (!symbol) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Symbol saknas' }) };

  // Konvertera: ta bort eventuellt exchange-prefix och lägg till .ST
  const base = symbol.includes(':') ? symbol.split(':')[1] : symbol;
  const yahooSymbol = base + '.ST';

  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(yahooSymbol)}?modules=summaryDetail,defaultKeyStatistics,financialData`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; borspulsen/1.0)',
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ error: `Yahoo svarade ${res.status}` }) };
    }

    const data = await res.json();
    const result = data?.quoteSummary?.result?.[0];
    if (!result) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ error: 'Ingen data från Yahoo' }) };
    }

    const sd  = result.summaryDetail || {};
    const ks  = result.defaultKeyStatistics || {};
    const fd  = result.financialData || {};

    const val = (obj, key) => {
      const v = obj[key];
      if (!v) return null;
      if (typeof v === 'object' && 'raw' in v) return v.raw;
      return v;
    };

    const fundamentals = {
      // Värdering
      pe:          val(sd,  'trailingPE')      || val(sd, 'forwardPE')      || null,
      forwardPe:   val(sd,  'forwardPE')                                     || null,
      ps:          val(ks,  'priceToSalesTrailing12Months')                  || null,
      pb:          val(sd,  'priceToBook')     || val(ks, 'priceToBook')     || null,
      evEbitda:    val(ks,  'enterpriseToEbitda')                            || null,
      evRevenue:   val(ks,  'enterpriseToRevenue')                           || null,

      // Lönsamhet
      grossMargin: val(fd,  'grossMargins')                                  || null,
      operatingMargin: val(fd, 'operatingMargins')                          || null,
      netMargin:   val(fd,  'profitMargins')   || val(ks, 'profitMargins')   || null,
      roe:         val(fd,  'returnOnEquity')                                || null,
      roa:         val(fd,  'returnOnAssets')                               || null,

      // Tillväxt
      revenueGrowth: val(fd, 'revenueGrowth')                               || null,
      earningsGrowth: val(fd, 'earningsGrowth')                             || null,

      // Utdelning
      dividendYield: val(sd, 'dividendYield') || val(sd, 'trailingAnnualDividendYield') || null,
      payoutRatio: val(sd,  'payoutRatio')                                  || null,

      // Balansräkning
      debtToEquity: val(fd, 'debtToEquity')                                 || null,
      currentRatio: val(fd, 'currentRatio')                                 || null,

      // Övrigt
      beta:        val(sd,  'beta')                                         || null,
      shortRatio:  val(ks,  'shortRatio')                                   || null,
    };

    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
      body: JSON.stringify(fundamentals),
    };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
