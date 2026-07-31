// Vercel Serverless Function — GET /api/rates
//
// Returns USD-per-unit for every quote currency the sizing calculator needs, so pip
// values can be computed exactly instead of from a number you memorised last week.
//
// Source: the European Central Bank's daily reference rates via frankfurter.app —
// free, no API key, no rate limit worth worrying about. ECB publishes once per
// weekday around 16:00 CET, which is exactly the cadence a position-size calculator
// needs; intraday drift is far too small to affect a lot size.
//
// CommonJS on purpose: a static repo with no package.json is treated as CommonJS by
// Vercel's Node runtime, so `export default` fails to build and the route 404s.

const CURRENCIES = ['JPY', 'CAD', 'CHF', 'GBP', 'EUR', 'AUD', 'NZD', 'SEK', 'NOK', 'MXN', 'ZAR', 'SGD', 'PLN', 'TRY', 'HUF', 'CZK'];

// Cached per warm instance so a burst of page loads costs one upstream call.
let cache = null;           // { at, payload }
const TTL = 60 * 60 * 1000; // an hour — ECB only moves once a day

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (cache && Date.now() - cache.at < TTL) {
    res.setHeader('Cache-Control', 'public, max-age=1800');
    return res.status(200).json({ ...cache.payload, cached: true });
  }

  try {
    const r = await fetch('https://api.frankfurter.app/latest?base=USD&symbols=' + CURRENCIES.join(','));
    if (!r.ok) throw new Error('upstream ' + r.status);
    const data = await r.json();
    const q = data && data.rates;
    if (!q || !q.JPY) throw new Error('missing rates');

    // usdPer[X] = how many USD one unit of X is worth. The API gives us the
    // inverse (units of X per USD), so invert. USD is 1 by definition.
    const usdPer = { USD: 1 };
    CURRENCIES.forEach((c) => { if (q[c]) usdPer[c] = 1 / q[c]; });

    // Also hand back the headline pairs, so the UI can show the rate it used.
    const pairs = {
      EURUSD: usdPer.EUR, GBPUSD: usdPer.GBP, AUDUSD: usdPer.AUD, NZDUSD: usdPer.NZD,
      USDJPY: q.JPY, USDCAD: q.CAD, USDCHF: q.CHF,
    };

    const payload = { date: data.date, usdPer, pairs, source: 'ECB via frankfurter.app' };
    cache = { at: Date.now(), payload };
    res.setHeader('Cache-Control', 'public, max-age=1800');
    return res.status(200).json(payload);
  } catch (e) {
    console.error('[rates] ' + (e && e.message));
    // Serving a stale cache beats serving nothing — a day-old rate is still far
    // more accurate than a hardcoded fallback.
    if (cache) return res.status(200).json({ ...cache.payload, stale: true });
    return res.status(502).json({ error: 'rates_unavailable' });
  }
};
