import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'
import axios from 'axios'
import { toast } from 'sonner'

let swRegistration = null;
let isUpdating = false;
let mismatchCount = 0;

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
        if (!version || version === 'unknown') return;
        const last = localStorage.getItem('app_version');
        if (last && last !== version) {
            mismatchCount++;
            if (mismatchCount >= 2) {
                isUpdating = true;
                localStorage.setItem('app_version', version);
                toast.info('Nueva versión disponible. Actualizando la aplicación...', { duration: 4000 });
                checkForUpdates();
                setTimeout(() => window.location.reload(), 4000);
            }
            return;
        }
        mismatchCount = 0;
        if (last !== version) localStorage.setItem('app_version', version);
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
