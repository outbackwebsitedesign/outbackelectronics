import { createRoot } from 'react-dom/client';
import AdminPage from '../pages-admin.jsx';
import '../pc-dryrun-ui.js';

createRoot(document.getElementById('root')).render(<AdminPage go={() => { window.location.href = 'https://outbackelectronics.com.au/home'; }} />);
