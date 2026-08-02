// Canonical product condition vocabulary.
//
// Conditions used to be derived from whatever values products already carried,
// which meant a condition could only be picked if some other product already
// used it — there was no way to introduce the first one. This is the fixed
// list instead. Values are stored on the product as plain strings (`cond`), so
// editing a label here does not rewrite existing products; the admin editor
// keeps any legacy value still in use as an extra option so nothing is lost.

export const PRODUCT_CONDITIONS = [
  'New',
  'New — Open Box',
  'Refurbished',
  'Used — Excellent',
  'Used — Good',
  'Used — Fair',
  'For Parts / Not Working',
];

// Colour-coded so "New" vs "Refurbished" reads at a glance on the shop page.
// Anything not listed falls back to neutral ink.
export const CONDITION_COLORS = {
  'New': 'var(--eucalyptus)',
  'New — Open Box': 'var(--eucalyptus)',
  'Refurbished': 'var(--ochre)',
  'Used — Excellent': 'var(--ochre)',
  'Used — Good': 'var(--rust)',
  'Used — Fair': 'var(--rust)',
  'For Parts / Not Working': 'var(--ink-2)',
  // Legacy value — products predating the fixed list may still carry it.
  'Used': 'var(--rust)',
};
