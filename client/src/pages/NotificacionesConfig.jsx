import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Bell, Plus, GitBranch, Settings, Trash2, Edit3, MessageCircle, Send, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import RuleEditor from '../components/ui/RuleEditor';
import { useConfirm } from '../context/ConfirmContext';

const categoryColors = {
  ventas: '#10b981', dte: '#3b82f6', cxc: '#22c55e', cxp: '#a855f7',
  compras: '#06b6d4', inventario: '#6366f1', gasolinera: '#059669',
  rrhh: '#2563eb', contabilidad: '#1d4ed8', industrial: '#0891b2',
};

const categoryLabels = {
  ventas: 'Ventas', dte: 'DTE', cxc: 'CxC', cxp: 'CxP',
  compras: 'Compras', inventario: 'Inventario', gasolinera: 'Gasolinera',
  rrhh: 'RRHH', contabilidad: 'Contabilidad', industrial: 'Industrial',
};

const NotificacionesConfig = () => {
  const queryClient = useQueryClient();
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [editingRule, setEditingRule] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const confirm = useConfirm();

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => (await axios.get('/api/branches')).data,
  });

  React.useEffect(() => {
    if (branches.length > 0 && !selectedBranchId) {
      setSelectedBranchId(branches[0].id);
    }
  }, [branches, selectedBranchId]);

  const { data: actions = [] } = useQuery({
    queryKey: ['notification-actions'],
    queryFn: async () => (await axios.get('/api/notifications/actions')).data,
  });

  const { data: rules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ['notification-rules', selectedBranchId],
    queryFn: async () => (await axios.get(`/api/notifications/rules/${selectedBranchId}`)).data,
    enabled: !!selectedBranchId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => axios.delete(`/api/notifications/rules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['notification-rules', selectedBranchId]);
      toast.success('Regla eliminada');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al eliminar'),
  });

  const { data: telegramStatus, isLoading: telegramLoading } = useQuery({
    queryKey: ['telegram-status'],
    queryFn: async () => (await axios.get('/api/notifications/telegram/status')).data,
  });

  const toggleAlertasMutation = useMutation({
    mutationFn: ({ id, receive_alerts }) => axios.put(`/api/notifications/telegram/bindings/${id}`, { receive_alerts }),
    onSuccess: () => {
      queryClient.invalidateQueries(['telegram-status']);
      toast.success('Preferencia de alertas actualizada');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al actualizar'),
  });

  const updateBindingBranchMutation = useMutation({
    mutationFn: ({ id, branch_id }) => axios.put(`/api/notifications/telegram/bindings/${id}`, { branch_id }),
    onSuccess: () => {
      queryClient.invalidateQueries(['telegram-status']);
      toast.success('Sucursal vinculada actualizada');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al actualizar sucursal'),
  });

  const [tokenInput, setTokenInput] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);

  const saveTokenMutation = useMutation({
    mutationFn: (token) => axios.post('/api/notifications/telegram/token', { token }),
    onSuccess: (res) => {
      queryClient.invalidateQueries(['telegram-status']);
      toast.success(res.data?.message || 'Token guardado exitosamente');
      setTokenInput('');
      setShowTokenInput(false);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar token'),
  });

  const testTelegramMutation = useMutation({
    mutationFn: () => axios.post('/api/notifications/telegram/test', {}),
    onSuccess: () => toast.success('Mensaje de prueba enviado. Revisa tu Telegram.'),
    onError: (err) => toast.error(err.response?.data?.message || 'Error al enviar prueba'),
  });

  const toggleDailyBriefingMutation = useMutation({
    mutationFn: (active) => axios.put('/api/notifications/telegram/daily-briefing', { active }),
    onSuccess: (res) => {
      queryClient.invalidateQueries(['telegram-status']);
      toast.success(res.data?.message || 'Configuración actualizada');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al actualizar configuración'),
  });

  const testDailyBriefingMutation = useMutation({
    mutationFn: () => axios.post('/api/notifications/telegram/daily-briefing/test'),
    onSuccess: (res) => toast.success(res.data?.message || 'Reporte matutino de prueba enviado a Telegram'),
    onError: (err) => toast.error(err.response?.data?.message || 'Error al enviar reporte de prueba'),
  });

  const { data: suspiciousSettings } = useQuery({
    queryKey: ['sale-suspicious-settings', selectedBranchId],
    queryFn: async () => (await axios.get('/api/notifications/sale-suspicious-settings', { params: { branch_id: selectedBranchId } })).data,
    enabled: !!selectedBranchId,
  });

  const [suspiciousForm, setSuspiciousForm] = useState(null);

  React.useEffect(() => {
    if (suspiciousSettings) {
      setSuspiciousForm({
        enabled: !!suspiciousSettings.enabled,
        monto_maximo: suspiciousSettings.monto_maximo,
        descuento_maximo_porcentaje: suspiciousSettings.descuento_maximo_porcentaje,
        montos_redondos: !!suspiciousSettings.montos_redondos,
        horas_inicio: String(suspiciousSettings.horas_inicio || '00:00:00').slice(0, 5),
        horas_fin: String(suspiciousSettings.horas_fin || '23:59:59').slice(0, 5),
        anulaciones_maximas: suspiciousSettings.anulaciones_maximas,
        ventana_anulaciones_min: suspiciousSettings.ventana_anulaciones_min,
      });
    }
  }, [suspiciousSettings]);

  const saveSuspiciousMutation = useMutation({
    mutationFn: (payload) => axios.put('/api/notifications/sale-suspicious-settings', { ...payload, branch_id: selectedBranchId }),
    onSuccess: () => {
      queryClient.invalidateQueries(['sale-suspicious-settings', selectedBranchId]);
      toast.success('Configuración de ventas sospechosas guardada');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar'),
  });

  const updateSuspiciousField = (field, value) => {
    setSuspiciousForm(prev => ({ ...prev, [field]: value }));
  };

  const actionsByCategory = actions.reduce((acc, a) => {
    const cat = a.category || 'otras';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(a);
    return acc;
  }, {});

  const getRuleForAction = (actionCode) => {
    return rules.find(r => r.action_code === actionCode);
  };

  const handleEditRule = (rule) => {
    setEditingRule(rule);
    setShowEditor(true);
  };

  const handleNewRule = (actionCode) => {
    const existing = getRuleForAction(actionCode);
    if (existing) {
      handleEditRule(existing);
    } else {
      setEditingRule({ action_code: actionCode });
      setShowEditor(true);
    }
  };

  const handleSaveRule = () => {
    setShowEditor(false);
    setEditingRule(null);
    queryClient.invalidateQueries(['notification-rules', selectedBranchId]);
  };

  const toggleCategory = (cat) => {
    setExpandedCategory(expandedCategory === cat ? null : cat);
  };

  if (!selectedBranchId) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 pb-10">
        <div className="flex items-center gap-3">
          <Bell size={28} className="text-indigo-600" />
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Configuración de Notificaciones</h2>
            <p className="text-slate-500 font-medium">Selecciona una sucursal para comenzar</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <Bell size={28} className="text-indigo-600" />
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Configuración de Notificaciones</h2>
          <p className="text-slate-500 font-medium">Gestiona las reglas de notificación por sucursal</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Sucursal</h3>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {branches.map(branch => (
              <button
                key={branch.id}
                onClick={() => setSelectedBranchId(branch.id)}
                className={`w-full flex items-center gap-3 px-4 py-4 text-left transition-all border-b border-slate-50 last:border-0 ${
                  selectedBranchId === branch.id
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <GitBranch size={18} className={selectedBranchId === branch.id ? 'text-indigo-600' : 'text-slate-400'} />
                <div className="flex flex-col">
                  <span className="text-sm font-bold">{branch.nombre}</span>
                  <span className="text-[10px] opacity-70 uppercase font-bold tracking-wider">{branch.codigo}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-3 space-y-4">
          {/* Telegram */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-sky-50 rounded-xl"><MessageCircle size={18} className="text-sky-600" /></div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Telegram</h4>
                  <p className="text-[10px] text-slate-400 font-medium">Alertas y asistente Novas AI por chat</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {telegramStatus?.configured ? (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    Bot: @{telegramStatus.botInfo?.username || 'conectado'}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                    No configurado
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowTokenInput(!showTokenInput)}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors"
                >
                  {showTokenInput ? 'Cerrar' : (telegramStatus?.configured ? 'Cambiar Token' : 'Configurar Token')}
                </button>
                {telegramStatus?.configured && (
                  <button
                    type="button"
                    onClick={() => testTelegramMutation.mutate()}
                    disabled={testTelegramMutation.isPending}
                    className="text-[10px] font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {testTelegramMutation.isPending ? 'Probando...' : 'Probar'}
                  </button>
                )}
              </div>
            </div>
            <div className="p-4 space-y-3">
              {showTokenInput && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700">Token del Bot de Telegram (HTTP API Token de @BotFather)</span>
                    {telegramStatus?.maskedToken && (
                      <span className="text-[10px] text-slate-400 font-mono">Actual: {telegramStatus.maskedToken}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="Ej: 123456789:ABCdefGhIJKlmNoP..."
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <button
                      type="button"
                      disabled={saveTokenMutation.isPending || !tokenInput.trim()}
                      onClick={() => saveTokenMutation.mutate(tokenInput.trim())}
                      className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {saveTokenMutation.isPending ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Se guarda de forma persistente en el sistema y se activa de inmediato sin reiniciar servicios.
                  </p>
                </div>
              )}
              <div className="text-[11px] text-slate-500 bg-slate-50 rounded-xl p-3 leading-relaxed">
                💡 Para recibir alertas y preguntarle al asistente: abre tu bot en Telegram y escribe <b>/start</b>, luego elige empresa y sucursal. Los chats vinculados aparecen aquí.
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      <th className="px-2 py-1.5">Chat</th>
                      <th className="px-2 py-1.5">Sucursal</th>
                      <th className="px-2 py-1.5 text-right">Recibe alertas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-[11px]">
                    {telegramLoading && (
                      <tr><td colSpan={3} className="px-2 py-3 text-center text-[10px] text-slate-400">Cargando...</td></tr>
                    )}
                    {!telegramLoading && telegramStatus?.bindings?.length === 0 && (
                      <tr><td colSpan={3} className="px-2 py-3 text-center text-[10px] text-slate-400">Sin chats vinculados todavía. Escribe /start al bot desde Telegram.</td></tr>
                    )}
                    {telegramStatus?.bindings?.map(b => (
                      <tr key={b.id}>
                        <td className="px-2 py-1.5">
                          <span className="font-bold text-slate-700">{b.nombre || 'Usuario'}</span>
                          {b.username && <span className="text-slate-400"> @{b.username}</span>}
                          <span className="block text-[9px] text-slate-400 font-mono">chat {b.chat_id}</span>
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={b.branch_id || 'all'}
                            onChange={(e) => updateBindingBranchMutation.mutate({ id: b.id, branch_id: e.target.value })}
                            className={`px-2 py-1 border rounded-lg text-[11px] font-bold outline-none cursor-pointer transition-colors ${
                              !b.branch_id
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                            title="Selecciona la sucursal de vinculación del chat o acceso global a todas"
                          >
                            <option value="all">🌐 Todas las sucursales (Acceso Global)</option>
                            {branches.map(br => (
                              <option key={br.id} value={br.id}>{br.nombre}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <button
                            onClick={() => toggleAlertasMutation.mutate({ id: b.id, receive_alerts: !b.receive_alerts })}
                            className={`relative w-9 h-5 rounded-full transition-colors ${b.receive_alerts ? 'bg-emerald-500' : 'bg-slate-200'}`}
                            title={b.receive_alerts ? 'Desactivar alertas' : 'Activar alertas'}
                          >
                            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${b.receive_alerts ? 'left-[18px]' : 'left-0.5'}`} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Reporte Matutino Diario */}
              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-amber-50/50 to-orange-50/30 p-3.5 rounded-xl border border-amber-200/60">
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">🌅 Reporte Matutino Diario (7:00 AM)</span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full text-indigo-700 bg-indigo-100">
                      🌐 Global (Todas las Empresas)
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${telegramStatus?.dailyBriefingActive ? 'text-emerald-700 bg-emerald-100' : 'text-slate-500 bg-slate-200'}`}>
                      {telegramStatus?.dailyBriefingActive ? 'Activo' : 'Desactivado'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Ajuste global: no depende de la sucursal seleccionada a la izquierda. Al estar activo, envía a las 7:00 AM el resumen de todas las empresas del grupo (Diesel, Regular, Súper, Ion Diesel, subtotal pista, tienda y consolidado general) a los chats con alertas activas.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => testDailyBriefingMutation.mutate()}
                    disabled={!telegramStatus?.configured || testDailyBriefingMutation.isPending}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 hover:text-indigo-800 bg-white hover:bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg shadow-sm transition-colors disabled:opacity-40"
                    title="Enviar reporte de prueba con datos del día anterior a Telegram"
                  >
                    <Send size={12} />
                    {testDailyBriefingMutation.isPending ? 'Enviando...' : 'Probar Reporte'}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleDailyBriefingMutation.mutate(!telegramStatus?.dailyBriefingActive)}
                    disabled={toggleDailyBriefingMutation.isPending}
                    className={`relative w-10 h-5 rounded-full transition-colors ${telegramStatus?.dailyBriefingActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    title={telegramStatus?.dailyBriefingActive ? 'Desactivar reporte matutino' : 'Activar reporte matutino'}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${telegramStatus?.dailyBriefingActive ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => testTelegramMutation.mutate()}
                  disabled={!telegramStatus?.configured || testTelegramMutation.isPending}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-sky-600 hover:bg-sky-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                >
                  <Send size={13} />
                  {testTelegramMutation.isPending ? 'Enviando...' : 'Probar conexión'}
                </button>
              </div>
            </div>
          </div>

          {/* Ventas Sospechosas */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-50 rounded-xl"><ShieldAlert size={18} className="text-red-500" /></div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Ventas Sospechosas</h4>
                  <p className="text-[10px] text-slate-400 font-medium">Detección automática cada 5 minutos — sucursal seleccionada</p>
                </div>
              </div>
            </div>
            <div className="p-4">
              {!suspiciousForm ? (
                <div className="py-4 text-center text-[11px] text-slate-400">Cargando configuración...</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={suspiciousForm.enabled}
                      onChange={(e) => updateSuspiciousField('enabled', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                    />
                    Detección activa
                  </label>
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Monto máximo</label>
                    <input
                      type="number" step="0.01" min="0"
                      value={suspiciousForm.monto_maximo}
                      onChange={(e) => updateSuspiciousField('monto_maximo', e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-medium outline-none focus:ring-2 focus:ring-red-500/20"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">% descuento máximo</label>
                    <input
                      type="number" step="0.01" min="0"
                      value={suspiciousForm.descuento_maximo_porcentaje}
                      onChange={(e) => updateSuspiciousField('descuento_maximo_porcentaje', e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-medium outline-none focus:ring-2 focus:ring-red-500/20"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={suspiciousForm.montos_redondos}
                      onChange={(e) => updateSuspiciousField('montos_redondos', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                    />
                    Montos múltiplos de $100
                  </label>
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Fuera de horario desde</label>
                    <input
                      type="time"
                      value={suspiciousForm.horas_inicio}
                      onChange={(e) => updateSuspiciousField('horas_inicio', e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-medium outline-none focus:ring-2 focus:ring-red-500/20"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Hasta</label>
                    <input
                      type="time"
                      value={suspiciousForm.horas_fin}
                      onChange={(e) => updateSuspiciousField('horas_fin', e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-medium outline-none focus:ring-2 focus:ring-red-500/20"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Anulaciones máximas</label>
                    <input
                      type="number" min="0"
                      value={suspiciousForm.anulaciones_maximas}
                      onChange={(e) => updateSuspiciousField('anulaciones_maximas', e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-medium outline-none focus:ring-2 focus:ring-red-500/20"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Ventana (minutos)</label>
                    <input
                      type="number" min="1"
                      value={suspiciousForm.ventana_anulaciones_min}
                      onChange={(e) => updateSuspiciousField('ventana_anulaciones_min', e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-medium outline-none focus:ring-2 focus:ring-red-500/20"
                    />
                  </div>
                  <div className="flex items-end justify-end sm:col-span-2 lg:col-span-2">
                    <button
                      onClick={() => saveSuspiciousMutation.mutate(suspiciousForm)}
                      disabled={saveSuspiciousMutation.isPending}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Settings size={13} />
                      {saveSuspiciousMutation.isPending ? 'Guardando...' : 'Guardar configuración'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {rulesLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-20 text-center">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <span className="text-slate-400 font-medium">Cargando reglas...</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Reglas configuradas ({rules.length})
                </h3>
              </div>

              {Object.entries(actionsByCategory).map(([category, cats]) => (
                <div key={category} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: categoryColors[category] || '#6366f1' }} />
                      <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                        {categoryLabels[category] || category}
                      </h4>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        {cats.length} acciones
                      </span>
                    </div>
                    <Settings size={16} className={`text-slate-400 transition-transform ${expandedCategory === category ? 'rotate-90' : ''}`} />
                  </button>

                  {expandedCategory === category && (
                    <div className="border-t border-slate-100 divide-y divide-slate-50">
                      {cats.map(action => {
                        const rule = getRuleForAction(action.code);
                        return (
                          <div key={action.code} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/50 transition-colors">
                            <div className="flex items-center gap-3 flex-1">
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: (action.color || '#6366f1') + '15' }}
                              >
                                <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: action.color || '#6366f1' }} />
                              </div>
                              <div>
                                <span className="text-sm font-bold text-slate-700">{action.name}</span>
                                <p className="text-[10px] text-slate-400">{action.description}</p>
                              </div>
                            </div>

                            {rule ? (
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                  {rule.channel_system && <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Sistema</span>}
                                  {rule.channel_email && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Email</span>}
                                  {rule.channel_whatsapp && <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">WhatsApp</span>}
                                  {rule.channel_telegram && <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full">Telegram</span>}
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rule.is_active ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 bg-slate-100'}`}>
                                  {rule.is_active ? 'Activa' : 'Inactiva'}
                                </span>
                                <button
                                  onClick={() => handleEditRule(rule)}
                                  className="p-1.5 text-slate-600 hover:text-indigo-600 transition-colors"
                                  title="Editar regla"
                                >
                                  <Edit3 size={14} />
                                </button>
                                <button
                                  onClick={async () => {
                                    const ok = await confirm({
                                      title: 'Eliminar regla',
                                      message: '¿Estás seguro de eliminar esta regla de notificación?',
                                      confirmLabel: 'Sí, eliminar',
                                      cancelLabel: 'Cancelar',
                                      variant: 'warning'
                                    });
                                    if (ok) deleteMutation.mutate(rule.id);
                                  }}
                                  className="p-1.5 text-slate-600 hover:text-red-500 transition-colors"
                                  title="Eliminar regla"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleNewRule(action.code)}
                                className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors px-3 py-1.5 rounded-lg hover:bg-indigo-50"
                              >
                                <Plus size={14} />
                                Configurar
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {showEditor && selectedBranchId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-3xl my-8">
            <RuleEditor
              rule={editingRule}
              branchId={selectedBranchId}
              actions={actions}
              onSave={handleSaveRule}
              onCancel={() => { setShowEditor(false); setEditingRule(null); }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificacionesConfig;
