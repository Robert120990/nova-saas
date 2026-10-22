import axios from 'axios';
import { toast } from 'sonner';

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1200, 2500, 4000];

/**
 * Determina si un error HTTP o de red califica para reintento automático
 * (p. ej., backend reiniciándose, caída temporal de socket o proxy 502/503/504).
 */
export function isRetryableError(error) {
    if (!error) return false;

    // Petición cancelada intencionalmente en frontend (AbortController / debounce)
    if (axios.isCancel(error) || error.code === 'ERR_CANCELED') return false;

    // Error de red puro (el backend no respondió o cortó la conexión durante reinicio)
    if (!error.response) return true;

    // Errores de infraestructura o pasarela temporal mientras levanta el servidor
    const status = error.response.status;
    return status === 502 || status === 503 || status === 504;
}

/**
 * Inicializa el interceptor global de reintentos con backoff exponencial.
 */
export function setupAxiosRetry(axiosInstance = axios) {
    return axiosInstance.interceptors.response.use(
        (response) => {
            // Cerrar cualquier notificación de reconexión previa
            toast.dismiss('network-reconnect');
            return response;
        },
        async (error) => {
            const config = error.config;

            // Si no hay configuración o el error no es transitorio (ej. 400, 401, 403, 422), rechazar
            if (!config || !isRetryableError(error)) {
                return Promise.reject(error);
            }

            // Excluir endpoints que no deben reintentarse (ej. login o heartbeat)
            const url = config.url || '';
            if (url.includes('/api/auth/login') || url.includes('/api/auth/logout')) {
                return Promise.reject(error);
            }

            config.__retryCount = config.__retryCount || 0;

            if (config.__retryCount >= MAX_RETRIES) {
                toast.dismiss('network-reconnect');
                return Promise.reject(error);
            }

            const attempt = config.__retryCount + 1;
            config.__retryCount = attempt;
            const delay = RETRY_DELAYS[attempt - 1] || 3000;

            toast.loading(`Reconectando con el servidor (intento ${attempt} de ${MAX_RETRIES})...`, {
                id: 'network-reconnect',
                duration: 10000
            });

            await new Promise((resolve) => setTimeout(resolve, delay));

            try {
                return await axiosInstance(config);
            } catch (retryError) {
                return Promise.reject(retryError);
            }
        }
    );
}
