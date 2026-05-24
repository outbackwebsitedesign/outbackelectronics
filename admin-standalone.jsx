/* global React, ReactDOM */

const AdminPage = window.OE_PAGES && window.OE_PAGES.admin;

if (!AdminPage) {
  throw new Error('Admin page failed to load.');
}

ReactDOM.createRoot(document.getElementById('root')).render(<AdminPage go={() => { window.location.href = 'https://outbackelectronics.com.au/home'; }} />);
