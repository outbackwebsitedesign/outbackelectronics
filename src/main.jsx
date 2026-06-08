import { createRoot } from 'react-dom/client';
import '../pages-shop.jsx';
import App from '../app.jsx';

const SHOP_INIT_PAGES = new Set([
  '', 'home', 'shop', 'product', 'service', 'services', 'software',
  'ai', 'ewaste', 'memberships', 'gift-cards',
]);
const initPage = location.pathname.replace(/^\/+/, '').split('/')[0];
const needsDeferredNow = !SHOP_INIT_PAGES.has(initPage);

let _deferredLoaded = false;
function loadDeferredChunks() {
  if (_deferredLoaded) return Promise.resolve();
  _deferredLoaded = true;
  return Promise.all([
    import('../tweaks-panel.jsx'),
    import('../pages-info.jsx'),
    import('../pages-community.jsx'),
    import('../pages-cart.jsx'),
  ]);
}
window.__loadDeferredChunks = loadDeferredChunks;

if (needsDeferredNow) {
  loadDeferredChunks().then(() => {
    createRoot(document.getElementById('root')).render(<App />);
  });
} else {
  createRoot(document.getElementById('root')).render(<App />);
  const preloadOnInteraction = () => {
    loadDeferredChunks();
    for (const e of ['mouseover', 'touchstart', 'keydown']) {
      document.removeEventListener(e, preloadOnInteraction);
    }
  };
  for (const e of ['mouseover', 'touchstart', 'keydown']) {
    document.addEventListener(e, preloadOnInteraction, { once: true, passive: true });
  }
}
