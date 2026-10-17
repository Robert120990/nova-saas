import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { unwrapList } from '../utils/apiUtils';
import { initTicketDiagnostics } from '../utils/ticketDiagnostics';
import { compressTicketCanvas } from '../utils/ticketImageCompressor';
import {
    QuickTicketModal,
    TicketResolvedModal,
    TicketDetailModal
} from '../components/tickets';

initTicketDiagnostics();

const TicketContext = createContext(null);

export const TicketProvider = ({ children }) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    useEffect(() => {
        initTicketDiagnostics();
    }, []);

    const [quickTicketOpen, setQuickTicketOpen] = useState(false);
    const [initialSubject, setInitialSubject] = useState('');
    const [initialScreenshot, setInitialScreenshot] = useState(null);
    const [detailTicketId, setDetailTicketId] = useState(null);
    const [dismissedIds, setDismissedIds] = useState(() => new Set());
    const [realtimeResolvedQueue, setRealtimeResolvedQueue] = useState([]);

    const canManageTickets = useMemo(() => {
        if (!user) return false;
        const role = String(user.role || '').toLowerCase();
        if (role === 'superadmin' || role.includes('admin') || role.includes('soporte') || role.includes('tecnico')) {
            return true;
        }
        let perms = user.permissions || [];
        if (typeof perms === 'string') {
            try { perms = JSON.parse(perms); } catch { perms = []; }
        }
        return Array.isArray(perms) && perms.includes('manage_support_tickets');
    }, [user]);

    // Fetch pending resolved tickets exclusively for the current creator user
    const { data: fetchedResolved = [] } = useQuery({
        queryKey: ['tickets-pending-resolved', user?.id],
        queryFn: async () => {
            try {
                return unwrapList(await axios.get('/api/tickets/pending-resolved'));
            } catch {
                return [];
            }
        },
        enabled: Boolean(user?.id && !user?.isTemp),
        retry: false,
        refetchInterval: 45000,
        refetchOnWindowFocus: true
    });

    // Combine server-fetched pending resolved tickets and real-time WebSocket resolved tickets
    const activeResolvedTickets = useMemo(() => {
        if (!user?.id) return [];
        const map = new Map();
        const serverList = Array.isArray(fetchedResolved) ? fetchedResolved : [];
        serverList.forEach((t) => {
            if (Number(t.user_id) === Number(user.id) && !dismissedIds.has(Number(t.id))) {
                map.set(Number(t.id), t);
            }
        });
        realtimeResolvedQueue.forEach((t) => {
            if (Number(t.user_id) === Number(user.id) && !dismissedIds.has(Number(t.id))) {
                map.set(Number(t.id), t);
            }
        });
        return Array.from(map.values());
    }, [fetchedResolved, realtimeResolvedQueue, dismissedIds, user?.id]);

    const currentResolvedTicket = activeResolvedTickets[0] || null;

    // Acknowledge resolved ticket mutation
    const acknowledgeMutation = useMutation({
        mutationFn: (ticketId) => axios.put(`/api/tickets/${ticketId}/acknowledge`),
        onSuccess: (_, ticketId) => {
            const numId = Number(ticketId);
            setDismissedIds((prev) => new Set(prev).add(numId));
            setRealtimeResolvedQueue((prev) => prev.filter((t) => Number(t.id) !== numId));
            queryClient.invalidateQueries({ queryKey: ['tickets-pending-resolved'] });
            queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
            queryClient.invalidateQueries({ queryKey: ['ticket-detail', numId] });
        },
        onError: () => {
            toast.error('No se pudo confirmar la lectura del ticket');
        }
    });

    const handleAcknowledge = useCallback((ticketId) => {
        acknowledgeMutation.mutate(ticketId);
    }, [acknowledgeMutation]);

    const handleDismissLater = useCallback((ticketId) => {
        const numId = Number(ticketId);
        setDismissedIds((prev) => new Set(prev).add(numId));
    }, []);

    const openQuickTicket = useCallback(async ({ subject = '', autoCapture = true } = {}) => {
        setInitialSubject(subject || '');
        if (autoCapture) {
            try {
                // Wait briefly so CommandPalette or dropdown closes before capturing screen
                await new Promise((r) => setTimeout(r, 140));
                const canvas = await html2canvas(document.body, {
                    useCORS: true,
                    allowTaint: true,
                    logging: false,
                    scale: Math.min(window.devicePixelRatio || 1, 1.5),
                    ignoreElements: (el) => el.getAttribute?.('data-ticket-modal') === 'true'
                });
                const dataUrl = compressTicketCanvas(canvas);
                setInitialScreenshot(dataUrl);
            } catch (err) {
                console.warn('Auto screen capture skipped:', err.message);
                setInitialScreenshot(null);
            }
        } else {
            setInitialScreenshot(null);
        }
        setQuickTicketOpen(true);
    }, []);

    const closeQuickTicket = useCallback(() => {
        setQuickTicketOpen(false);
    }, []);

    const openTicketDetail = useCallback((ticketOrId) => {
        const id = typeof ticketOrId === 'object' ? ticketOrId?.id : ticketOrId;
        if (id) setDetailTicketId(Number(id));
    }, []);

    const closeTicketDetail = useCallback(() => {
        setDetailTicketId(null);
    }, []);

    // Global shortcut Ctrl + Shift + K to capture screen & open ticket modal
    useEffect(() => {
        const handleKeyDown = (e) => {
            try {
                if (!e || typeof e.key !== 'string') return;
                if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'k') {
                    if (!user?.id) return;
                    e.preventDefault();
                    openQuickTicket({ autoCapture: true });
                }
            } catch { /* Noop */ }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [user?.id, openQuickTicket]);

    // Real-time WebSocket listener hooked from NotificationBell.jsx
    useEffect(() => {
        window.__onTicketEvent = (evt, data) => {
            try {
                if (!user?.id) return;

                if (evt === 'ticket_resolved' && data) {
                    // Strict check: ONLY show popup to the creator of this ticket
                    if (Number(data.user_id) === Number(user.id)) {
                        setDismissedIds((prev) => {
                            const next = new Set(prev);
                            next.delete(Number(data.id));
                            return next;
                        });
                        setRealtimeResolvedQueue((prev) => {
                            const filtered = prev.filter((t) => Number(t.id) !== Number(data.id));
                            return [data, ...filtered];
                        });
                        queryClient.invalidateQueries({ queryKey: ['tickets-pending-resolved'] });
                    }
                }

                if (evt === 'ticket_created' || evt === 'ticket_updated' || evt === 'ticket_resolved' || evt === 'ticket_message') {
                    queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
                    queryClient.invalidateQueries({ queryKey: ['support-tickets-stats'] });
                    if (data?.id || data?.ticket_id) {
                        queryClient.invalidateQueries({
                            queryKey: ['ticket-detail', Number(data.id || data.ticket_id)]
                        });
                    }
                }
            } catch { /* Noop */ }
        };

        return () => {
            if (window.__onTicketEvent) {
                delete window.__onTicketEvent;
            }
        };
    }, [user?.id, queryClient]);

    const contextValue = useMemo(() => ({
        openQuickTicket,
        closeQuickTicket,
        openTicketDetail,
        closeTicketDetail,
        canManageTickets,
        pendingResolvedCount: activeResolvedTickets.length
    }), [openQuickTicket, closeQuickTicket, openTicketDetail, closeTicketDetail, canManageTickets, activeResolvedTickets.length]);

    return (
        <TicketContext.Provider value={contextValue}>
            {children}

            {user?.id && (
                <>
                    <QuickTicketModal
                        open={quickTicketOpen}
                        onClose={closeQuickTicket}
                        initialSubject={initialSubject}
                        initialScreenshot={initialScreenshot}
                        onSuccess={() => {
                            queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
                            queryClient.invalidateQueries({ queryKey: ['support-tickets-stats'] });
                        }}
                    />

                    <TicketResolvedModal
                        open={Boolean(currentResolvedTicket)}
                        ticket={currentResolvedTicket}
                        totalPending={activeResolvedTickets.length}
                        isAcknowledging={acknowledgeMutation.isPending}
                        onAcknowledge={handleAcknowledge}
                        onDismissLater={handleDismissLater}
                        onViewDetail={(ticket) => {
                            openTicketDetail(ticket.id);
                        }}
                    />

                    <TicketDetailModal
                        open={Boolean(detailTicketId)}
                        ticketId={detailTicketId}
                        canManage={canManageTickets}
                        onClose={closeTicketDetail}
                    />
                </>
            )}
        </TicketContext.Provider>
    );
};

export const useTickets = () => {
    const ctx = useContext(TicketContext);
    if (!ctx) {
        return {
            openQuickTicket: () => {},
            closeQuickTicket: () => {},
            openTicketDetail: () => {},
            closeTicketDetail: () => {},
            canManageTickets: false,
            pendingResolvedCount: 0
        };
    }
    return ctx;
};
