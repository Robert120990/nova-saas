import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import UpdateAvailableModal from '../components/ui/UpdateAvailableModal';
import { isAnyDirty, getDirtyPages } from '../store/dirtyState';

const UpdateContext = createContext(null);

export const useUpdate = () => {
    const context = useContext(UpdateContext);
    if (!context) {
        throw new Error('useUpdate debe usarse dentro de un UpdateProvider');
    }
    return context;
};

export const UpdateProvider = ({ children }) => {

    // Versión semántica autoincrementable y commit compilados en el frontend actual
    const buildCommit = typeof __APP_VERSION__ !== 'undefined' ? String(__APP_VERSION__).trim() : 'unknown';
    const buildVersion = typeof __APP_SEMANTIC_VERSION__ !== 'undefined' ? String(__APP_SEMANTIC_VERSION__).trim() : 'unknown';

    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [updateInfo, setUpdateInfo] = useState({
        version: buildVersion !== 'unknown' ? buildVersion : 'v2.7.143',
        commit: buildCommit !== 'unknown' ? buildCommit : '',
        rawVersion: ''
    });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    const isUpdatingRef = useRef(false);
    const updateInfoRef = useRef(updateInfo);
    updateInfoRef.current = updateInfo;

    // Comprobar y gestionar la detección de actualizaciones
    const handleUpdateDetected = useCallback(({ version, commit, rawVersion, isSimulated = false }) => {
        // En escáner móvil de tickets evitar interrumpir al operador
        if (window.location.pathname.startsWith('/scan-dte')) return;

        const serverVersion = (version ? String(version).trim() : '').replace(/^#/, '');
        const serverCommit = (commit ? String(commit).trim() : (rawVersion ? String(rawVersion).trim() : '')).replace(/^#/, '');

        if (!serverCommit || serverCommit === 'unknown') return;

        // Versión / commit guardado tras una actualización previa en este navegador
        const lastAppliedCommit = localStorage.getItem('last_applied_commit');
        const lastAppliedVersion = localStorage.getItem('last_applied_version');

        // Comparador tolerante de commits (primeros 7 caracteres o coincidencia prefijo)
        const commitMatch = (a, b) => {
            if (!a || !b || a === 'unknown' || b === 'unknown') return false;
            const ca = a.trim().toLowerCase();
            const cb = b.trim().toLowerCase();
            if (ca === cb) return true;
            if (ca.length >= 7 && cb.length >= 7 && ca.slice(0, 7) === cb.slice(0, 7)) return true;
            return false;
        };

        // Comprobación contra la versión del build compilado
        const matchesBuild = commitMatch(serverCommit, buildCommit) ||
                             (buildVersion !== 'unknown' && serverVersion && serverVersion === buildVersion);

        // Comprobación contra lo guardado en localStorage tras pulsar "Actualizar"
        const matchesApplied = commitMatch(serverCommit, lastAppliedCommit) ||
                               (lastAppliedVersion && serverVersion && serverVersion === lastAppliedVersion);

        // Si ya coincide con el build actual o ya fue aplicado en este cliente:
        // ¡YA ESTÁ ACTUALIZADO! NO sugerir actualización ni mostrar mensaje
        if (!isSimulated && (matchesBuild || matchesApplied)) {
            setUpdateAvailable(false);
            setIsModalOpen(false);
            return;
        }

        // El hash de commit debe tener formato corto de git (ej. 7-8 caracteres)
        const displayCommit = serverCommit.startsWith('v') ? '' : serverCommit;
        const displayVersion = serverVersion || (displayCommit ? `v2.7.${displayCommit.slice(0, 4)}` : 'v2.7.143');

        const newInfo = {
            version: displayVersion,
            commit: displayCommit,
            rawVersion: serverCommit || displayVersion
        };

        setUpdateInfo(newInfo);
        setUpdateAvailable(true);

        // Claves de snooze para silenciar si ya se pospuso o se aplicó recientemente en esta sesión
        const targetCommit = displayCommit || serverCommit;
        const snoozeKey1 = `update_snooze_${targetCommit}`;
        const snoozeKey2 = `update_snooze_${displayVersion}`;
        const snoozedUntil = Math.max(
            Number(sessionStorage.getItem(snoozeKey1) || 0),
            Number(sessionStorage.getItem(snoozeKey2) || 0)
        );

        if (isSimulated || Date.now() > snoozedUntil) {
            setIsModalOpen(true);
        }
    }, [buildCommit, buildVersion]);

    // Cerrar / Posponer actualización ("Más tarde" o "X")
    const dismissModal = useCallback(() => {
        setIsModalOpen(false);
        const current = updateInfoRef.current;
        const targetCommit = current.commit || current.rawVersion;
        if (targetCommit) {
            sessionStorage.setItem(`update_snooze_${targetCommit}`, String(Date.now() + 60 * 60 * 1000));
        }
        if (current.version) {
            sessionStorage.setItem(`update_snooze_${current.version}`, String(Date.now() + 60 * 60 * 1000));
        }
    }, []);

    // Abrir modal manualmente (por ejemplo al hacer clic en el indicador del navbar)
    const openModal = useCallback(() => {
        setIsModalOpen(true);
    }, []);

    // Ejecutar actualización ÚNICAMENTE cuando el usuario presiona "Actualizar Ahora"
    const applyUpdate = useCallback(async () => {
        if (isUpdatingRef.current) return;

        if (isAnyDirty()) {
            const pages = getDirtyPages().join(', ');
            const proceed = window.confirm(`Hay datos pendientes de guardar en las pantallas: ${pages}.\nLos borradores activos están preservados, pero se recomienda completar o guardar antes de recargar.\n\n¿Desea continuar con la actualización ahora?`);
            if (!proceed) {
                return;
            }
        }

        isUpdatingRef.current = true;
        setIsUpdating(true);

        const current = updateInfoRef.current;
        const targetCommit = current.commit || current.rawVersion || '';
        const targetVersion = current.version || '';

        // Guardar inmediatamente en localStorage y sessionStorage que este commit/versión fue aplicado
        if (targetCommit) {
            localStorage.setItem('app_commit', targetCommit);
            localStorage.setItem('app_version', targetCommit);
            localStorage.setItem('last_applied_commit', targetCommit);
            sessionStorage.setItem(`update_snooze_${targetCommit}`, String(Date.now() + 30 * 60 * 1000));
        }
        if (targetVersion) {
            localStorage.setItem('app_semantic_version', targetVersion);
            localStorage.setItem('last_applied_version', targetVersion);
            sessionStorage.setItem(`update_snooze_${targetVersion}`, String(Date.now() + 30 * 60 * 1000));
        }

        // 1. Activar nuevo Service Worker si está en espera
        try {
            if (typeof window.__triggerSWUpdate === 'function') {
                await window.__triggerSWUpdate();
            }
        } catch (e) {
            console.warn('[UpdateContext] Error activando nuevo Service Worker:', e);
        }

        // 2. Limpiar caches de recursos estáticos si la API de CacheStorage está disponible
        try {
            if ('caches' in window) {
                const keys = await window.caches.keys();
                await Promise.all(keys.map(k => window.caches.delete(k)));
            }
        } catch (e) {
            console.warn('[UpdateContext] Error limpiando cache de navegador:', e);
        }

        // 3. Forzar recarga con cache-busting en la URL para obligar al navegador a pedir el nuevo index.html
        setTimeout(() => {
            try {
                const url = new URL(window.location.href);
                url.searchParams.set('_v', Date.now().toString());
                window.location.replace(url.toString());
            } catch {
                window.location.reload();
            }
        }, 350);
    }, []);

    // Escuchador global para WebSocket y Service Worker
    useEffect(() => {
        window.__notifyAppUpdate = (data) => {
            handleUpdateDetected(data || {});
        };

        // Función accesible desde consola para probar / simular la actualización
        window.__simulateUpdate = (customVersion, customCommit) => {
            sessionStorage.clear();
            handleUpdateDetected({
                version: customVersion || 'v2.7.868',
                commit: customCommit || '44e35d6',
                rawVersion: customCommit || '44e35d6',
                isSimulated: true
            });
        };

        return () => {
            delete window.__notifyAppUpdate;
            delete window.__simulateUpdate;
        };
    }, [handleUpdateDetected]);

    // Consulta periódica al endpoint /health del servidor
    useEffect(() => {


        const checkServerVersion = async () => {
            if (isUpdatingRef.current || document.visibilityState !== 'visible') return;
            try {
                const { data } = await axios.get('/health', {
                    headers: { 'Cache-Control': 'no-cache' }
                });

                const serverCommit = data.commit || data.version || '';
                const serverAppVersion = data.appVersion || '';

                if (serverCommit && serverCommit !== 'unknown') {
                    handleUpdateDetected({
                        version: serverAppVersion,
                        commit: serverCommit,
                        rawVersion: serverCommit
                    });
                }
            } catch (err) {
                // Silencioso ante desconexión de red temporal
            }
        };

        // Verificar 5 segundos después de cargar
        const initialTimer = setTimeout(checkServerVersion, 5000);

        // Polling cada 3 minutos en segundo plano
        const interval = setInterval(checkServerVersion, 3 * 60 * 1000);

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkServerVersion();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearTimeout(initialTimer);
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [handleUpdateDetected]);

    return (
        <UpdateContext.Provider
            value={{
                updateAvailable,
                updateInfo,
                isModalOpen,
                isUpdating,
                openModal,
                closeModal: dismissModal,
                applyUpdate
            }}
        >
            {children}

            {/* Modal controlado de actualización disponible */}
            <UpdateAvailableModal
                open={isModalOpen}
                onClose={dismissModal}
                onUpdate={applyUpdate}
                version={updateInfo.version}
                commit={updateInfo.commit}
                isUpdating={isUpdating}
            />
        </UpdateContext.Provider>
    );
};

export default UpdateContext;
