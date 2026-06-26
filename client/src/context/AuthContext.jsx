import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';

const apiUrl = import.meta.env.VITE_API_URL || '';
if (apiUrl) {
    axios.defaults.baseURL = apiUrl;
}

const HEARTBEAT_INTERVAL = 60000;

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const heartbeatRef = useRef(null);
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

    const logout = () => {
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        navigate('/login');
    };

    // 2. Global Axios Interceptor for Session Expiry (401)
    useEffect(() => {
        const interceptor = axios.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response?.status === 401) {
                    const isExcludedRequest =
                        error.config.url.includes('/api/auth/login') ||
                        error.config.url.includes('/api/sellers/login-pos') ||
                        error.config.url.includes('/api/auth/heartbeat');

                    if (!isExcludedRequest && user) {
                        toast.error('Sesión expirada. Por favor, inicie sesión de nuevo.');
                        logout();
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
                    logout();
                }
            } catch {
                // Silently ignore heartbeat errors
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

    const login = async (username, password) => {
        try {
            const { data } = await axios.post('/api/auth/login', { username, password });
            if (data.mustSelectContext) {
                setLoading(false);
                // Guardamos el tempToken para las siguientes llamadas de selección
                axios.defaults.headers.common['Authorization'] = `Bearer ${data.tempToken}`;
                return data; // Devolver para que Login.jsx maneje la selección
            }
            
            setUser(data.user);
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('token', data.token);
            axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
            navigate('/dashboard');
        } catch (error) {
            throw error;
        }
    };

    const selectContext = async (companyId, branchId) => {
        try {
            const { data } = await axios.post('/api/auth/select-context', { 
                company_id: companyId, 
                branch_id: branchId 
            });
            setUser(data.user);
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('token', data.token);
            axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
            navigate('/dashboard');
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
