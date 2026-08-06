import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Bell, BellRing, ChevronRight } from 'lucide-react';
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
    },
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

    const url = `ws://${window.location.hostname}:4000/ws/notifications?company_id=${user.company_id}&user_id=${user.id}`;

    try {
      const ws = new WebSocket(url);
      ws.onmessage = (event) => {
        try {
          const { event: evt, data } = JSON.parse(event.data);
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
        <span key={shakeKey} className={shakeKey > 0 ? 'animate-bell-ring' : ''}>
          {unreadCount > 0 ? <BellRing size={20} /> : <Bell size={20} />}
        </span>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-indigo-500 text-white text-[10px] font-bold rounded-full border-2 border-[#0c1524] px-1 animate-in zoom-in duration-200">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[380px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Notificaciones
            </span>
            {unreadCount > 0 && (
              <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                {unreadCount} sin leer
              </span>
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
