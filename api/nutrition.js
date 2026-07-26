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
  '',
  'HOW TO SEARCH — work out the product\'s home market from its script and wording, then search in',
  'THAT language on THAT market\'s dominant retailers and review sites. Always pair the product name',
  'with the local phrase for nutrition information, because that is what puts the label in the results.',
  '',
  'EAST ASIA',
  '  Korea 영양정보 / 영양성분 / 칼로리 · 필라이즈 pillyze.com, fatsecret.kr, 다이어트신, 하이닥,',
  '    쿠팡 Coupang, 네이버쇼핑, 스마트스토어, 11번가, 지마켓, 마켓컬리, 올리브영, 와디즈 Wadiz,',
  '    네이버 블로그, and the maker\'s own site. 필라이즈 and fatsecret.kr carry small Korean brands',
  '    that the big retailers never list — query them early, not last.',
  '  Japan 栄養成分表示 / カロリー · 楽天 Rakuten, Amazon.co.jp, Yahoo!ショッピング, カロリーSlism,',
  '    もぐナビ, LOHACO, maker site',
  '  China 营养成分表 · 天猫 Tmall, 京东 JD, 淘宝 Taobao, 拼多多 Pinduoduo, 薄荷健康',
  '  Taiwan 營養標示 · PChome, momo購物, 蝦皮 Shopee TW, 家樂福',
  '  Hong Kong 營養資料 · HKTVmall, ParknShop, Wellcome',
  '',
  'SOUTH & SOUTHEAST ASIA',
  '  India पोषण संबंधी जानकारी / nutrition information · Amazon.in, Flipkart, BigBasket, JioMart,',
  '    Blinkit, Zepto, Swiggy Instamart, HealthifyMe, brand site (Nestlé India, Britannia, ITC, Amul)',
  '  Indonesia informasi nilai gizi · Tokopedia, Shopee ID, Blibli, Alfagift',
  '  Thailand ข้อมูลโภชนาการ · Shopee TH, Lazada TH, Tops, Big C',
  '  Vietnam thông tin dinh dưỡng · Shopee VN, Tiki, Lazada VN, Bach Hoa Xanh',
  '  Philippines nutrition facts · Shopee PH, Lazada PH, SM Supermarket',
  '  Malaysia / Singapore maklumat pemakanan · Shopee, Lazada, FairPrice, Cold Storage',
  '  Pakistan / Bangladesh nutrition information · Daraz, Foodpanda, brand site',
  '',
  'EUROPE',
  '  Russia пищевая ценность / калорийность · Ozon, Wildberries, Перекрёсток, Магнит, Лента,',
  '    calorizator.ru, fatsecret.ru',
  '  Germany / Austria / Switzerland Nährwerte · REWE, Amazon.de, dm, Rossmann, Migros, Coop',
  '  France valeurs nutritionnelles · Carrefour, Leclerc, Auchan, Open Food Facts (French project)',
  '  Italy valori nutrizionali · Esselunga, Coop, Amazon.it',
  '  Spain información nutricional · Mercadona, Carrefour ES, El Corte Inglés',
  '  Portugal informação nutricional · Continente, Pingo Doce',
  '  Netherlands nutritionele waarden · Albert Heijn, Jumbo, bol.com',
  '  Poland wartość odżywcza · Allegro, Żabka, Carrefour PL',
  '  Nordics näringsvärde / næringsindhold · ICA, Coop, Rema 1000, Prisjakt',
  '  Turkey besin değerleri · Migros, Trendyol, Getir, A101',
  '  Greece διατροφικές πληροφορίες · Skroutz, AB Vassilopoulos',
  '',
  'AMERICAS',
  '  United States nutrition facts · Amazon.com, Walmart, Target, Costco, Kroger, GNC,',
  '    brand site, Nutritionix, FatSecret, MyFitnessPal, USDA FoodData Central',
  '  Canada nutrition facts / valeur nutritive · Amazon.ca, Loblaws, Walmart CA, Well.ca',
  '  Brazil informação nutricional · Mercado Livre, Pão de Açúcar, Carrefour BR, Amazon.com.br',
  '  Mexico información nutrimental · Mercado Libre, Walmart MX, Chedraui, Soriana',
  '  Argentina / Chile / Colombia información nutricional · Mercado Libre, Jumbo, Éxito, Lider',
  '',
  'MIDDLE EAST & AFRICA',
  '  Gulf / Saudi / UAE القيمة الغذائية · noon, Carrefour KSA, Amazon.ae, Lulu Hypermarket, Talabat',
  '  Egypt / Levant القيمة الغذائية · Jumia EG, Talabat, Spinneys',
  '  Israel ערכים תזונתיים · Shufersal, Rami Levy',
  '  Nigeria / Kenya / Ghana nutrition information · Jumia, Konga, Naivas, brand site',
  '  South Africa nutritional information · Takealot, Woolworths SA, Checkers, Dis-Chem',
  '',
  'OCEANIA',
  '  Australia / New Zealand nutrition information panel · Woolworths, Coles, Chemist Warehouse,',
  '    Amazon.com.au, Countdown, brand site',
  '',
  'UNITED KINGDOM & IRELAND',
  '  nutrition information / typical values · Tesco, Sainsbury\'s, ASDA, Ocado, Holland & Barrett,',
  '    Amazon.co.uk, MyProtein, SuperValu',
  '',
  'Open Food Facts is worth a query in any language — it is crowd-sourced and carries small brands',
  'and imports that the big retailers never list.',
  'Read the nutrition panel from the listing. If the text states a weight or volume (for example 40g),',
  'report the figures for THAT amount — scale the per-100g panel if that is what the label gives.',
  'If several sources disagree, prefer the manufacturer, then a major retailer listing.',
  'SPEED — you have at most THREE searches, so make the first one count and stop as soon as you have',
  'a credible nutrition panel. Do not keep verifying across sources. Build the first query as:',
  '  unspaced brand + product name + the local nutrition phrase   e.g. 이데아뉴트리션 아이즈 프로틴 초코볼 영양정보',
  'Spacing does not matter and must never cause a miss: Korean, Japanese and Chinese brand names are',
  'written unspaced on official pages (이데아뉴트리션, not 이데아 뉴트리션), so ALWAYS collapse the spaces',
  'for your first query regardless of how the person typed it. If that misses, try the brand alone,',
  'then the product alone. Three queries total, then answer with your best estimate.',
  'Highest-yield sources first — the local nutrition database, then the maker\'s own site:',
  '  Korea 필라이즈 pillyze.com, fatsecret.kr · Japan カロリーSlism · Russia calorizator.ru',
  '  India HealthifyMe · Brazil/US/UK/EU FatSecret country site, Open Food Facts, MyFitnessPal',
  'These publish labels for small brands that retailers never list, and they answer in one query.',
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
  'SERVING — if the text names a multi-pack (5개입, 1박스, box of 8, 6-pack) WITHOUT saying how many',
  'were eaten, report ONE piece and say so in the name. Only report the whole box if the person said so.',
  'If a weight is given (40g) report exactly that weight. If the label is per 100g, scale it.',
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

  const key = q.toLowerCase().replace(/\s+/g, '').trim();   // spacing never splits a cache entry
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
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
        messages: [{ role: 'user', content: (function () {
          const tight = q.replace(/\s+/g, '');
          return tight !== q.replace(/\s/g, '') || /\s/.test(q) ? q + '\n(also written without spaces: ' + tight + ')' : q;
        })() }],
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
