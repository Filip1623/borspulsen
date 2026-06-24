'use strict';

const https = require('https');

const REPO = 'filip1623/borspulsen';
const PER_PAGE = 50;

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const opts = new URL(url);
    https.get({
      hostname: opts.hostname,
      path: opts.pathname + opts.search,
      headers: { 'User-Agent': 'borspulsen-app', 'Accept': 'application/vnd.github.v3+json' }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// Map commit messages to which agent likely authored it
function guessAgent(message) {
  const m = message.toLowerCase();
  if (m.includes('design') || m.includes('ui') || m.includes('redesign') || m.includes('premium') || m.includes('visual')) return 'design-critic';
  if (m.includes('api') || m.includes('function') || m.includes('cors') || m.includes('säkerhet') || m.includes('rate')) return 'api-functions';
  if (m.includes('index.html') || m.includes('frontend') || m.includes('router') || m.includes('fix:')) return 'frontend-engineer';
  if (m.includes('nyckeltal') || m.includes('p/e') || m.includes('yahoo') || m.includes('finnhub') || m.includes('kurs')) return 'market-data-analyst';
  if (m.includes('tech') || m.includes('ericsson') || m.includes('hexagon')) return 'tech-sektor';
  if (m.includes('finans') || m.includes('seb') || m.includes('nordea')) return 'finans-sektor';
  if (m.includes('industri') || m.includes('volvo') || m.includes('atlas')) return 'industri-sektor';
  if (m.includes('energi') || m.includes('equinor')) return 'energi-sektor';
  if (m.includes('hälsa') || m.includes('halsa') || m.includes('astra')) return 'halsa-sektor';
  if (m.includes('ai') || m.includes('claude') || m.includes('analys') || m.includes('chat')) return 'borspulsen-oversikt';
  if (m.includes('deploy') || m.includes('preflight') || m.includes('csp') || m.includes('netlify')) return 'release-verifier';
  if (m.includes('agent') || m.includes('mesh') || m.includes('skill')) return 'borspulsen-oversikt';
  return 'borspulsen-oversikt';
}

exports.handler = async (event) => {
  const page = parseInt(event.queryStringParameters?.page || '1', 10);

  try {
    const url = `https://api.github.com/repos/${REPO}/commits?per_page=${PER_PAGE}&page=${page}`;
    const commits = await fetchJSON(url);

    if (!Array.isArray(commits)) {
      return { statusCode: 502, body: JSON.stringify({ error: 'GitHub API error', detail: commits }) };
    }

    const result = commits.map(c => ({
      sha: c.sha.slice(0, 7),
      message: c.commit.message.split('\n')[0],
      date: c.commit.author.date,
      author: c.commit.author.name,
      url: c.html_url,
      agent: guessAgent(c.commit.message),
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ commits: result, page, total: result.length }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
