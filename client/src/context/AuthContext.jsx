import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { getDeviceId } from '../utils/deviceId';

const apiUrl = import.meta.env.VITE_API_URL || '';
if (apiUrl) {
    axios.defaults.baseURL = apiUrl;
}

const HEARTBEAT_INTERVAL = 60000;
export const LOGOUT_NOTICE_KEY = 'auth_logout_notice';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const heartbeatRef = useRef(null);
    const isLoggingOutRef = useRef(false);
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    // 1. Initial Load
    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const token = localStorage.getItem('token');
        if (storedUser && token) {
            try {
                setUser(JSON.parse(storedUser));
                axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            } catch (e) {
                localStorage.removeItem('user');
                localStorage.removeItem('token');
            }
        }
        setLoading(false);
    }, []);

    const notifyPreviousSessionClosed = (data) => {
        if (!data?.previousSessionClosed) return;
        const prev = data.replacedSession;
        const details = prev
            ? [
                prev.device,
                prev.ip_address ? `IP ${prev.ip_address}` : null,
                prev.branch_name || prev.company_name
            ].filter(Boolean).join(' · ')
            : '';
        toast.warning('Sesión anterior cerrada automáticamente', {
            id: 'previous-session-closed',
            description: details
                ? `Tenías una sesión activa en otro equipo (${details}) y fue cerrada automáticamente al ingresar aquí.`
                : 'Tenías una sesión activa en otro equipo y fue cerrada automáticamente al ingresar aquí.',
            duration: 10000
        });
    };

    const forceLocalLogout = ({ reason = 'expired', message = '', deviceInfo = null } = {}) => {
        const hasSession = Boolean(user || localStorage.getItem('token'));
        if (!hasSession || isLoggingOutRef.current) return;

        isLoggingOutRef.current = true;
        const finalMessage = message || 'Tu sesión ha sido cerrada.';
        try {
            sessionStorage.setItem(LOGOUT_NOTICE_KEY, JSON.stringify({
                reason,
                message: finalMessage,
                deviceInfo: deviceInfo || null,
                at: Date.now()
            }));
        } catch { /* ignore storage errors */ }

        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        queryClient.clear();
        navigate('/login', { replace: true });
        toast.error(finalMessage, { id: 'session-terminated', duration: 9000 });
    };

    const forceLocalLogoutRef = useRef(forceLocalLogout);
    forceLocalLogoutRef.current = forceLocalLogout;

    const logout = () => {
        isLoggingOutRef.current = true;
        try { sessionStorage.removeItem(LOGOUT_NOTICE_KEY); } catch { /* ignore */ }
        axios.post('/api/auth/logout').catch(() => {});
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        queryClient.clear();
        navigate('/login');
    };

    // 2. Global Axios Interceptor for Session Expiry (401)
    useEffect(() => {
        const interceptor = axios.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response?.status === 401) {
                    const reqUrl = error.config?.url || '';
                    const isExcludedRequest =
                        reqUrl.includes('/api/auth/login') ||
                        reqUrl.includes('/api/sellers/login-pos') ||
                        reqUrl.includes('/api/auth/heartbeat') ||
                        reqUrl.includes('/api/auth/logout');

                    if (!isExcludedRequest && (user || localStorage.getItem('token')) && !isLoggingOutRef.current) {
                        forceLocalLogoutRef.current({
                            reason: error.response?.data?.reason || 'expired',
                            message: error.response?.data?.message || 'Sesión expirada. Por favor, inicie sesión de nuevo.'
                        });
                    }
                } else if (error.response?.status === 404) {
                    if (!error.response.data || typeof error.response.data === 'string') {
                        error.response.data = { message: 'El registro solicitado no fue encontrado o ya fue eliminado en el servidor.' };
                    } else if (!error.response.data.message || error.response.data.message.startsWith('Cannot ')) {
                        error.response.data.message = 'El registro solicitado no fue encontrado o ya fue eliminado en el servidor.';
                    }
                }
                return Promise.reject(error);
            }
        );

        return () => axios.interceptors.response.eject(interceptor);
    }, [user]);

    // 3. Heartbeat loop
    useEffect(() => {
        if (!user) return;

        const sendHeartbeat = async () => {
            try {
                const { data } = await axios.post('/api/auth/heartbeat');
                if (data.forceLogout) {
                    forceLocalLogoutRef.current({
                        reason: data.reason || 'expired',
                        message: data.message
                    });
                }
            } catch (error) {
                if (error.response?.status === 401 && error.response?.data?.sessionTerminated) {
                    forceLocalLogoutRef.current({
                        reason: error.response.data.reason || 'expired',
                        message: error.response.data.message
                    });
                }
            }
        };

        sendHeartbeat();
        heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

        return () => {
            if (heartbeatRef.current) {
                clearInterval(heartbeatRef.current);
                heartbeatRef.current = null;
            }
        };
    }, [user]);

    // 4. Real-time session termination & multi-tab logout sync
    useEffect(() => {
        if (!user) return;

        const handleSessionTerminated = (event) => {
            const detail = event?.detail || {};
            forceLocalLogoutRef.current({
                reason: detail.reason || 'replaced_by_new_login',
                message: detail.message || 'Tu sesión fue cerrada automáticamente porque iniciaste sesión en otro equipo.',
                deviceInfo: detail
            });
        };

        const handleStorageChange = (event) => {
            if (event.key === 'token' && !event.newValue && !isLoggingOutRef.current) {
                isLoggingOutRef.current = true;
                setUser(null);
                delete axios.defaults.headers.common['Authorization'];
                queryClient.clear();
                navigate('/login', { replace: true });
            }
        };

        window.addEventListener('auth:session-terminated', handleSessionTerminated);
        window.addEventListener('storage', handleStorageChange);
        return () => {
            window.removeEventListener('auth:session-terminated', handleSessionTerminated);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [user, navigate, queryClient]);

    const login = async (username, password) => {
        try {
            let publicIP = '';
            try {
                const ipRes = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
                const ipData = await ipRes.json();
                if (ipData.ip) publicIP = ipData.ip;
            } catch (e) { /* ignore */ }
            const headers = {
                'x-device-id': getDeviceId(),
                ...(publicIP ? { 'x-client-public-ip': publicIP } : {})
            };
            const { data } = await axios.post('/api/auth/login', { username, password }, { headers });
            if (data.mustSelectContext) {
                setLoading(false);
                // Guardamos el tempToken para las siguientes llamadas de selección
                axios.defaults.headers.common['Authorization'] = `Bearer ${data.tempToken}`;
                return data; // Devolver para que Login.jsx maneje la selección
            }

            try { sessionStorage.removeItem(LOGOUT_NOTICE_KEY); } catch { /* ignore */ }
            setUser(data.user);
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('token', data.token);
            axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
            isLoggingOutRef.current = false;
            notifyPreviousSessionClosed(data);
            navigate('/dashboard');
            return data;
        } catch (error) {
            throw error;
        }
    };

    const selectContext = async (companyId, branchId) => {
        try {
            const { data } = await axios.post(
                '/api/auth/select-context',
                { company_id: companyId, branch_id: branchId },
                { headers: { 'x-device-id': getDeviceId() } }
            );
            // Old requests must not populate the new company context with cached data.
            await queryClient.cancelQueries();
            queryClient.clear();
            try { sessionStorage.removeItem(LOGOUT_NOTICE_KEY); } catch { /* ignore */ }
            setUser(data.user);
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('token', data.token);
            axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
            isLoggingOutRef.current = false;
            notifyPreviousSessionClosed(data);
            navigate('/dashboard');
            return data;
        } catch (error) {
            throw error;
        }
    };


    const updateUser = (updatedData) => {
        // Obtenemos del storage para asegurar consistencia
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        const nextUser = { ...storedUser, ...updatedData };
        
        // El guardado debe ser síncrono antes del estado para evitar race conditions
        localStorage.setItem('user', JSON.stringify(nextUser));
        setUser(nextUser);
        
        // Notificamos a otras pestañas
        window.dispatchEvent(new Event('storage'));
    };

    const authValue = React.useMemo(() => ({
        user,
        login,
        logout,
        loading,
        updateUser,
        selectContext
    }), [user, loading]);

    return (
        <AuthContext.Provider value={authValue}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
