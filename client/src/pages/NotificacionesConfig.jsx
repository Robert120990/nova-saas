import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Bell, Plus, GitBranch, Settings, Trash2, Power, PowerOff, Edit3 } from 'lucide-react';
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

  const getActiveChannels = (rule) => {
    const channels = [];
    if (rule.channel_system) channels.push('Sistema');
    if (rule.channel_email) channels.push('Email');
    if (rule.channel_whatsapp) channels.push('WhatsApp');
    return channels.join(', ');
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
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rule.is_active ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 bg-slate-100'}`}>
                                  {rule.is_active ? 'Activa' : 'Inactiva'}
                                </span>
                                <button
                                  onClick={() => handleEditRule(rule)}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"
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
                                  className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
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
