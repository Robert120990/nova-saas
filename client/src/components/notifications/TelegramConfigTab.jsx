import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  MessageCircle, Send, Plus, Search, Filter, ShieldCheck,
  CheckCircle, XCircle, Trash2, Settings, QrCode, Building, MapPin
} from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '../../context/ConfirmContext';
import TelegramInviteModal from './TelegramInviteModal';
import TelegramPermissionsModal from './TelegramPermissionsModal';

export default function TelegramConfigTab({ telegramStatus, branches = [], isSuperAdmin = false }) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterBranch, setFilterBranch] = useState('all');
  const [tokenInput, setTokenInput] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);

  // Modals state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);
  const [selectedBinding, setSelectedBinding] = useState(null);

  // Mutations
  const saveTokenMutation = useMutation({
    mutationFn: (token) => axios.post('/api/notifications/telegram/token', { token }),
    onSuccess: (res) => {
      queryClient.invalidateQueries(['telegram-status']);
      toast.success(res.data?.message || 'Token guardado exitosamente');
      setTokenInput('');
      setShowTokenInput(false);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar token')
  });

  const testTelegramMutation = useMutation({
    mutationFn: () => axios.post('/api/notifications/telegram/test', {}),
    onSuccess: () => toast.success('Mensaje de prueba enviado. Revisa tu Telegram.'),
    onError: (err) => toast.error(err.response?.data?.message || 'Error al enviar prueba')
  });

  const deleteBindingMutation = useMutation({
    mutationFn: (id) => axios.delete(`/api/notifications/telegram/bindings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['telegram-status']);
      toast.success('Usuario desvinculado de Telegram');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al desvincular')
  });

  const toggleAlertasMutation = useMutation({
    mutationFn: ({ id, receive_alerts }) => axios.put(`/api/notifications/telegram/bindings/${id}`, { receive_alerts }),
    onSuccess: () => {
      queryClient.invalidateQueries(['telegram-status']);
      toast.success('Preferencia de alertas actualizada');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al actualizar')
  });

  const toggleBriefingMutation = useMutation({
    mutationFn: (active) => axios.put('/api/notifications/telegram/daily-briefing', { active }),
    onSuccess: (res) => {
      queryClient.invalidateQueries(['telegram-status']);
      toast.success(res.data?.message || 'Reporte diario actualizado');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al actualizar')
  });

  const testBriefingMutation = useMutation({
    mutationFn: () => axios.post('/api/notifications/telegram/daily-briefing/test'),
    onSuccess: (res) => toast.success(res.data?.message || 'Reporte de prueba enviado a Telegram'),
    onError: (err) => toast.error(err.response?.data?.message || 'Error al enviar reporte de prueba')
  });

  const toggleReopenMutation = useMutation({
    mutationFn: (active) => axios.put('/api/notifications/telegram/reopen-requests', { active }),
    onSuccess: (res) => {
      queryClient.invalidateQueries(['telegram-status']);
      toast.success(res.data?.message || 'Configuración de reapertura actualizada');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al actualizar')
  });

  const handleDeleteBinding = async (binding) => {
    const ok = await confirm({
      title: 'Desvincular Usuario de Telegram',
      message: `¿Estás seguro de desvincular a "${binding.nombre || 'este usuario'}"? Ya no podrá consultar datos ni recibir alertas por Telegram.`,
      confirmText: 'Sí, desvincular',
      cancelText: 'Cancelar'
    });
    if (ok) {
      deleteBindingMutation.mutate(binding.id);
    }
  };

  const bindings = telegramStatus?.bindings || [];
  const filteredBindings = bindings.filter((b) => {
    const matchesSearch =
      (b.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(b.chat_id || '').includes(searchTerm);
    const matchesBranch =
      filterBranch === 'all' ||
      (filterBranch === 'global' ? !b.branch_id : String(b.branch_id) === filterBranch);
    return matchesSearch && matchesBranch;
  });

  return (
    <div className="space-y-6">
      {/* Bot Status & Global Config Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800">
                  {telegramStatus?.botInfo?.first_name || 'Bot de Telegram'}
                </h3>
                {telegramStatus?.configured ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle className="w-3 h-3" /> Conectado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    <XCircle className="w-3 h-3" /> Sin configurar
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {telegramStatus?.botInfo?.username ? (
                  <a
                    href={`https://t.me/${telegramStatus.botInfo.username}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 hover:underline font-mono"
                  >
                    @{telegramStatus.botInfo.username}
                  </a>
                ) : (
                  'El token del bot permite comunicación con el Agente Supervisor y la red multi-agente.'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => testTelegramMutation.mutate()}
              disabled={testTelegramMutation.isPending || !telegramStatus?.configured}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5 text-indigo-500" />
              {testTelegramMutation.isPending ? 'Enviando...' : 'Probar Conexión'}
            </button>
            <button
              onClick={() => setShowTokenInput(!showTokenInput)}
              className="px-3.5 py-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <Settings className="w-3.5 h-3.5" />
              {showTokenInput ? 'Cancelar' : 'Configurar Token'}
            </button>
          </div>
        </div>

        {/* Token Input Expandable */}
        {showTokenInput && (
          <form
            onSubmit={(e) => { e.preventDefault(); saveTokenMutation.mutate(tokenInput); }}
            className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
          >
            <label className="text-[11px] font-bold text-slate-500 uppercase block">
              Bot Token de BotFather
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ..."
                className="flex-1 text-[13px] font-mono border border-slate-300 rounded-xl px-3.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={saveTokenMutation.isPending}
                className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {saveTokenMutation.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        )}

        {/* Global Switches Grid */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 block">Reporte Matutino Diario</span>
              <span className="text-[11px] text-slate-500">Envía resumen ejecutivo automático cada mañana a las 8:00 AM.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => testBriefingMutation.mutate()}
                disabled={testBriefingMutation.isPending}
                className="text-[11px] text-indigo-600 hover:underline px-2 py-1"
              >
                Probar
              </button>
              <input
                type="checkbox"
                checked={telegramStatus?.dailyBriefingActive}
                onChange={(e) => toggleBriefingMutation.mutate(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 block">Reapertura de Turnos por Bot</span>
              <span className="text-[11px] text-slate-500">Permite a administradores autorizar turnos de gasolinera desde Telegram.</span>
            </div>
            <input
              type="checkbox"
              checked={telegramStatus?.reopenRequestsActive}
              onChange={(e) => toggleReopenMutation.mutate(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
          </div>
        </div>
      </div>

      {/* Linked Users Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              Usuarios Vinculados y Permisos Multi-Agente
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Controla qué agentes AI pueden atender a cada usuario y sus autorizaciones operativas.
            </p>
          </div>

          <button
            onClick={() => setInviteModalOpen(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-200 transition-all flex items-center gap-2"
          >
            <QrCode className="w-4 h-4" />
            Vincular Usuario (QR / Link)
          </button>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mb-5">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, @username o chat ID..."
              className="w-full pl-9 pr-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-48"
            >
              <option value="all">Todas las sucursales</option>
              <option value="global">Acceso Global</option>
              {branches.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Users Grid */}
        {filteredBindings.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
            <MessageCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">No hay usuarios vinculados</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
              Usa el botón "Vincular Usuario" para generar un enlace directo o código QR.
            </p>
            <button
              onClick={() => setInviteModalOpen(true)}
              className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Vincular Ahora
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBindings.map((binding) => (
              <div
                key={binding.id}
                className="p-4 rounded-2xl border border-slate-200 hover:border-indigo-200 bg-white hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-sm">
                        {(binding.nombre || 'U').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 leading-tight">
                          {binding.nombre || 'Usuario Telegram'}
                        </h4>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {binding.username ? `@${binding.username}` : `ID: ${binding.chat_id}`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteBinding(binding)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Desvincular usuario"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                      <Building className="w-3 h-3" /> {binding.company_nombre || 'Empresa'}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 text-slate-700">
                      <MapPin className="w-3 h-3" /> {binding.branch_nombre || 'Global'}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={binding.receive_alerts !== 0}
                      onChange={(e) => toggleAlertasMutation.mutate({ id: binding.id, receive_alerts: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    />
                    Alertas
                  </label>

                  <button
                    onClick={() => { setSelectedBinding(binding); setPermissionsModalOpen(true); }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Permisos
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <TelegramInviteModal
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        branches={branches}
        isSuperAdmin={isSuperAdmin}
      />

      <TelegramPermissionsModal
        open={permissionsModalOpen}
        onClose={() => { setPermissionsModalOpen(false); setSelectedBinding(null); }}
        binding={selectedBinding}
        branches={branches}
        isSuperAdmin={isSuperAdmin}
      />
    </div>
  );
}
