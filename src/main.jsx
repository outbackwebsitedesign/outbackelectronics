import { createRoot } from 'react-dom/client';
import '../tweaks-panel.jsx';
import '../pages-shop.jsx';
import '../pages-community.jsx';
import '../pages-info.jsx';
import '../pages-admin.jsx';
import App from '../app.jsx';

createRoot(document.getElementById('root')).render(<App />);
