import { createRoot } from 'react-dom/client';
import AdminPage from '../pages-admin.jsx';
createRoot(document.getElementById('root')).render(<AdminPage go={() => { window.location.href = 'https://outbackelectronics.com.au/home'; }} />);
