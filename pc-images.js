// Product images for the parts library.
//
// Stored under assets/part-images so the existing static handler serves them,
// with the immutable cache header it already applies to images. They are
// fetched data rather than source, so the directory is gitignored alongside the
// .db files.
//
// Two sizes are written from one download: a thumbnail for scrolling the picker
// and a larger one for the build view and the quote. The original is thrown
// away. Vendors serve 2560px marketing shots at around 280KB each, which across
// the visual categories would be twenty gigabytes for pictures no one ever sees
// at that size; the two derived sizes together come to under 21KB.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let sharp = null;
try { sharp = require('sharp'); } catch { /* resized images unavailable */ }

const IMAGE_DIR = path.join(__dirname, 'assets', 'part-images');
const PUBLIC_BASE = '/assets/part-images';

const SIZES = [
  { suffix: 'thumb', width: 320 },
  { suffix: 'large', width: 900 },
];

function ensureDir() {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
}

/**
 * Storage key for a part.
 *
 * Keyed by what the picture is of, not by which part row wants it. Memory is
 * the clear case: a line comes in dozens of kits differing by capacity, speed
 * and latency, and every one of them is the same photograph. Sharing the key
 * across them turns eleven thousand downloads into under three thousand.
 *
 * Colour is always part of the key. A white kit and a black kit are different
 * pictures, and picking parts for a themed build is exactly when the picture
 * matters most.
 */
function imageKey(part) {
  const base = String(part.sourceName || part.name || '')
    .toLowerCase()
    // Capacity, speed and latency vary within one product line and never
    // change what it looks like.
    .replace(/\b\d+\s*gb\b/g, ' ')
    .replace(/\bddr\d(?:-\d+)?\b/g, ' ')
    .replace(/\bcl\d+\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const colour = String(part.specs?.colour || '').toLowerCase();
  const raw = `${part.category}|${base}|${colour}`;
  return crypto.createHash('sha1').update(raw).digest('hex').slice(0, 20);
}

function pathsFor(key) {
  return SIZES.map(s => ({ ...s, file: path.join(IMAGE_DIR, `${key}-${s.suffix}.webp`), url: `${PUBLIC_BASE}/${key}-${s.suffix}.webp` }));
}

function hasImage(key) {
  return pathsFor(key).every(p => fs.existsSync(p.file));
}

function urlsFor(key) {
  const [thumb, large] = pathsFor(key);
  return { thumb: thumb.url, large: large.url };
}

/**
 * Write both sizes from a downloaded image.
 *
 * `fit: 'inside'` keeps the aspect ratio and never upscales, so a vendor that
 * publishes a small image gets stored at its own size rather than blown up into
 * something blurry that looks like a fault in the picker.
 */
async function storeImage(key, buffer) {
  if (!sharp) return { ok: false, reason: 'no_sharp' };
  ensureDir();
  try {
    for (const size of pathsFor(key)) {
      const out = await sharp(buffer)
        .resize({ width: size.width, withoutEnlargement: true, fit: 'inside' })
        .webp({ quality: 78 })
        .toBuffer();
      const tmp = `${size.file}.tmp`;
      fs.writeFileSync(tmp, out);
      fs.renameSync(tmp, size.file);
    }
    return { ok: true, urls: urlsFor(key) };
  } catch (err) {
    return { ok: false, reason: 'decode_failed', message: err.message };
  }
}

function countStored() {
  try {
    return fs.readdirSync(IMAGE_DIR).filter(f => f.endsWith('-thumb.webp')).length;
  } catch { return 0; }
}

module.exports = { IMAGE_DIR, PUBLIC_BASE, imageKey, hasImage, urlsFor, storeImage, countStored, sharpAvailable: () => !!sharp };
