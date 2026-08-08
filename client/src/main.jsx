import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'
import axios from 'axios'
import { toast } from 'sonner'

registerSW({ immediate: true })

setInterval(() => {
    if ('serviceWorker' in navigator)
        navigator.serviceWorker.getRegistration().then(reg => reg?.update())
}, 60 * 60 * 1000)

const isPWA = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    navigator.standalone === true;

const checkVersion = async () => {
    if (!isPWA() || document.visibilityState !== 'visible') return;
    try {
        const { data } = await axios.get('/health');
        const version = data.version || '';
        const last = localStorage.getItem('app_version');
        if (last && last !== version) {
            localStorage.setItem('app_version', version);
            toast.info('Nueva versión disponible. Recargando aplicación...');
            setTimeout(() => window.location.reload(), 5000);
        } else {
            localStorage.setItem('app_version', version);
        }
    } catch (e) {}
};

checkVersion();
setInterval(checkVersion, 5 * 60 * 1000);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
