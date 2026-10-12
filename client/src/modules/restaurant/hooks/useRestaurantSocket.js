import { useEffect, useRef, useCallback, useState } from 'react';
import { createAuthenticatedSocket } from '../../../utils/webSocketUtils';

// Reproduce timbres sonoros sintetizados mediante Web Audio API (cero dependencias de archivos mp3 externos)
function playTone(type = 'chime') {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();

        if (type === 'alert') {
            // Tono de alerta de anulación (urgente / grave)
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            osc.frequency.setValueAtTime(330, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.4);
        } else if (type === 'ready') {
            // Tono comanda lista (dos campanadas agudas)
            const playBell = (freq, time) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, ctx.currentTime + time);
                gain.gain.setValueAtTime(0.25, ctx.currentTime + time);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + 0.5);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(ctx.currentTime + time);
                osc.stop(ctx.currentTime + time + 0.5);
            };
            playBell(587.33, 0); // D5
            playBell(880.00, 0.2); // A5
        } else {
            // Chime de nueva comanda (armónico y limpio)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'triangle';
            osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
            osc1.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12); // E5
            osc1.frequency.setValueAtTime(783.99, ctx.currentTime + 0.24); // G5
            gain1.gain.setValueAtTime(0.3, ctx.currentTime);
            gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start();
            osc1.stop(ctx.currentTime + 0.6);
        }
    } catch (err) {
        console.warn('Audio chime playback blocked by browser gesture policy:', err);
    }
}

export default function useRestaurantSocket({ companyId, onEvent }) {
    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef(null);
    const reconnectTimerRef = useRef(null);
    const onEventRef = useRef(onEvent);

    onEventRef.current = onEvent;

    const connect = useCallback(() => {
        if (!companyId) return;

        const ws = createAuthenticatedSocket('/ws/restaurant', companyId);
        wsRef.current = ws;

        ws.onopen = () => {
            setIsConnected(true);
        };

        ws.onmessage = (messageEvent) => {
            try {
                const parsed = JSON.parse(messageEvent.data);
                const { event, data } = parsed;

                // Reproducción de sonido contextual
                if (event === 'restaurant:new_order' || event === 'restaurant:order_updated') {
                    playTone('chime');
                } else if (event === 'restaurant:item_cancelled') {
                    playTone('alert');
                } else if (event === 'restaurant:order_ready') {
                    playTone('ready');
                }

                if (onEventRef.current) {
                    onEventRef.current(event, data);
                }
            } catch (err) {
                console.error('Restaurant WebSocket parse error:', err);
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
            console.error('Restaurant WebSocket error:', err);
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

    return { isConnected, playTone };
}
