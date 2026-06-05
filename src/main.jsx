import { createRoot } from 'react-dom/client';
import '../tweaks-panel.jsx';
import '../pages-shop.jsx'; // home, shop, product, service, memberships, etc.
import App from '../app.jsx';

// Pages not needed on the home/shop path — deferred to keep initial bundle small
const SHOP_INIT_PAGES = new Set([
  '', 'home', 'shop', 'product', 'service', 'services', 'software',
  'ai', 'ewaste', 'memberships', 'gift-cards', 'cart',
  'order-success', 'order-cancelled',
]);
const initPage = location.pathname.replace(/^\/+/, '').split('/')[0];
const needsDeferredNow = !SHOP_INIT_PAGES.has(initPage);

function loadDeferredChunks() {
  return Promise.all([
    import('../pages-info.jsx'),
    import('../pages-community.jsx'),
  ]);
}

if (needsDeferredNow) {
  // Deep link to a non-shop page: load chunks before first render
  loadDeferredChunks().then(() => {
    createRoot(document.getElementById('root')).render(<App />);
  });
} else {
  createRoot(document.getElementById('root')).render(<App />);
  // Load remaining page chunks after first paint so they don't block home page
  const schedule = window.requestIdleCallback || (fn => setTimeout(fn, 200));
  schedule(() => loadDeferredChunks());
}
