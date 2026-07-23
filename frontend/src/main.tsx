import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

const isAdminRoute = window.location.pathname.startsWith('/admin');
const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

if (isAdminRoute) {
  window.localStorage.setItem('jv_pwa_start_path', '/admin');
} else if (isStandalone && window.localStorage.getItem('jv_pwa_start_path') === '/admin') {
  window.location.replace('/admin');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('No se pudo registrar la PWA.', error);
    });
  });
}
