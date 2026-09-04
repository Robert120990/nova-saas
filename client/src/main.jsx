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

// Capturar errores de carga de chunks dinámicos en despliegues
window.addEventListener('vite:preloadError', (event) => {
    console.warn('Vite preload error (chunk no encontrado tras despliegue), recargando página...', event);
    window.location.reload();
});

const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
        console.log('Nuevo Service Worker listo para activar');
    },
    onRegisteredSW(_swUrl, registration) {
        swRegistration = registration || null;
    }
});

const checkForUpdates = () => {
    try {
        swRegistration?.update().catch(() => {});
    } catch (e) {}
};

const doReload = async (version) => {
    if (version) localStorage.setItem('app_version', version);
    // Forzar activación inmediata del nuevo Service Worker (skipWaiting)
    if (swRegistration?.waiting) {
        swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    try {
        await swRegistration?.update();
    } catch (e) {}

    if (typeof updateSW === 'function') {
        try {
            await updateSW(true);
            return;
        } catch (e) {}
    }
    window.location.reload();
};

const showPersistentUpdateToast = (version) => {
    if (updateToastId) return;
    updateToastId = toast.warning(
        'NUEVA VERSIÓN DISPONIBLE',
        {
            description: 'Guarde su trabajo antes de actualizar. Se actualizará automáticamente cuando no haya datos pendientes.',
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

const processVersionMismatch = (version) => {
    if (!version || version === 'unknown' || isUpdating) return;
    const last = localStorage.getItem('app_version');
    if (!last) {
        localStorage.setItem('app_version', version);
        return;
    }
    if (last !== version) {
        pendingVersion = version;

        if (isAnyDirty()) {
            showPersistentUpdateToast(version);
        } else {
            isUpdating = true;
            dismissPersistentToast();
            localStorage.setItem('app_version', version);
            toast.info('Nueva versión disponible. Actualizando...', { duration: 4000 });
            checkForUpdates();
            setTimeout(() => doReload(version), 4000);
        }
    }
};

// Receptor para notificaciones en tiempo real vía WebSocket
window.__onVersionReceived = (version) => {
    if (version && version !== 'unknown') {
        processVersionMismatch(version);
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
                processVersionMismatch(version);
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
        toast.info('Actualizando aplicación...', { duration: 3000 });
        checkForUpdates();
        setTimeout(() => doReload(pendingVersion), 3000);
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
