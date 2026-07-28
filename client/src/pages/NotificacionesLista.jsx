import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Bell, CheckCheck, Filter, MailOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import NotificationItem from '../components/ui/NotificationItem';
import Pagination from '../components/ui/Pagination';

const NotificacionesLista = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['notifications-mine', filter, page],
    queryFn: async () => {
      const unreadParam = filter === 'unread' ? '&unread=true' : '';
      return (await axios.get(`/api/notifications/mine?page=${page}&limit=20${unreadParam}`)).data;
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => axios.put(`/api/notifications/mine/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-mine'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => axios.put('/api/notifications/mine/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-mine'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      toast.success('Todas las notificaciones marcadas como leídas');
    },
  });

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      markReadMutation.mutate(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const filters = [
    { value: 'all', label: 'Todas' },
    { value: 'unread', label: 'No leídas' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell size={28} className="text-indigo-600" />
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Notificaciones</h2>
            <p className="text-slate-500 font-medium">Historial de todas tus notificaciones</p>
          </div>
        </div>
        <button
          onClick={() => markAllReadMutation.mutate()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl text-sm hover:bg-indigo-700 transition-all active:scale-95"
        >
          <CheckCheck size={16} />
          Marcar todas como leídas
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Filter size={16} className="text-slate-400" />
        {filters.map(f => (
          <button
            key={f.value}
            onClick={() => { setFilter(f.value); setPage(1); }}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filter === f.value
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-20 text-center">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <span className="text-slate-400 font-medium">Cargando notificaciones...</span>
          </div>
        ) : data?.data?.length > 0 ? (
          <div className="divide-y divide-slate-50">
            {data.data.map((notif, idx) => (
              <div
                key={notif.id}
                className="animate-slide-in-bottom"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <NotificationItem
                  notification={notif}
                  onClick={handleNotificationClick}
                  onMarkRead={(id) => markReadMutation.mutate(id)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="p-20 text-center">
            <MailOpen size={48} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-400 font-medium">
              {filter === 'unread' ? 'No tienes notificaciones sin leer' : 'No hay notificaciones'}
            </p>
          </div>
        )}
      </div>

      {data && data.totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={data.totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
};

export default NotificacionesLista;
