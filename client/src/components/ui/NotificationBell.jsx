import { createAuthenticatedSocket } from '../../utils/webSocketUtils';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Bell, BellRing, ChevronRight, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import NotificationItem from './NotificationItem';
import NotificationToast from './NotificationToast';

const NotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dropdownRef = useRef(null);
  const { user } = useAuth();
  const wsRef = useRef(null);

  const { data: unreadData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => (await axios.get('/api/notifications/mine/unread-count')).data,
    refetchInterval: 30000,
  });

  const { data: recentData } = useQuery({
    queryKey: ['notifications-recent'],
    queryFn: async () => (await axios.get('/api/notifications/mine?limit=5&unread=true')).data,
    enabled: isOpen,
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => axios.put(`/api/notifications/mine/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-recent'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-mine'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => axios.put('/api/notifications/mine/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-recent'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-mine'] });
      toast.success('Todas las notificaciones marcadas como leídas');
    },
    onError: () => {
      toast.error('Error al marcar notificaciones como leídas');
    }
  });

  const unreadCount = unreadData?.count || 0;

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      markReadMutation.mutate(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
    setIsOpen(false);
  };

  const handleViewAll = () => {
    navigate('/notificaciones');
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const connectWebSocket = useCallback(() => {
    if (!user?.company_id || !user?.id) return;


    try {
      const ws = createAuthenticatedSocket('/ws/notifications', user.company_id);
      ws.onmessage = (event) => {
        try {
          const { event: evt, data } = JSON.parse(event.data);
          if ((evt === 'app_version' || evt === 'system_update') && (data?.version || data?.commit)) {
            if (typeof window.__onVersionReceived === 'function') {
              window.__onVersionReceived(data);
            }
          }
          if (evt && evt.startsWith('ticket_')) {
            if (typeof window.__onTicketEvent === 'function') {
              window.__onTicketEvent(evt, data);
            }
          }
          if (evt && (evt === 'gas_closeout_reopened' || evt === 'gas_closeout_reopen_approved' || evt === 'gas_closeout_reopen_rejected')) {
            queryClient.invalidateQueries({ queryKey: ['gas-closeouts'] });
          }
          if (evt === 'new_notification') {
            queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
            if (isOpen) {
              queryClient.invalidateQueries({ queryKey: ['notifications-recent'] });
            }

            setShakeKey((k) => k + 1);

            toast.custom((t) => (
              <NotificationToast notification={data} toastId={t} onClick={() => {
                if (data?.link) navigate(data.link);
                toast.dismiss(t);
              }} />
            ), { duration: 5000 });
          }
        } catch (e) {}
      };
      ws.onclose = () => {
        setTimeout(connectWebSocket, 5000);
      };
      wsRef.current = ws;
    } catch (e) {}
  }, [user?.company_id, user?.id, queryClient, isOpen, navigate]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white bg-slate-800/30 hover:bg-slate-800/60 rounded-xl relative transition-all group"
      >
        <span key={shakeKey} className={`inline-block origin-top ${shakeKey > 0 ? 'animate-bell-ring' : ''}`}>
          {unreadCount > 0 ? <BellRing size={20} /> : <Bell size={20} />}
        </span>
        {unreadCount > 0 && (
          <span
            key={`badge-${shakeKey}`}
            className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-indigo-500 text-white text-[10px] font-bold rounded-full border-2 border-[#0c1524] px-1 ${
              shakeKey > 0 ? 'animate-badge-pop' : 'animate-in zoom-in duration-200'
            }`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed left-2 right-2 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[380px] sm:max-w-[380px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest truncate">
                Notificaciones
              </span>
              {unreadCount > 0 && (
                <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                  {unreadCount} sin leer
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  markAllReadMutation.mutate();
                }}
                disabled={markAllReadMutation.isPending}
                className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50/80 px-2 py-1 rounded-lg transition-all active:scale-95 disabled:opacity-50 shrink-0"
                title="Marcar todas como leídas"
              >
                <CheckCheck size={14} className="shrink-0 text-indigo-600" />
                <span className="hidden sm:inline">Marcar todas como leídas</span>
                <span className="sm:hidden">Marcar leídas</span>
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto custom-scrollbar divide-y divide-slate-50">
            {recentData?.data?.length > 0 ? (
              recentData.data.map((notif, idx) => (
                <div
                  key={notif.id}
                  className="animate-slide-in-right"
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  <NotificationItem
                    notification={notif}
                    onClick={handleNotificationClick}
                    onMarkRead={(id) => markReadMutation.mutate(id)}
                    compact
                  />
                </div>
              ))
            ) : (
              <div className="p-8 text-center animate-in fade-in duration-300">
                <Bell size={32} className="mx-auto text-slate-200 mb-3" />
                <p className="text-sm text-slate-400 font-medium">No hay notificaciones</p>
              </div>
            )}
          </div>

          <button
            onClick={handleViewAll}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-sm font-bold text-indigo-600 transition-colors border-t border-slate-100"
          >
            <span>Ver todas las notificaciones</span>
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
