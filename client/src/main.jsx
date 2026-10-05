import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'
import { initSentry } from './config/sentry'
import ErrorBoundary from './components/ui/ErrorBoundary'
import { UpdateProvider } from './context/UpdateContext'

// Initialize Sentry error tracking
initSentry();

const isDev = import.meta.env.DEV;

// Sincronizar versión compilada del build actual inmediatamente al arrancar
const currentBuildVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null;
if (currentBuildVersion && currentBuildVersion !== 'unknown') {
    localStorage.setItem('app_version', currentBuildVersion);
    localStorage.setItem('app_commit', currentBuildVersion);
}
const currentBuildSemantic = typeof __APP_SEMANTIC_VERSION__ !== 'undefined' ? __APP_SEMANTIC_VERSION__ : null;
if (currentBuildSemantic && currentBuildSemantic !== 'unknown') {
    localStorage.setItem('app_semantic_version', currentBuildSemantic);
}

// Limpiar parámetro de cache-busting si viene en la URL tras una actualización
try {
    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.has('_v') || currentUrl.searchParams.has('_update')) {
        currentUrl.searchParams.delete('_v');
        currentUrl.searchParams.delete('_update');
        const cleanPath = currentUrl.pathname + (currentUrl.search ? currentUrl.search : '') + currentUrl.hash;
        window.history.replaceState({}, document.title, cleanPath);
    }
} catch (e) {}

let swRegistration = null;

// Capturar errores de carga de chunks dinámicos en despliegues
window.addEventListener('vite:preloadError', (event) => {
    console.warn('Vite preload error (chunk no encontrado tras despliegue), recargando página...', event);
    window.location.reload();
});

// Registro de Service Worker en modo prompt (NO recarga a espaldas del usuario)
const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
        console.log('[PWA] Nuevo Service Worker disponible en espera.');
        fetch('/health', { headers: { 'Cache-Control': 'no-cache' } })
            .then(res => res.json())
            .then(data => {
                if (typeof window.__notifyAppUpdate === 'function') {
                    window.__notifyAppUpdate({
                        version: data.appVersion || data.version,
                        commit: data.commit || data.version
                    });
                }
            })
            .catch(() => {
                if (typeof window.__notifyAppUpdate === 'function') {
                    window.__notifyAppUpdate({
                        version: 'v2.7',
                        commit: 'sw_pending'
                    });
                }
            });
    },
    onRegisteredSW(_swUrl, registration) {
        swRegistration = registration || null;
    }
});

// Función invocada exclusivamente cuando el usuario presiona "Actualizar Ahora"
window.__triggerSWUpdate = async () => {
    if (swRegistration?.waiting) {
        try {
            swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
        } catch (e) {
            console.warn('[SW] Error enviando SKIP_WAITING:', e);
        }
    }
    if (typeof updateSW === 'function') {
        try {
            await updateSW(false);
        } catch (e) {
            console.warn('[SW] Error en updateSW:', e);
        }
    }
};

// Receptor para notificaciones en tiempo real vía WebSocket
window.__onVersionReceived = (data) => {
    if (typeof window.__notifyAppUpdate === 'function') {
        const payload = typeof data === 'object' && data !== null
            ? data
            : { version: data, commit: data };
        window.__notifyAppUpdate(payload);
    }
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary showDetails={isDev}>
      <UpdateProvider>
        <App />
      </UpdateProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
