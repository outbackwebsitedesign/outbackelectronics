// Manufacturer spec-page enrichment.
//
// The gap this fills is the one no public dataset and no free Icecat tier
// covers: case clearances, cooler heights and socket lists, PSU depth. The
// manufacturer publishes all of it on the product page, so this reads it from
// there, and takes the product photo from the same page while it is open.
//
// Two things about how it fetches, both deliberate.
//
// It is polite by construction. Product URLs come from crawling a vendor's own
// listing pages once, cached in the library, so name-to-URL matching afterwards
// costs nothing. A part is fetched once and never again. Concurrency is low and
// there is a pause between requests. Driving lookups in a tight loop is what
// got the shop's own address blocked by PCPartPicker, and that block took a
// site away from staff browsers across the whole network. The cost of being
// slow here is nothing; the cost of being blocked is real.
//
// It only reads vendors that serve pages to a plain request. MSI, Gigabyte,
// ASRock, Corsair, be quiet! and Seasonic all sit behind bot protection that
// returns 403 to anything without a browser, so they are absent below rather
// than half-working. Adding them needs a real browser session, which is a
// different piece of work.


const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// ── Vendors ──────────────────────────────────────────────────────────────────
//
// `roots` are listing pages to crawl. `follow` is how deep to walk links that
// match `productPattern`: Fractal lists a series page per range, and each of
// those lists the individual colourways, so it needs two hops. Vendors that put
// every product on one listing page need one.

const VENDORS = [
  {
    id: 'fractal', label: 'Fractal Design', brands: ['Fractal Design', 'Fractal'],
    roots: [
      { category: 'case', url: 'https://www.fractal-design.com/products/cases/' },
      { category: 'psu', url: 'https://www.fractal-design.com/products/power-supplies/' },
      { category: 'cooler', url: 'https://www.fractal-design.com/products/cooling/' },
      { category: 'fan', url: 'https://www.fractal-design.com/products/fans/' },
    ],
    productPattern: /^https:\/\/www\.fractal-design\.com\/products\/[a-z-]+\/[a-z0-9/-]+\/$/i,
    follow: 2,
  },
  {
    id: 'coolermaster', label: 'Cooler Master', brands: ['Cooler Master', 'CoolerMaster'],
    roots: [
      // Cooler Master's listing pages are built in the browser, so a plain
      // request sees no products at all. Their sitemap is the published index
      // of the same thing and is one request instead of a crawl.
      { category: 'case', url: 'https://www.coolermaster.com/en-global/sitemap_0-product.xml' },
    ],
    // The sitemap carries every locale of every product. Only the English one
    // is wanted, and the URLs there end in .html.
    productPattern: /^https:\/\/www\.coolermaster\.com\/en-global\/products\/[a-z0-9-]+(?:\.html)?\/?$/i,
    follow: 1,
  },
  {
    id: 'lianli', label: 'Lian Li', brands: ['Lian Li', 'Lian-Li', 'LIANLI'],
    roots: [
      { category: 'case', url: 'https://lian-li.com/product-category/cases/' },
      { category: 'cooler', url: 'https://lian-li.com/product-category/cooling/aio-coolers/' },
      { category: 'fan', url: 'https://lian-li.com/product-category/cooling/fans/' },
    ],
    productPattern: /^https:\/\/lian-li\.com\/product\/[a-z0-9-]+\/?$/i,
    follow: 1,
  },
  {
    id: 'asus', label: 'Asus', brands: ['Asus', 'ASUS', 'ROG', 'Asus ROG'],
    roots: [
      // The listing page yields only the handful of boards it shows above the
      // fold; the rest arrive as the page is scrolled, which a plain request
      // never sees. Indexing it found four pages against 2,822 Asus parts in
      // the library. The sitemap is the full set.
      //
      // This covers the ROG families (Strix, Maximus, Crosshair and the rest).
      // PRIME, TUF and ProArt sit on www.asus.com under per-country sitemaps
      // and are not indexed yet.
      { category: 'motherboard', url: 'https://rog.asus.com/sitemap/product1.xml' },
    ],
    // Asus product URLs are /motherboards/<family>/<model>/, sometimes with a
    // "-model" suffix and sometimes not, so both shapes have to be accepted.
    productPattern: /^https:\/\/rog\.asus\.com\/motherboards\/[a-z0-9-]+\/[a-z0-9-]+\/?$/i,
    follow: 2,
    // Asus keeps the spec table on a separate tab of the product page, and
    // that tab carries no images at all: it returned specs and zero photos.
    // The pictures are on the product page itself, so the two are read from
    // different URLs.
    specPath: (u) => u.replace(/\/$/, '') + '/spec',
    imagePath: (u) => u,
  },
];

const VENDOR_BY_ID = Object.fromEntries(VENDORS.map(v => [v.id, v]));

// Brand as it appears in the library, lowercased, to vendor id.
const BRAND_TO_VENDOR = {};
for (const v of VENDORS) for (const b of v.brands) BRAND_TO_VENDOR[b.toLowerCase()] = v.id;

function vendorForBrand(brand) {
  if (!brand) return null;
  const id = BRAND_TO_VENDOR[String(brand).trim().toLowerCase()];
  return id ? VENDOR_BY_ID[id] : null;
}

/**
 * Whether a part is made by this vendor.
 *
 * The brand field cannot be trusted to hold the whole brand. The public
 * datasets take the first word of the product name and call it the brand, so
 * the library holds 852 parts under "Cooler", 465 under "Lian" and 154 under
 * "be". Matching on the full name found three Cooler Master parts out of 852
 * and made the whole panel look broken.
 *
 * So the name is checked too: a part whose name begins with the vendor's name
 * is that vendor's, whatever the brand column says. Anchoring at the start
 * matters, since "Cooler" appears in half the cooler names on the market and
 * only a leading "Cooler Master" means the manufacturer.
 */
function vendorMatchesPart(vendor, part) {
  const brand = String(part?.brand || '').trim().toLowerCase();
  const nameToks = nameTokens(part?.sourceName || part?.name || '');
  for (const alias of vendor.brands) {
    const aliasToks = nameTokens(alias);
    if (!aliasToks.length) continue;
    if (brand === alias.toLowerCase()) return true;
    if (aliasToks.every((t, i) => nameToks[i] === t)) return true;
  }
  return false;
}

// ── Label map ────────────────────────────────────────────────────────────────
//
// Regexes rather than the token matching used for Icecat, because vendors name
// the same figure in ways that share no words: "Graphics card (max length)",
// "Clearance - GFX" and "GPU LENGTH CLEARANCE" are all one spec. The patterns
// are anchored loosely on purpose but each must be specific enough not to catch
// a marketing sentence, so a label longer than about sixty characters is
// treated as prose and skipped.

const LABEL_MAP = {
  case: [
    ['maxGpuLengthMm', /(gpu|graphics? ?card|gfx|video card).*(length|clearance)|clearance.*(gpu|gfx|graphics)/i, 'mmMin'],
    ['maxCoolerHeightMm', /(cpu ?cooler|cpu).*(height|clearance)|clearance.*cpu ?cooler/i, 'mmMin'],
    ['maxPsuLengthMm', /(psu|power supply).*(length|clearance)|clearance.*(psu|power supply)/i, 'mmMin'],
    ['maxBoardFormFactor', /motherboard (support|compatibility|form ?factor)|supported motherboards?/i, 'boardMax'],
    ['psuFormFactor', /power supply (support|type|form ?factor)|psu (type|form ?factor)/i, 'psuForm'],
    ['radiatorMm', /(radiator|liquid cooling).*(support|size|compatibility)/i, 'mmMax'],
    ['bays35', /3\.5"?.*(bay|drive)/i, 'count'],
    ['bays25', /2\.5"?.*(bay|drive)/i, 'count'],
    ['fansIncluded', /(fans? included|pre-?installed fans?|included fans?)/i, 'count'],
    ['colour', /^colou?rs?$|product colou?r/i, 'colour'],
  ],
  cooler: [
    ['heightMm', /^(height|cooler height|overall height|dimensions? \(h\))/i, 'mmMin'],
    ['radiatorMm', /radiator (size|dimension|length)/i, 'mmMax'],
    ['tdpRating', /(max(imum)? )?tdp|cooling capacity|heat dissipation/i, 'watts'],
    ['sockets', /(socket|cpu) (support|compatibility)|compatible sockets?|supported sockets?/i, 'socketList'],
    ['colour', /^colou?rs?$|product colou?r/i, 'colour'],
  ],
  psu: [
    ['wattage', /(output|total|rated) power|wattage/i, 'watts'],
    ['formFactor', /(psu |power supply )?form ?factor|psu type/i, 'psuForm'],
    ['lengthMm', /^(depth|length)$|dimensions? \(d\)|psu (depth|length)/i, 'mmMin'],
    ['efficiency', /(80 ?plus|efficiency)/i, 'efficiency'],
    ['colour', /^colou?rs?$|product colou?r/i, 'colour'],
  ],
  motherboard: [
    ['socket', /^socket|cpu socket|processor socket/i, 'socket'],
    ['chipset', /^chipset|motherboard chipset/i, 'chipset'],
    ['formFactor', /form ?factor/i, 'boardMax'],
    ['memoryType', /memory (type|support)|^memory$/i, 'memoryType'],
    ['memorySlots', /(memory|dimm) slots?|number of dimm/i, 'count'],
    ['m2Slots', /m\.?2 (slot|socket|connector)/i, 'count'],
    ['sataPorts', /sata.*(port|connector)/i, 'count'],
    ['pcieX16Slots', /pci ?e(xpress)? .*x16/i, 'count'],
  ],
  fan: [
    ['sizeMm', /fan size|dimensions?/i, 'mmMax'],
    ['colour', /^colou?rs?$|product colou?r/i, 'colour'],
  ],
};

const BOARD_ORDER = ['Mini-ITX', 'Micro-ATX', 'ATX', 'E-ATX'];
const PSU_FORMS = ['ATX', 'SFX-L', 'SFX', 'TFX', 'ATX12VO'];

// ── Value coercion ───────────────────────────────────────────────────────────
//
// The rule for every clearance figure is the smallest number on the line. A
// vendor writes "165mm" when there is one answer and "200mm (recommended up to
// 170mm)" or "145 mm with the fan bracket / 170 mm without" when the answer
// depends on how the case is built. Taking the smallest is the figure that is
// true whatever the builder does, and being pessimistic about clearance can
// only ever cost a part that would have fitted. Being optimistic gets a machine
// ordered that cannot be assembled.

function mmNumbers(value) {
  const out = [];
  const re = /(\d{2,4}(?:\.\d+)?)\s*mm/gi;
  let m;
  while ((m = re.exec(value))) out.push(Number(m[1]));
  return out.filter(n => Number.isFinite(n) && n > 0);
}

function coerce(kind, raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  switch (kind) {
    case 'mmMin': {
      const ns = mmNumbers(value);
      return ns.length ? Math.min(...ns) : null;
    }
    case 'mmMax': {
      const ns = mmNumbers(value);
      return ns.length ? Math.max(...ns) : null;
    }
    case 'watts': {
      const m = value.match(/(\d{2,4})\s*w\b/i);
      return m ? Number(m[1]) : null;
    }
    case 'count': {
      // "8 (Mesh)", "4 x DIMM", "2" all mean the same thing. A range like
      // "1-2" takes the low end for the same reason clearances do.
      //
      // A millimetre figure is never a count. "Fans included: 3 x 120mm" reads
      // as three, not a hundred and twenty, and a bare "120 mm" is a size that
      // says nothing about how many, so it is rejected rather than guessed at.
      const m = value.match(/(\d{1,3})\s*(?:x|\u00d7)\s*\d{2,4}\s*mm/i) || value.match(/^\D{0,12}(\d{1,3})(?!\s*(?:\.\d)?\s*mm)/);
      if (!m) return null;
      const n = Number(m[1]);
      // Nothing in a PC case has more than a couple of dozen of anything.
      return Number.isFinite(n) && n >= 0 && n <= 24 ? n : null;
    }
    case 'boardMax': {
      // Cases list everything they take; the compatibility rule wants the
      // largest, since taking E-ATX implies taking ATX below it.
      let best = null;
      for (const ff of BOARD_ORDER) {
        const pat = ff.replace(/-/g, '[- ]?').replace('Micro', '(Micro|M|u|\\u00b5)').replace('Mini', '(Mini|M)');
        if (new RegExp(pat, 'i').test(value)) best = ff;
      }
      return best;
    }
    case 'psuForm': {
      for (const f of PSU_FORMS) if (new RegExp(f.replace('-', '-?'), 'i').test(value)) return f;
      return null;
    }
    case 'socket': case 'socketList': case 'chipset': case 'memoryType':
    case 'efficiency': case 'colour':
      return validate(kind, value);
    case 'text':
      return value.length > 120 ? null : value;
    default:
      return null;
  }
}


// ── Validation ───────────────────────────────────────────────────────────────
//
// Pairing a label with the text that follows it is the only approach that works
// across vendors who agree on no markup, but it pairs happily with the wrong
// thing when a page is a run of section headings. Asus's spec tab is exactly
// that, and it produced chipset "Memory", memory type "Graphics" and socket
// "CPU": three headings, each read as the value of the one above it.
//
// Nothing catches that except knowing what a real answer looks like, so every
// text-shaped spec is checked against the vocabulary it has to come from. A
// value that fails is dropped, not stored. A blank spec skips a compatibility
// rule and says so; an invented one is reported to staff as fact and gets the
// wrong parts ordered.

const SOCKET_RE = /^(LGA\s?\d{3,4}[A-Z]?|AM[1-5]\+?|FM[12]\+?|sTRX4|sWRX8|sTR5|TR4|SP[3-6]|BGA\d+)$/i;
const CHIPSET_RE = /^[A-Z]{1,4}\s?\d{2,4}[A-Z]{0,2}$/i;
const MEMORY_RE = /\bDDR([2-5])\b/i;
const EFFICIENCY_RE = /80\s?plus\s?(titanium|platinum|gold|silver|bronze|white|standard)?|titanium|platinum|gold|silver|bronze/i;

function validate(key, value) {
  // Only the text-shaped specs have a vocabulary to check against. Numbers were
  // parsed out of the page by pattern and are already as constrained as they
  // can be, so anything not listed here passes through.
  switch (key) {
    case 'socket': {
      const m = String(value).match(/(LGA\s?\d{3,4}[A-Z]?|AM[1-5]\+?|FM[12]\+?|sTRX4|sWRX8|sTR5|TR4|SP[3-6])/i);
      return m ? m[1].replace(/\s+/g, '').toUpperCase().replace(/^AM(\d)/, 'AM$1') : null;
    }
    case 'socketList': {
      const found = [...String(value).matchAll(/(LGA\s?\d{3,4}[A-Z]?|AM[1-5]\+?|FM[12]\+?|sTRX4|sWRX8|sTR5|TR4)/gi)]
        .map(m => m[1].replace(/\s+/g, '').toUpperCase());
      return found.length ? [...new Set(found)] : null;
    }
    case 'chipset':
      return CHIPSET_RE.test(String(value).trim()) ? String(value).trim().toUpperCase() : null;
    case 'memoryType': {
      const m = String(value).match(MEMORY_RE);
      return m ? `DDR${m[1]}` : null;
    }
    case 'efficiency':
      return EFFICIENCY_RE.test(String(value)) ? String(value).trim().slice(0, 40) : null;
    case 'colour': {
      const c = coloursIn(nameTokens(value));
      // One colour only. "Black / White" is two products listed together, not
      // a colour, and picking either would be a guess.
      return c.length === 1 ? c[0][0].toUpperCase() + c[0].slice(1) : null;
    }
    default:
      return value;
  }
}

// ── Page parsing ─────────────────────────────────────────────────────────────

/**
 * Label/value pairs from a product page.
 *
 * Vendors mark specs up as tables, definition lists, or nested divs, and no two
 * of the four here agree. What they do agree on is that the value is the next
 * piece of text after the label, so the tags are stripped and adjacent lines
 * paired. It is crude and it works on all four without a parser per vendor.
 */
function textPairs(html) {
  let t = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
  t = t.replace(/<[^>]+>/g, '\n');
  t = decodeEntities(t);
  const lines = t.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const pairs = [];
  for (let i = 0; i < lines.length - 1; i++) {
    // A label is short. Anything longer is a sentence that happens to mention
    // a GPU, and pairing it with the text after it produces nonsense.
    if (lines[i].length <= 60) pairs.push([lines[i], lines[i + 1]]);
  }
  return pairs;
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/**
 * Specs for one category out of a product page.
 *
 * First match wins per spec: pages repeat a figure in a summary block and again
 * in the full table, and the two agree, so there is nothing to gain from
 * looking at the rest and something to lose if a later line is prose.
 */
function extractSpecs(html, category) {
  const map = LABEL_MAP[category];
  if (!map) return { specs: {}, matched: [] };
  const pairs = textPairs(html);
  const specs = {};
  const matched = [];
  for (const [label, value] of pairs) {
    for (const [key, pattern, kind] of map) {
      if (specs[key] !== undefined) continue;
      if (!pattern.test(label)) continue;
      const coerced = coerce(kind, value);
      if (coerced === null || coerced === '') continue;
      specs[key] = coerced;
      matched.push({ key, label, value: String(value).slice(0, 120) });
      break;
    }
  }
  return { specs, matched };
}

/**
 * Product photo. og:image is what a vendor nominates as the picture of this
 * product, which is exactly the question being asked, and it survives site
 * redesigns better than guessing at the markup around the gallery.
 */
const STOPWORDS = new Set(['the', 'and', 'with', 'edition', 'series', 'gaming', 'pc', 'case', 'tower', 'atx']);
// Vendors sell colours by their marketing names, and those names are what end
// up in URLs and filenames. Left unmapped they read as no colour at all, which
// is worse than an unknown one: a "Charcoal" photo passed the colour check for
// a White case, and the plain North took the Momentum Edition's picture and its
// 300mm clearance because that page said "black" in a word this list knew.
const COLOUR_SYNONYMS = {
  black: 'black', charcoal: 'black', graphite: 'black', midnight: 'black', obsidian: 'black', onyx: 'black',
  white: 'white', chalk: 'white', ivory: 'white', snow: 'white', frost: 'white', arctic: 'white',
  silver: 'silver', titanium: 'silver', platinum: 'silver', chrome: 'silver',
  grey: 'grey', gray: 'grey', gunmetal: 'grey', slate: 'grey', ash: 'grey',
  jade: 'green', green: 'green', forest: 'green',
  pink: 'pink', rose: 'pink',
  blue: 'blue', navy: 'blue', cobalt: 'blue',
  red: 'red', crimson: 'red',
};
const COLOUR_WORDS = Object.keys(COLOUR_SYNONYMS);

// The colours a set of tokens names, reduced to the canonical ones the library
// records, so "charcoal-black" and "chalk-white" each resolve to one answer
// rather than two competing ones.
function coloursIn(tokens) {
  const out = new Set();
  for (const t of tokens) if (COLOUR_SYNONYMS[t]) out.add(COLOUR_SYNONYMS[t]);
  return [...out];
}

function canonicalColour(value) {
  const t = String(value || '').toLowerCase().trim();
  return COLOUR_SYNONYMS[t] || t;
}

// Single characters are kept. In component model names the one-letter suffix
// is the identity: ROG STRIX X870-A and X870-F are different boards with
// different M.2 counts, and dropping the letter made them the same string.
// Doing so matched a TUF B550-PLUS against a STRIX B550-F and wrote that
// board's six M.2 slots onto a board with two.
function nameTokens(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(t => t && !STOPWORDS.has(t));
}

const NOT_A_PRODUCT = /logo|favicon|placeholder|sprite|banner|icon[-_.]|android-chrome|apple-touch|\/flags?\//i;

// WordPress and most CDNs publish a family of resized copies alongside the
// original ("...-1131x800.jpg"). The unsuffixed or "-scaled" file is the full
// one, and since everything is downscaled locally anyway, taking the largest
// available keeps the stored image sharp.
const RESIZE_SUFFIX = /-(\d{2,4})x(\d{2,4})(?=\.[a-z]+(?:\?|$))/i;

function imageCandidates(html, pageUrl) {
  const out = [];
  const seen = new Set();
  const push = (raw) => {
    if (!raw) return;
    let href;
    try { href = new URL(decodeEntities(raw), pageUrl).href; } catch { return; }
    if (seen.has(href)) return;
    if (NOT_A_PRODUCT.test(href)) return;
    if (!/\.(jpe?g|png|webp|avif)(\?|$)/i.test(href)) return;
    seen.add(href);
    const m = href.match(RESIZE_SUFFIX);
    out.push({ url: href, pixels: m ? Number(m[1]) * Number(m[2]) : Infinity });
  };

  const metas = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/gi,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/gi,
  ];
  const meta = [];
  for (const re of metas) { let m; while ((m = re.exec(html))) { const before = out.length; push(m[1]); if (out.length > before) meta.push(out[out.length - 1].url); } }

  let m;
  const ld = /"image"\s*:\s*(\[[^\]]*\]|"[^"]+")/gi;
  while ((m = ld.exec(html))) for (const u of String(m[1]).match(/https?:\/\/[^"'\s\],]+/g) || []) push(u);

  const attrs = /<(?:img|source)\b[^>]*?\b(?:src|data-src|data-lazy-src|srcset|data-srcset)=["']([^"']+)["']/gi;
  while ((m = attrs.exec(html))) for (const part of m[1].split(',')) push(part.trim().split(/\s+/)[0]);

  return { candidates: out, metaUrls: new Set(meta) };
}

/**
 * Product photo for a specific part.
 *
 * og:image alone is not good enough, and the way it fails is the dangerous one.
 * Fractal nominates a series key visual: every Meshify 3 colourway, black and
 * white alike, returns the same photograph. Six of fourteen pages shared one
 * image in testing. A white case illustrated with a black one is worse than no
 * picture at all, because a blank cell reads as "unknown" while a wrong picture
 * reads as the product, and picking parts for a themed build is exactly when
 * someone is going by the picture.
 *
 * So candidates are scored against the part the picture is for. Filenames carry
 * the answer: the page above also holds Meshify-3_White_TGC_Left-Front, which
 * names both the model and the colour. A file naming a colour that is not this
 * part's colour is rejected outright rather than scored down, and where nothing
 * names the right colour the result is no image, deliberately.
 */
function extractImage(html, pageUrl, part = null, aliases = []) {
  const { candidates, metaUrls } = imageCandidates(html, pageUrl);
  if (!candidates.length) return null;

  const colour = canonicalColour(part?.specs?.colour);
  // The brand is dropped from the name tokens. Vendors do not repeat their own
  // name in filenames on their own site, so leaving it in only dilutes the
  // score: "Fractal Design North Momentum" would need most of five tokens to
  // match a file that can never contain two of them.
  const want = part ? identifyingTokens(part, aliases) : [];

  // Group the resized copies of one image together so scoring happens per
  // picture and the largest copy of the winner is what gets downloaded.
  const groups = new Map();
  for (const c of candidates) {
    const base = c.url.replace(RESIZE_SUFFIX, '').replace(/-scaled(?=\.[a-z]+)/i, '');
    const g = groups.get(base) || { base, best: c, fromMeta: false };
    if (c.pixels > g.best.pixels) g.best = c;
    if (metaUrls.has(c.url)) g.fromMeta = true;
    groups.set(base, g);
  }

  const scored = [];
  for (const g of groups.values()) {
    const file = decodeURIComponent(g.base.split('/').pop() || '');
    const tokens = nameTokens(file);
    const fileColours = coloursIn(tokens);

    // A file that names a colour this part is not is somebody else's product.
    if (colour && fileColours.length && !fileColours.includes(colour)) continue;

    const hits = want.filter(t => tokens.includes(t)).length;
    const cover = want.length ? hits / want.length : 0;
    const colourHit = colour && fileColours.includes(colour);

    // The part's own name has to match, and colour alone is never enough.
    // Letting a colour match stand in for a name match put an Ion 3 Gold power
    // supply on the North Momentum case: the page carries a dozen other
    // products in "you might also like" strips, and one of them was black too.
    // Colour decides between pictures of the right product, it never decides
    // which product.
    if (want.length && cover < 0.4) continue;

    scored.push({ url: g.best.url, score: cover * 2 + (colourHit ? 2 : 0) + (g.fromMeta ? 0.25 : 0) });
  }

  if (scored.length) {
    scored.sort((a, b) => b.score - a.score);
    return scored[0].url;
  }

  // Nothing named the part. Falling back to og:image is safe only when there is
  // no colour to get wrong; otherwise no image is the honest answer.
  if (colour) return null;
  const meta = candidates.find(c => metaUrls.has(c.url));
  return meta ? meta.url : null;
}

/** Absolute links on a page, deduplicated. */
function extractLinks(html, pageUrl) {
  const out = new Set();
  const re = /<a\b[^>]*href=["']([^"'#]+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    try { out.add(new URL(decodeEntities(m[1]), pageUrl).href); } catch { /* skip */ }
  }
  return [...out];
}

// ── Name to URL matching ─────────────────────────────────────────────────────



/**
 * Best URL for a part, or null.
 *
 * Scored on how much of the part name the URL slug accounts for, both ways
 * round: a slug must cover most of the name, and a name must cover most of the
 * slug. One direction alone matches "North" against "north-xl" and against
 * every other product whose slug contains it.
 *
 * Colour is part of the name for a reason, so a slug carrying the wrong colour
 * is rejected outright rather than scored down. Ordering a white case because
 * the black one matched slightly better is the exact mistake this tool exists
 * to prevent.
 */
// Path segments every product on a site shares. They say nothing about which
// product a URL is, and counting them drags a real match below the threshold:
// "Fractal Design North" against /products/cases/north/north/black/ scored one
// token in five and was rejected, while the page was exactly right.
/**
 * The part's name reduced to the words that identify it.
 *
 * The brand comes off, and not only the brand as the library records it. A
 * dataset may file a case under "Fractal" while its name reads "Fractal Design
 * North", leaving "design" behind as though it identified something. On a name
 * that short it halved the score and lost the match, so every alias the vendor
 * is known by is stripped.
 */
function identifyingTokens(part, aliases = []) {
  const drop = new Set([...nameTokens(part?.brand || ''), ...aliases.flatMap(a => nameTokens(a))]);
  return nameTokens(part?.sourceName || part?.name || '').filter(t => !drop.has(t));
}

// Panel, trim and finish options. A vendor sells one model in several finishes
// and spells them out in the URL ("pop-xl-air/rgb-black-tg-clear"), while the
// library records the model plainly. These words describe how a unit is dressed
// rather than which model it is, so they do not count against a match.
//
// They are excluded from the count only, never used to bridge a gap: a name
// that actually says RGB still has to find RGB in the slug.
const FINISH_NOISE = new Set(['tg', 'tempered', 'glass', 'clear', 'dark', 'light', 'tint', 'tinted', 'mesh', 'solid', 'panel', 'ver', 'version']);

const PATH_NOISE = new Set(['products', 'product', 'category', 'en', 'global', 'us', 'au', 'motherboards', 'cases', 'cooling', 'coolers', 'fans', 'power', 'supplies', 'supply', 'model', 'spec', 'rev']);

function matchUrl(part, urls, aliases = []) {
  const brandTokens = new Set([...nameTokens(part.brand || ''), ...aliases.flatMap(a => nameTokens(a))]);
  const want = identifyingTokens(part, aliases);
  if (!want.length) return null;
  const colour = canonicalColour(part.specs?.colour);

  let best = null;
  for (const url of urls) {
    const raw = nameTokens(url.replace(/^https?:\/\/[^/]+/, ''));
    const slug = raw.filter(t => !PATH_NOISE.has(t) && !brandTokens.has(t));
    if (!slug.length) continue;

    const slugColours = coloursIn(slug);
    // Ordering a white case because the black one scored better is the exact
    // mistake this tool exists to prevent, so a wrong colour is disqualifying
    // rather than a lower score.
    if (colour && slugColours.length && !slugColours.includes(colour)) continue;

    // Model numbers have to agree exactly, in both directions. Everything else
    // here is a threshold, and a threshold cannot tell a Pop Air from a Pop 2
    // Air: every word of the first appears in the second. A digit is never
    // decoration in a component name, so a number on one side and not the
    // other means these are two different products, whatever else lines up.
    const digits = (toks) => new Set(toks.filter(t => /\d/.test(t)));
    const wantDigits = digits(want);
    const slugDigits = digits(slug);
    if (wantDigits.size !== slugDigits.size || [...wantDigits].some(t => !slugDigits.has(t))) continue;

    const hits = want.filter(t => slug.includes(t)).length;
    const cover = hits / want.length;
    // The other direction matters too. Without it "North" matches the North XL
    // and the North Momentum Edition as readily as the North, since all three
    // slugs contain the word. Requiring the slug to be mostly accounted for by
    // the part's own name is what separates them.
    const named = new Set(want);
    const extra = slug.filter(t => !named.has(t) && !COLOUR_SYNONYMS[t] && !FINISH_NOISE.has(t));
    const precision = (slug.length - extra.length) / slug.length;
    // Near-exact both ways. A loose threshold is fine when the difference
    // between two products is a whole word, and useless when it is one letter:
    // at 0.6 cover, "X870-A" matched "X870-F" on four tokens out of five. The
    // colour words are already excluded from the count on both sides, so a
    // library part named plainly still matches a page whose slug spells the
    // manufacturer's colour out in full.
    if (cover < 0.85 || precision < 0.8) continue;

    const score = cover + precision + (colour && slugColours.includes(colour) ? 0.5 : 0);
    if (!best || score > best.score) best = { url, score, cover, precision };
  }
  return best;
}

// ── Fetching ─────────────────────────────────────────────────────────────────

async function fetchPage(url, { timeoutMs = 20000, acceptXml = false } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': UA, 'Accept': acceptXml ? 'application/xml,text/xml' : 'text/html,application/xhtml+xml', 'Accept-Language': 'en-AU,en;q=0.9' },
    });
    if (!res.ok) {
      // 403 from these sites means bot protection, not a missing page, and it
      // is worth telling apart: a blocked vendor needs a different approach,
      // a missing page needs a better URL.
      return { ok: false, reason: res.status === 403 || res.status === 503 ? 'blocked' : res.status === 404 ? 'not_found' : 'error', status: res.status };
    }
    const type = res.headers.get('content-type') || '';
    if (!/html|xml/i.test(type)) return { ok: false, reason: 'error', status: res.status };
    return { ok: true, html: await res.text(), url: res.url || url };
  } catch (err) {
    return { ok: false, reason: err.name === 'AbortError' ? 'timeout' : 'error', message: err.message };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchBinary(url, { timeoutMs = 20000, maxBytes = 12e6 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': UA } });
    if (!res.ok) return { ok: false, reason: res.status === 404 ? 'not_found' : 'error', status: res.status };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > maxBytes) return { ok: false, reason: 'too_large' };
    return { ok: true, buffer: buf, contentType: res.headers.get('content-type') || '' };
  } catch (err) {
    return { ok: false, reason: err.name === 'AbortError' ? 'timeout' : 'error', message: err.message };
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Same fetch, without the HTML content-type check. A sitemap is the vendor's
// own published index of its products, so where a listing page is built in the
// browser and shows a plain request nothing, this reads the same set in one
// request rather than a crawl.
async function fetchXml(url, opts) {
  const res = await fetchPage(url, { ...opts, acceptXml: true });
  return res;
}

function sitemapLocs(xml) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => decodeEntities(m[1]));
}

/**
 * Crawl a vendor's listing pages for product URLs.
 *
 * Run once per vendor, not once per part. Everything after this is offline
 * string matching against the result, which is what keeps the request count to
 * one page per part actually enriched instead of one per part attempted.
 */
async function crawlVendor(vendor, { delayMs = 700, maxPages = 120 } = {}) {
  const found = new Map();   // url -> category
  const seen = new Set();
  const problems = [];
  let pages = 0;

  for (const root of vendor.roots) {
    let frontier = [root.url];
    for (let depth = 0; depth < vendor.follow && frontier.length; depth++) {
      const next = new Set();
      for (const pageUrl of frontier) {
        if (pages >= maxPages) break;
        if (seen.has(pageUrl)) continue;
        seen.add(pageUrl);
        pages++;
        const isSitemap = /\.xml(\?|$)/i.test(pageUrl);
        const res = isSitemap ? await fetchXml(pageUrl) : await fetchPage(pageUrl);
        await sleep(delayMs);
        if (!res.ok) { problems.push({ url: pageUrl, reason: res.reason }); continue; }
        const links = isSitemap ? sitemapLocs(res.html) : extractLinks(res.html, pageUrl);
        for (const link of links) {
          const isProduct = vendor.productPattern.test(link);
          if (isProduct && !found.has(link)) found.set(link, root.category);
          // A product-looking URL is still worth descending into while depth
          // remains. Fractal's range page for the North matches the product
          // pattern and also lists the individual colourways, so treating a
          // match as a leaf stopped the crawl one level above every page that
          // actually carries specs: the library's plain "North" found nothing
          // while the North Momentum Edition, one level shallower, matched.
          if (!seen.has(link) && link.startsWith(new URL(root.url).origin) && link.includes(new URL(root.url).pathname)) {
            next.add(link);
          }
        }
      }
      frontier = [...next];
    }
  }
  return {
    urls: [...found].map(([url, category]) => ({ url, category })),
    pagesFetched: pages,
    problems,
  };
}

module.exports = {
  VENDORS, VENDOR_BY_ID, vendorForBrand, vendorMatchesPart, validate, identifyingTokens, canonicalColour, coloursIn, sitemapLocs,
  extractSpecs, extractImage, extractLinks, textPairs,
  matchUrl, nameTokens, coerce,
  fetchPage, fetchBinary, crawlVendor, sleep,
};
