import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'
import axios from 'axios'
import { toast } from 'sonner'
import { isAnyDirty } from './store/dirtyState'

// Sincronizar versión compilada del build actual inmediatamente al arrancar
const currentBuildVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null;
if (currentBuildVersion && currentBuildVersion !== 'unknown') {
    localStorage.setItem('app_version', currentBuildVersion);
}

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
    },
    onNeedReload() {
        // Interceptamos la recarga automática de Workbox para que no recargue a espaldas del usuario
        handleUpdateDetected(pendingVersion || 'sw-update');
    }
});

const checkForUpdates = () => {
    if (isUpdating) return;
    try {
        swRegistration?.update().catch(() => {});
    } catch (e) {}
};

const doReload = async (version) => {
    if (version && version !== 'sw-update') {
        localStorage.setItem('app_version', version);
    }
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

const handleUpdateDetected = (version) => {
    if (isUpdating) return;

    const currentVersion = (currentBuildVersion && currentBuildVersion !== 'unknown')
        ? currentBuildVersion
        : localStorage.getItem('app_version');

    // Si la versión informada coincide con la que ya corre actualmente, no hacer nada
    if (version && version !== 'unknown' && version !== 'sw-update' && currentVersion === version) {
        return;
    }

    if (version && version !== 'sw-update') {
        pendingVersion = version;
    }

    if (isAnyDirty()) {
        showPersistentUpdateToast(pendingVersion || currentVersion);
        return;
    }

    // No hay formularios sucios: proceder con la recarga informada
    isUpdating = true;
    dismissPersistentToast();
    if (pendingVersion) {
        localStorage.setItem('app_version', pendingVersion);
    }
    toast.info('Nueva versión disponible. Actualizando en 3 segundos...', { duration: 3500 });

    setTimeout(() => {
        doReload(pendingVersion);
    }, 3000);
};

// Receptor para notificaciones en tiempo real vía WebSocket
window.__onVersionReceived = (version) => {
    if (version && version !== 'unknown') {
        handleUpdateDetected(version);
    }
};

const checkVersion = async () => {
    if (isUpdating || document.visibilityState !== 'visible') return;
    try {
        const { data } = await axios.get('/health');
        const version = data.version || '';
        if (!version || version === 'unknown') return;
        const currentVersion = (currentBuildVersion && currentBuildVersion !== 'unknown')
            ? currentBuildVersion
            : localStorage.getItem('app_version');

        if (currentVersion && currentVersion !== version) {
            mismatchCount++;
            if (mismatchCount >= 2) {
                handleUpdateDetected(version);
            }
            return;
        }
        mismatchCount = 0;
        if (!currentVersion) localStorage.setItem('app_version', version);
    } catch (e) {}
};

checkVersion();
setInterval(checkVersion, 5 * 60 * 1000);
setInterval(checkForUpdates, 10 * 60 * 1000);

setInterval(() => {
    if (pendingVersion && updateToastId && !isAnyDirty()) {
        isUpdating = true;
        dismissPersistentToast();
        toast.info('Actualizando aplicación en 3 segundos...', { duration: 3500 });
        setTimeout(() => doReload(pendingVersion), 3000);
    }
}, 10000);

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
