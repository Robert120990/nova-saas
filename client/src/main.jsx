import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'
import axios from 'axios'
import { toast } from 'sonner'
import { isAnyDirty } from './store/dirtyState'

const isDev = import.meta.env.DEV;

// En desarrollo local (Vite dev server), limpiar cualquier toast residual de actualización
if (isDev) {
    try {
        toast.dismiss('app-update-countdown');
        toast.dismiss('update-persistent');
    } catch (e) {}
}

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
        if (isDev) return;
        // Interceptamos la recarga automática de Workbox para que no recargue a espaldas del usuario
        handleUpdateDetected(pendingVersion || 'sw-update');
    }
});

const checkForUpdates = () => {
    if (isDev || isUpdating) return;
    try {
        swRegistration?.update().catch(() => {});
    } catch (e) {}
};

const doReload = async (version) => {
    if (isDev) return;
    if (version && version !== 'sw-update') {
        localStorage.setItem('app_version', version);
        sessionStorage.setItem('last_update_reload_version', version);
        sessionStorage.setItem('last_update_reload_time', String(Date.now()));
    }
    // Forzar activación inmediata del nuevo Service Worker (skipWaiting)
    if (swRegistration?.waiting) {
        try {
            swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
        } catch (e) {}
    }
    try {
        await swRegistration?.update();
    } catch (e) {}

    if (typeof updateSW === 'function') {
        try {
            await updateSW(true);
        } catch (e) {}
    }
    window.location.reload();
};

const showPersistentUpdateToast = (version) => {
    if (isDev || updateToastId) return;
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

const triggerCountdownReload = (version, initialPrefix = 'Nueva versión disponible') => {
    if (isDev) return;
    if (isUpdating) return;
    isUpdating = true;
    dismissPersistentToast();
    if (version && version !== 'sw-update') {
        pendingVersion = version;
        localStorage.setItem('app_version', version);
        sessionStorage.setItem('last_update_reload_version', version);
        sessionStorage.setItem('last_update_reload_time', String(Date.now()));
    }

    const toastId = 'app-update-countdown';
    let secondsLeft = 3;

    const renderText = (sec) =>
        `${initialPrefix}. Actualizando en ${sec} segundo${sec > 1 ? 's' : ''}...`;

    toast.info(renderText(secondsLeft), {
        id: toastId,
        duration: 4000,
    });

    const timer = setInterval(() => {
        secondsLeft -= 1;
        if (secondsLeft > 0) {
            toast.info(renderText(secondsLeft), {
                id: toastId,
                duration: 4000,
            });
        } else {
            clearInterval(timer);
            toast.info('Actualizando aplicación ahora...', {
                id: toastId,
                duration: 2000,
            });
            doReload(pendingVersion || version);
        }
    }, 1000);
};

const handleUpdateDetected = (version) => {
    // En desarrollo local no realizar recargas automáticas por desajuste de versión con Git
    if (isDev || isUpdating) return;

    // Protección contra bucles si tras recargar el navegador sigue recibiendo la misma versión pendiente
    const lastAttemptVersion = sessionStorage.getItem('last_update_reload_version');
    const lastAttemptTime = Number(sessionStorage.getItem('last_update_reload_time') || 0);
    if (lastAttemptVersion === version && (Date.now() - lastAttemptTime) < 60000) {
        console.warn(`[Update] Recarga para versión ${version} ya intentada recientemente. Evitando bucle.`);
        return;
    }

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

    // No hay formularios sucios: proceder con la recarga informada con cuenta regresiva
    triggerCountdownReload(pendingVersion || version, 'Nueva versión disponible');
};

// Receptor para notificaciones en tiempo real vía WebSocket
window.__onVersionReceived = (version) => {
    if (isDev) return;
    if (version && version !== 'unknown') {
        handleUpdateDetected(version);
    }
};

const checkVersion = async () => {
    if (isDev || isUpdating || document.visibilityState !== 'visible') return;
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

if (!isDev) {
    checkVersion();
    setInterval(checkVersion, 5 * 60 * 1000);
    setInterval(checkForUpdates, 10 * 60 * 1000);

    setInterval(() => {
        if (pendingVersion && updateToastId && !isAnyDirty()) {
            triggerCountdownReload(pendingVersion, 'Actualizando aplicación');
        }
    }, 10000);

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            checkForUpdates();
            checkVersion();
        }
    });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
