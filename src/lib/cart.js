// Cart line identity.
//
// A cart line is a product *or* a specific variant of one. Keying on the
// product fields alone breaks when a variant has no SKU — SKU is optional in
// the product editor — because the key falls through to the product id and
// every variant of that product collides onto one line, silently overwriting
// the first. Append the variant discriminator whenever there is one.
export function cartKey(item) {
  if (!item) return '';
  const base = item.sku || item.id || item.name || '';
  const variant = item._variantSku || '';
  return variant ? `${base}::${variant}` : base;
}
