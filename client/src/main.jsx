import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'
import axios from 'axios'
import { toast } from 'sonner'
import { isAnyDirty } from './store/dirtyState'

let swRegistration = null;
let isUpdating = false;
let mismatchCount = 0;
let pendingVersion = null;
let updateToastId = null;

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

const doReload = (version) => {
    localStorage.setItem('app_version', version);
    swRegistration?.update().catch(() => {});
    window.location.reload();
};

const showPersistentUpdateToast = (version) => {
    if (updateToastId) return;
    updateToastId = toast.warning(
        'NUEVA VERSION DISPONIBLE',
        {
            description: 'Guarde su trabajo antes de actualizar. Se actualizara automaticamente cuando no haya datos pendientes.',
            duration: Infinity,
            dismissible: false,
            id: 'update-persistent',
            className: 'update-toast-blink',
            style: {
                border: '2px solid #f59e0b',
                background: 'linear-gradient(90deg, #fef3c7, #fde68a, #fef3c7)',
                fontSize: '13px',
                fontWeight: 'bold'
            },
            action: {
                label: 'Actualizar ahora',
                onClick: () => {
                    updateToastId = null;
                    doReload(version);
                }
            }
        }
    );
};

const dismissPersistentToast = () => {
    if (updateToastId) {
        toast.dismiss(updateToastId);
        updateToastId = null;
    }
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
                pendingVersion = version;

                if (isAnyDirty()) {
                    showPersistentUpdateToast(version);
                } else {
                    isUpdating = true;
                    dismissPersistentToast();
                    localStorage.setItem('app_version', version);
                    toast.info('Nueva version disponible. Actualizando...', { duration: 4000 });
                    checkForUpdates();
                    setTimeout(() => window.location.reload(), 4000);
                }
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

setInterval(() => {
    if (pendingVersion && updateToastId && !isAnyDirty()) {
        isUpdating = true;
        dismissPersistentToast();
        toast.info('Actualizando aplicacion...', { duration: 3000 });
        checkForUpdates();
        setTimeout(() => window.location.reload(), 3000);
    }
}, 30000);

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
