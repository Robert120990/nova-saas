import { useEffect, useRef, useCallback, useState } from 'react';

export default function useWebSocket({ companyId, onMessage }) {
    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef(null);
    const reconnectTimerRef = useRef(null);
    const onMessageRef = useRef(onMessage);

    onMessageRef.current = onMessage;

    const connect = useCallback(() => {
        if (!companyId) return;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${protocol}//${window.location.hostname}:4000/ws/inventory?company_id=${companyId}`;

        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            setIsConnected(true);
        };

        ws.onmessage = (event) => {
            try {
                const parsed = JSON.parse(event.data);
                if ((parsed.event === 'app_version' || parsed.event === 'system_update') && parsed.data?.version) {
                    if (typeof window.__onVersionReceived === 'function') {
                        window.__onVersionReceived(parsed.data.version);
                    }
                }
                if (onMessageRef.current) {
                    onMessageRef.current(parsed.event, parsed.data);
                }
            } catch (err) {
                console.error('WebSocket message parse error:', err);
            }
        };

        ws.onclose = () => {
            setIsConnected(false);
            wsRef.current = null;
            if (!reconnectTimerRef.current) {
                reconnectTimerRef.current = setTimeout(() => {
                    reconnectTimerRef.current = null;
                    connect();
                }, 3000);
            }
        };

        ws.onerror = (err) => {
            console.error('WebSocket error:', err);
        };
    }, [companyId]);

    useEffect(() => {
        connect();
        return () => {
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
            if (wsRef.current) {
                wsRef.current.onclose = null;
                wsRef.current.close();
                wsRef.current = null;
            }
            setIsConnected(false);
        };
    }, [connect]);

    return { isConnected };
}
