import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { X, ShieldCheck, Bot, CheckSquare, Square, BellRing, Save, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const AVAILABLE_AGENTS = [
  { id: 'accounting', name: 'Contador CPA', icon: '⚖️', desc: 'Genera y contabiliza partidas de ventas, compras y ajustes' },
  { id: 'dte', name: 'Fiscal & DTE', icon: '📑', desc: 'Normativa SVFE, contingencias y validación con Hacienda' },
  { id: 'sales', name: 'Comercial & Ventas', icon: '📈', desc: 'Ventas en tiempo real, márgenes, ticket y cuentas por cobrar' },
  { id: 'gas', name: 'Combustibles & Pistas', icon: '⛽', desc: 'Niveles de tanques, cierres de turno y auditoría de galonaje' },
  { id: 'inventory', name: 'Inventarios & Kardex', icon: '📦', desc: 'Existencias, alertas de rotación y movimientos kardex' },
  { id: 'tech', name: 'SysAdmin & Servidor', icon: '🛠️', desc: 'Salud del servidor, CPU, RAM, disco, MySQL y API DTE' },
  { id: 'operations', name: 'Operaciones Generales', icon: '⚙️', desc: 'Consultas operativas, usuarios y turnos' }
];

export default function TelegramPermissionsModal({ open, onClose, binding, branches = [] }) {
  const queryClient = useQueryClient();
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [allowedAgents, setAllowedAgents] = useState([]);
  const [canApproveEntries, setCanApproveEntries] = useState(false);
  const [receiveReopen, setReceiveReopen] = useState(true);
  const [receiveAlerts, setReceiveAlerts] = useState(true);
  const [receiveInventory, setReceiveInventory] = useState(true);
  const [receiveDte, setReceiveDte] = useState(true);

  useEffect(() => {
    if (binding) {
      setSelectedBranchId(binding.branch_id ? String(binding.branch_id) : 'all');
      let agents = [];
      try {
        agents = typeof binding.allowed_agents === 'string'
          ? JSON.parse(binding.allowed_agents)
          : (binding.allowed_agents || AVAILABLE_AGENTS.map(a => a.id));
      } catch {
        agents = AVAILABLE_AGENTS.map(a => a.id);
      }
      setAllowedAgents(Array.isArray(agents) ? agents : []);
      setCanApproveEntries(Boolean(binding.can_approve_entries));
      setReceiveReopen(binding.receive_reopen_requests !== 0);
      setReceiveAlerts(binding.receive_alerts !== 0);
      setReceiveInventory(binding.receive_inventory_alerts !== 0);
      setReceiveDte(binding.receive_dte_alerts !== 0);
    }
  }, [binding]);

  const updateMutation = useMutation({
    mutationFn: (payload) => axios.put(`/api/notifications/telegram/bindings/${binding.id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries(['telegram-status']);
      toast.success('Permisos actualizados correctamente');
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al actualizar permisos')
  });

  if (!open || !binding) return null;

  const toggleAgent = (agentId) => {
    setAllowedAgents((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId]
    );
  };

  const handleSelectAllAgents = () => {
    if (allowedAgents.length === AVAILABLE_AGENTS.length) {
      setAllowedAgents([]);
    } else {
      setAllowedAgents(AVAILABLE_AGENTS.map(a => a.id));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate({
      branch_id: selectedBranchId === 'all' ? null : parseInt(selectedBranchId, 10),
      allowed_agents: allowedAgents,
      can_approve_entries: canApproveEntries ? 1 : 0,
      receive_reopen_requests: receiveReopen ? 1 : 0,
      receive_alerts: receiveAlerts ? 1 : 0,
      receive_inventory_alerts: receiveInventory ? 1 : 0,
      receive_dte_alerts: receiveDte ? 1 : 0
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Configurar Permisos de Telegram</h3>
              <p className="text-xs text-slate-400">
                {binding.nombre || 'Usuario'} {binding.username ? `(@${binding.username})` : ''} · ID: {binding.chat_id}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-slate-700 flex-1">
          {/* Sucursal asignada */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1.5">
              Sucursal Vinculada
            </label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-full text-[13px] font-medium border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="all">🌐 Todas las sucursales (Acceso Global)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  📍 {b.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Agentes Permitidos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-indigo-500" />
                Agentes AI Habilitados para este Chat
              </label>
              <button
                type="button"
                onClick={handleSelectAllAgents}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
              >
                {allowedAgents.length === AVAILABLE_AGENTS.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {AVAILABLE_AGENTS.map((agent) => {
                const isChecked = allowedAgents.includes(agent.id);
                return (
                  <div
                    key={agent.id}
                    onClick={() => toggleAgent(agent.id)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-start gap-2.5 ${
                      isChecked
                        ? 'border-indigo-300 bg-indigo-50/50 shadow-sm'
                        : 'border-slate-200 bg-white hover:bg-slate-50 opacity-70'
                    }`}
                  >
                    <span className="text-base select-none">{agent.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">{agent.name}</span>
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 shrink-0" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">{agent.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Autorizaciones críticas HitL */}
          <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Operaciones Críticas (Human-in-the-Loop)
            </h4>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={canApproveEntries}
                onChange={(e) => setCanApproveEntries(e.target.checked)}
                className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              />
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  Asentar Partidas en Libro Diario desde Telegram
                </span>
                <span className="text-[11px] text-slate-500">
                  Permite confirmar el botón [ ✅ Asentar en Libro Diario ] al interactuar con el Agente Contador.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={receiveReopen}
                onChange={(e) => setReceiveReopen(e.target.checked)}
                className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              />
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  Aprobar Aperturas de Turnos (Gasolinera)
                </span>
                <span className="text-[11px] text-slate-500">
                  Recibe y puede aprobar solicitudes de reapertura de turnos de pista vía Telegram.
                </span>
              </div>
            </label>
          </div>

          {/* Suscripciones de Alertas */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <BellRing className="w-4 h-4 text-indigo-600" />
              Suscripción de Alertas del Sistema
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={receiveAlerts}
                  onChange={(e) => setReceiveAlerts(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="text-slate-700">Alertas de ventas sospechosas</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={receiveInventory}
                  onChange={(e) => setReceiveInventory(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="text-slate-700">Alertas de stock y desabasto</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={receiveDte}
                  onChange={(e) => setReceiveDte(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="text-slate-700">Alertas de DTE y Hacienda</span>
              </label>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-200 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {updateMutation.isPending ? 'Guardando...' : 'Guardar Permisos'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
