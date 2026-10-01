import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import UpdateAvailableModal from '../components/ui/UpdateAvailableModal';

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

        // Comprobación contra la versión del build compilado
        const matchesBuild = (buildCommit !== 'unknown' && serverCommit === buildCommit) ||
                             (buildVersion !== 'unknown' && serverVersion === buildVersion);

        // Comprobación contra lo guardado en localStorage
        const matchesApplied = (lastAppliedCommit && serverCommit === lastAppliedCommit) ||
                               (lastAppliedVersion && serverVersion === lastAppliedVersion);

        // Si ya coincide con el build actual o ya fue aplicado en este cliente:
        // ¡YA ESTÁ ACTUALIZADO! NO sugerir actualización ni mostrar mensaje
        if (!isSimulated && (matchesBuild || matchesApplied)) {
            setUpdateAvailable(false);
            setIsModalOpen(false);
            return;
        }

        // El hash de commit debe tener formato corto de git (ej. 7-8 caracteres)
        // Si por error de red o fallback viniera la versión semántica como commit, limpiar
        const displayCommit = serverCommit.startsWith('v') ? '' : serverCommit;
        const displayVersion = serverVersion || (displayCommit ? `v2.7.${displayCommit.slice(0, 4)}` : 'v2.7.143');

        const newInfo = {
            version: displayVersion,
            commit: displayCommit,
            rawVersion: serverCommit || displayVersion
        };

        setUpdateInfo(newInfo);
        setUpdateAvailable(true);

        // Verificar si el usuario ya presionó "Más tarde" para este commit en esta sesión
        const snoozeKey = `update_snooze_${newInfo.commit || newInfo.version}`;
        const snoozedUntil = Number(sessionStorage.getItem(snoozeKey) || 0);

        if (isSimulated || Date.now() > snoozedUntil) {
            setIsModalOpen(true);
        }
    }, [buildCommit, buildVersion]);

    // Cerrar / Posponer actualización ("Más tarde" o "X")
    const dismissModal = useCallback(() => {
        setIsModalOpen(false);
        const current = updateInfoRef.current;
        const snoozeKey = `update_snooze_${current.commit || current.version}`;
        // Posponer notificación por 60 minutos en la sesión actual
        sessionStorage.setItem(snoozeKey, String(Date.now() + 60 * 60 * 1000));
    }, []);

    // Abrir modal manualmente (por ejemplo al hacer clic en el indicador del navbar)
    const openModal = useCallback(() => {
        setIsModalOpen(true);
    }, []);

    // Ejecutar actualización ÚNICAMENTE cuando el usuario presiona "Actualizar Ahora"
    const applyUpdate = useCallback(async () => {
        if (isUpdatingRef.current) return;
        isUpdatingRef.current = true;
        setIsUpdating(true);

        const current = updateInfoRef.current;
        if (current.commit) {
            localStorage.setItem('app_commit', current.commit);
            localStorage.setItem('app_version', current.commit);
            localStorage.setItem('last_applied_commit', current.commit);
        }
        if (current.version) {
            localStorage.setItem('app_semantic_version', current.version);
            localStorage.setItem('last_applied_version', current.version);
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

        // 3. Recargar la aplicación para cargar el nuevo build del servidor
        setTimeout(() => {
            window.location.reload();
        }, 300);
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
