import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Plus, GitBranch, Trash2, Edit3, ChevronRight, Bell } from 'lucide-react';
import { toast } from 'sonner';
import RuleEditor from '../ui/RuleEditor';
import { useConfirm } from '../../context/ConfirmContext';

const categoryColors = {
  ventas: '#10b981', dte: '#3b82f6', cxc: '#22c55e', cxp: '#a855f7',
  compras: '#06b6d4', inventario: '#6366f1', gasolinera: '#059669',
  rrhh: '#2563eb', contabilidad: '#1d4ed8', industrial: '#0891b2'
};

const categoryLabels = {
  ventas: 'Ventas', dte: 'DTE', cxc: 'CxC', cxp: 'CxP',
  compras: 'Compras', inventario: 'Inventario', gasolinera: 'Gasolinera',
  rrhh: 'RRHH', contabilidad: 'Contabilidad', industrial: 'Industrial'
};

export default function NotificationRulesTab({ branches = [] }) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [editingRule, setEditingRule] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState(null);

  useEffect(() => {
    if (branches.length > 0 && !selectedBranchId) {
      setSelectedBranchId(branches[0].id);
    }
  }, [branches, selectedBranchId]);

  const { data: actions = [] } = useQuery({
    queryKey: ['notification-actions'],
    queryFn: async () => (await axios.get('/api/notifications/actions')).data
  });

  const { data: rules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ['notification-rules', selectedBranchId],
    queryFn: async () => (await axios.get(`/api/notifications/rules/${selectedBranchId}`)).data,
    enabled: !!selectedBranchId
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => axios.delete(`/api/notifications/rules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries(['notification-rules', selectedBranchId]);
      toast.success('Regla eliminada');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al eliminar')
  });

  const actionsByCategory = useMemo(() => {
    const map = {};
    (actions || []).forEach(a => {
      if (!map[a.category]) map[a.category] = [];
      map[a.category].push(a);
    });
    return map;
  }, [actions]);

  const getRuleForAction = (actionCode) => {
    return (rules || []).find(r => r.action_code === actionCode);
  };

  const handleEditRule = (rule) => {
    setEditingRule(rule);
    setShowEditor(true);
  };

  const handleNewRule = (actionCode) => {
    setEditingRule({ action_code: actionCode, is_active: 1 });
    setShowEditor(true);
  };

  const handleSaveRule = () => {
    setShowEditor(false);
    setEditingRule(null);
    queryClient.invalidateQueries(['notification-rules', selectedBranchId]);
    toast.success('Regla guardada correctamente');
  };

  const handleDeleteRule = async (ruleId) => {
    const ok = await confirm({
      title: 'Eliminar regla de notificación',
      message: '¿Estás seguro de eliminar esta regla?',
      confirmText: 'Sí, eliminar',
      cancelText: 'Cancelar'
    });
    if (ok) {
      deleteMutation.mutate(ruleId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Branch Selector */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 rounded-2xl text-indigo-600 border border-indigo-100">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Reglas de Notificación por Sucursal</h3>
            <p className="text-xs text-slate-500">
              Define canales (Sistema, Email, WhatsApp, Telegram) según evento operativo.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-slate-400" />
          <select
            value={selectedBranchId || ''}
            onChange={(e) => setSelectedBranchId(Number(e.target.value))}
            className="text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                📍 {b.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Rules Accordion */}
      {rulesLoading ? (
        <div className="py-16 text-center text-xs text-slate-400">Cargando reglas...</div>
      ) : (
        <div className="space-y-3">
          {Object.entries(actionsByCategory).map(([category, cats]) => {
            const isExpanded = expandedCategory === category;
            return (
              <div key={category} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedCategory(isExpanded ? null : category)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: categoryColors[category] || '#6366f1' }}
                    />
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      {categoryLabels[category] || category}
                    </h4>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      {cats.length} acciones
                    </span>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 divide-y divide-slate-50">
                    {cats.map((action) => {
                      const rule = getRuleForAction(action.code);
                      return (
                        <div key={action.code} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                          <div className="flex-1">
                            <span className="text-xs font-bold text-slate-800 block">{action.name}</span>
                            <span className="text-[11px] text-slate-400">{action.description}</span>
                          </div>

                          {rule ? (
                            <div className="flex items-center gap-2">
                              <div className="flex flex-wrap gap-1">
                                {rule.channel_system ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">Sistema</span> : null}
                                {rule.channel_email ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">Email</span> : null}
                                {rule.channel_whatsapp ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">WhatsApp</span> : null}
                                {rule.channel_telegram ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-50 text-sky-700">Telegram</span> : null}
                              </div>

                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rule.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                {rule.is_active ? 'Activa' : 'Inactiva'}
                              </span>

                              <button
                                onClick={() => handleEditRule(rule)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50"
                                title="Editar"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteRule(rule.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleNewRule(action.code)}
                              className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-xs font-bold rounded-lg flex items-center gap-1.5 self-start sm:self-auto transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" /> Configurar
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Rule Editor Modal */}
      {showEditor && selectedBranchId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
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
}
