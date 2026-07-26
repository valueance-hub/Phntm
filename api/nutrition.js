// Vercel Serverless Function — POST /api/nutrition  { "q": "3분카레" }
// Holds your Anthropic API key SECRETLY (never shipped to the browser).
// Set ANTHROPIC_API_KEY in Vercel → Project → Settings → Environment Variables.
//
// Cost controls built in:
//   • Shared in-memory cache — the same food is billed once, then reused for everyone
//     (per warm serverless instance). For a permanent cache across restarts, swap
//     the `cache` Map for Vercel KV / Upstash Redis later.
//   • Per-IP rate limit — one visitor can't hammer thousands of calls.

const cache = new Map();          // normalized food -> result
const CACHE_MAX = 5000;
const hits = new Map();           // ip -> { count, resetAt }
const RATE_MAX = 30;              // calls per window
const RATE_WINDOW = 60 * 1000;    // 1 minute

function rateLimited(ip) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now > rec.resetAt) { hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW }); return false; }
  rec.count += 1;
  return rec.count > RATE_MAX;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ error: 'rate_limited' });

  const q = (req.body && req.body.q ? String(req.body.q) : '').slice(0, 200).trim();
  if (!q) return res.status(400).json({ error: 'Missing food text' });

  const key = q.toLowerCase().replace(/\s+/g, ' ').trim();
  if (cache.has(key)) return res.status(200).json(cache.get(key)); // free — no API call

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
        max_tokens: 256,
        system: 'You are a careful multilingual nutrition estimator. Count the WHOLE item as served: for a sandwich, sub, burger, wrap, taco or burrito that means the bread or tortilla PLUS the filling PLUS any cheese, dressing or sauce — a bread-based item can never have 0 carbs, and a 6-inch sub is typically 330-500 kcal. Respect fractions like "half" (multiply everything by 0.5). Never under-report fat: dressings, mayo, cheese and fried foods carry most of it. Always include a "sugar" figure in grams. The user may describe a food in ANY language (Korean, Japanese, Spanish, etc.) including brand/product names like "3분카레" and composite dishes with listed ingredients like "1 sandwich: 1 ham, 1 cheese, 1 tbsp peanut butter". Sum all listed ingredients into ONE total and reply ONLY with compact JSON like {"name":"Sandwich (ham, cheese, peanut butter)","kcal":420,"protein":22,"carbs":38,"fat":19}. Keep the original text in the name and add a short English gloss in parentheses. Estimate for the exact quantity described; if no quantity assume one typical serving and include it in the name. Integers only. No text outside the JSON.',
        messages: [{ role: 'user', content: q }],
      }),
    });
    const data = await r.json();
    const text = (data && data.content && data.content[0] && data.content[0].text) || '';
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)[0]);

    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, json);
    return res.status(200).json(json);
  } catch (e) {
    return res.status(500).json({ error: 'lookup_failed' });
  }
}
