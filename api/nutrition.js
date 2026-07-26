// Vercel Serverless Function — POST /api/nutrition   body: { "q": "프롬잇 프로틴칩 칠리바베큐 40g" }
//
// Holds the Anthropic API key SERVER-SIDE so it is never shipped to the browser.
// Set ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables, then redeploy.
//
// CommonJS on purpose: a static repo with no package.json is treated as CommonJS by
// Vercel's Node runtime, so `export default` fails to build and the route 404s.
//
// Accuracy: the model is given Anthropic's server-side web_search tool, so for a
// branded product it looks up the real listing — Coupang / 네이버쇼핑 for Korean
// items, the manufacturer's page, or the retailer — and reads the nutrition panel
// instead of guessing from memory. Guessing is what produced 20g protein for a
// 10g product. Generic foods ("2 eggs") skip the search and answer directly.
//
// Cost controls:
//   • in-memory cache — the same text is billed once, then reused (per warm instance)
//   • per-IP rate limit
//   • max_uses caps how many searches one lookup may run

const cache = new Map();          // normalised food text -> result
const CACHE_MAX = 5000;
const hits = new Map();           // ip -> { count, resetAt }
const RATE_MAX = 20;              // calls per window (searches cost more than plain replies)
const RATE_WINDOW = 60 * 1000;

function rateLimited(ip) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now > rec.resetAt) { hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW }); return false; }
  rec.count += 1;
  return rec.count > RATE_MAX;
}

const SYSTEM = [
  'You estimate nutrition for whatever a person says they ate. Reply with JSON only.',
  '',
  'WHEN TO SEARCH — use the web_search tool whenever the text names a specific product, brand,',
  'restaurant item or anything you are not certain about. Do not guess at branded items from memory.',
  'Search in the language of the product and in its home market:',
  '  • Korean products — search the Korean name plus 영양정보 or 영양성분, and look at Coupang (쿠팡),',
  '    네이버쇼핑, the manufacturer\'s own site, 다이어트신, or the retailer listing.',
  '  • Japanese — 栄養成分表示 plus the product name; Rakuten, Amazon.co.jp, the maker\'s site.',
  '  • US/UK/EU — the brand site, Nutritionix, Open Food Facts, or the retailer\'s product page.',
  'Read the nutrition panel from the listing. If the text states a weight or volume (for example 40g),',
  'report the figures for THAT amount — scale the per-100g panel if that is what the label gives.',
  'If several sources disagree, prefer the manufacturer, then a major retailer listing.',
  'If after searching the product genuinely cannot be found, estimate from the closest comparable',
  'product in that category and say so briefly in the name.',
  '',
  'WHEN NOT TO SEARCH — plain foods and home cooking ("2 scrambled eggs", "bowl of rice",',
  '"chicken breast 150g") need no lookup. Answer directly.',
  '',
  'COMPOSITE MEALS — several items joined by "plus", "and", commas or a colon are ONE entry:',
  'sum every component. For a sandwich, sub, burger, wrap or taco that means the bread PLUS the',
  'filling PLUS cheese, dressing and sauce — a bread-based item can never have 0 carbs.',
  'Respect fractions such as "half" (multiply everything by 0.5). Never under-report fat:',
  'dressings, mayo, cheese and fried food carry most of it.',
  '',
  'OUTPUT — one JSON object and nothing else, no prose, no markdown fence:',
  '{"name":"프롬잇 프로틴칩 칠리바베큐 40g (Fromit protein chips, chilli BBQ — per 40g bag)",',
  ' "kcal":160,"protein":10,"carbs":25,"fat":4,"sugar":2}',
  'Keep the original wording in "name" and add a short English gloss plus the serving in parentheses.',
  'All five numbers are integers in grams (kcal in calories). Include "sugar" always, 0 if none.',
].join('\n');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'missing_api_key' });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ error: 'rate_limited' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const q = String((body && body.q) || '').slice(0, 200).trim();
  if (!q) return res.status(400).json({ error: 'missing_food_text' });

  const key = q.toLowerCase().replace(/\s+/g, ' ').trim();
  if (cache.has(key)) return res.status(200).json(cache.get(key));   // free — no API call

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1500,
        system: SYSTEM,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
        messages: [{ role: 'user', content: q }],
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      console.error('[nutrition] anthropic ' + r.status + ': ' + detail.slice(0, 400));
      return res.status(502).json({ error: 'upstream_' + r.status });
    }

    const data = await r.json();
    // a search turns the reply into several blocks — take the JSON from the last
    // text block that contains one
    const blocks = (data && data.content) || [];
    let json = null;
    for (let i = blocks.length - 1; i >= 0 && !json; i--) {
      if (blocks[i] && blocks[i].type === 'text' && typeof blocks[i].text === 'string') {
        const m = blocks[i].text.match(/\{[\s\S]*\}/);
        if (m) { try { json = JSON.parse(m[0]); } catch (e) { /* keep looking */ } }
      }
    }
    if (!json) {
      console.error('[nutrition] unparsable: ' + JSON.stringify(blocks).slice(0, 400));
      return res.status(502).json({ error: 'unparsable_reply' });
    }

    // never let a bad reply through as zeros
    const num = (v) => { const n = Math.round(Number(v)); return isFinite(n) && n >= 0 ? n : 0; };
    const out = {
      name: String(json.name || q).slice(0, 160),
      kcal: num(json.kcal), protein: num(json.protein),
      carbs: num(json.carbs), fat: num(json.fat), sugar: num(json.sugar),
    };
    if (!out.kcal) return res.status(502).json({ error: 'no_calories' });

    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, out);
    return res.status(200).json(out);
  } catch (e) {
    console.error('[nutrition] ' + (e && e.message));
    return res.status(500).json({ error: 'lookup_failed' });
  }
};
