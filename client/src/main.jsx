import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'
import axios from 'axios'
import { toast } from 'sonner'

let swRegistration = null;
let isUpdating = false;

registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
        swRegistration = registration || null;
    }
});

const checkForUpdates = () => {
    try {
        swRegistration?.update().catch(() => {});
    } catch (e) {}
};

const checkVersion = async () => {
    if (isUpdating || document.visibilityState !== 'visible') return;
    try {
        const { data } = await axios.get('/health');
        const version = data.version || '';
        const last = localStorage.getItem('app_version');
        localStorage.setItem('app_version', version);
        if (last && last !== version) {
            isUpdating = true;
            toast.info('Nueva versión disponible. Actualizando la aplicación...', { duration: 4000 });
            checkForUpdates();
            setTimeout(() => window.location.reload(), 4000);
        }
    } catch (e) {}
};

checkVersion();
setInterval(checkVersion, 5 * 60 * 1000);
setInterval(checkForUpdates, 10 * 60 * 1000);

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        checkForUpdates();
        checkVersion();
    }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
