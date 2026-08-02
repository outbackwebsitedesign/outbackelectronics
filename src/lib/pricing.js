// Bulk ("buy N or more") pricing.
//
// A product — or an individual variant, when the product has variants — can
// carry a `bulkQty` threshold and a `bulkPrice` unit price. Order that many
// units or more and every unit on the line drops to the bulk price; order
// fewer and they all stay at the normal price.
//
// There is no separate stock pool for the bulk price: it is the same units at
// a different rate. So once stock falls below `bulkQty` the threshold simply
// becomes unreachable and the offer disappears on its own.
//
// NOTE: server.js carries a CommonJS copy of `bulkUnitPrice` (it cannot import
// this ESM module). The server is authoritative for money — if you change the
// rule here, change it there too.

export function bulkUnitPrice(entry, qty) {
  if (!entry) return 0;
  const base = Number(entry.price ?? entry.priceAud) || 0;
  const bulkQty = Math.floor(Number(entry.bulkQty) || 0);
  const bulkPrice = Number(entry.bulkPrice) || 0;
  if (bulkQty >= 2 && bulkPrice > 0 && Number(qty) >= bulkQty) return bulkPrice;
  return base;
}

// True when this entry advertises a bulk rate at all, regardless of the
// quantity currently in the cart.
export function hasBulkPrice(entry) {
  if (!entry) return false;
  const base = Number(entry.price ?? entry.priceAud) || 0;
  return Math.floor(Number(entry.bulkQty) || 0) >= 2
    && Number(entry.bulkPrice) > 0
    && Number(entry.bulkPrice) < base;
}

// How many units a customer may put in their cart, or null when uncapped.
// A backorder product is uncapped: the point of accepting backorders is that
// running out does not stop the sale.
export function availableStock(entry) {
  if (!entry) return 0;
  if (entry.infiniteStock || entry.allowBackorder) return null;
  return Number(entry.stock) || 0;
}

// Units physically on the shelf, ignoring any backorder allowance. Goes
// negative once more has been sold than held, which is the number owed.
export function onHandStock(entry) {
  if (!entry) return 0;
  if (entry.infiniteStock) return null;
  return Number(entry.stock) || 0;
}

// Buyable, but not from stock: it will be ordered in.
export function isBackorder(entry) {
  if (!entry || entry.infiniteStock || !entry.allowBackorder) return false;
  return (Number(entry.stock) || 0) <= 0;
}

// A bulk offer is only real while enough units remain to reach the threshold.
export function bulkOfferAvailable(entry) {
  if (!hasBulkPrice(entry)) return false;
  const stock = availableStock(entry);
  return stock === null || stock >= Math.floor(Number(entry.bulkQty) || 0);
}

// A product's own price. Products carry it as `priceAud`; older records may
// still have the legacy `price` key until the migration has been run. Variants
// are unaffected: their price has always lived on `price`.
export function productPrice(p) {
  if (!p) return 0;
  return Number(p.priceAud ?? p.price) || 0;
}
