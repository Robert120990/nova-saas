import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Bell, MessageCircle, ShieldAlert, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { unwrapList } from '../utils/apiUtils';
import {
  TelegramConfigTab,
  NotificationRulesTab,
  SuspiciousSalesTab
} from '../components/notifications';

export default function NotificacionesConfig() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SuperAdmin';
  const [activeTab, setActiveTab] = useState('telegram');

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => unwrapList(await axios.get('/api/branches'))
  });

  const { data: telegramStatus } = useQuery({
    queryKey: ['telegram-status'],
    queryFn: async () => (await axios.get('/api/notifications/telegram/status')).data
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">
              Centro de Notificaciones & Telegram Multi-Agente
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Sparkles className="w-3.5 h-3.5" /> Novas AI
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gestiona la red de agentes autónomos por Telegram, vinculación de usuarios y reglas de alerta operativas.
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('telegram')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'telegram'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          Bot de Telegram & Agentes AI
          {telegramStatus?.bindings?.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded-full text-[10px]">
              {telegramStatus.bindings.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('rules')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'rules'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Bell className="w-4 h-4" />
          Reglas de Notificación por Sucursal
        </button>

        <button
          onClick={() => setActiveTab('suspicious')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'suspicious'
              ? 'border-rose-600 text-rose-600 bg-rose-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Monitoreo de Ventas Sospechosas
        </button>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'telegram' && (
          <TelegramConfigTab
            telegramStatus={telegramStatus}
            branches={branches}
            isSuperAdmin={isSuperAdmin}
          />
        )}

        {activeTab === 'rules' && (
          <NotificationRulesTab branches={branches} />
        )}

        {activeTab === 'suspicious' && (
          <SuspiciousSalesTab branches={branches} />
        )}
      </div>
    </div>
  );
}
