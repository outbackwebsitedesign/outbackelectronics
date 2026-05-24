/* global React, ReactDOM */

const ForumPage = window.OE_PAGES && window.OE_PAGES.forum;

if (!ForumPage) {
  throw new Error('Forum page component failed to load.');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ForumPage siteUrl="https://outbackelectronics.com.au" />
);
