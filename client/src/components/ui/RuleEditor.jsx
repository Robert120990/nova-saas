import React, { useState, useEffect } from 'react';
import { Plus, X, Save, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import ConditionRow from './ConditionRow';
import TemplateEditor from './TemplateEditor';

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'conditions', label: 'Condiciones' },
  { id: 'template', label: 'Plantilla' },
  { id: 'recipients', label: 'Destinatarios' },
];

const RuleEditor = ({ rule, branchId, actions, onSave, onCancel }) => {
  const [activeTab, setActiveTab] = useState('general');
  const [form, setForm] = useState({
    id: null,
    branch_id: branchId,
    action_code: '',
    name: '',
    is_active: true,
    channel_system: true,
    channel_email: false,
    channel_whatsapp: false,
    title_template: '',
    body_template: '',
    conditions: [],
    recipients: [],
  });
  const [saving, setSaving] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await axios.get('/api/users?limit=999');
      return res.data.users || [];
    },
  });

  const { data: actionDetail } = useQuery({
    queryKey: ['notification-action', form.action_code],
    enabled: !!form.action_code,
    queryFn: async () => {
      const allActions = await axios.get('/api/notifications/actions');
      return allActions.data.find(a => a.code === form.action_code);
    },
  });

  useEffect(() => {
    if (rule) {
      setForm({
        id: rule.id || null,
        branch_id: rule.branch_id || branchId,
        action_code: rule.action_code || '',
        name: rule.name || '',
        is_active: rule.is_active !== undefined ? rule.is_active : true,
        channel_system: rule.channel_system !== undefined ? rule.channel_system : true,
        channel_email: rule.channel_email !== undefined ? rule.channel_email : false,
        channel_whatsapp: rule.channel_whatsapp !== undefined ? rule.channel_whatsapp : false,
        title_template: rule.title_template || '',
        body_template: rule.body_template || '',
        conditions: rule.conditions || [],
        recipients: rule.recipients || [],
      });
    } else {
      setForm(prev => ({ ...prev, branch_id: branchId }));
    }
  }, [rule, branchId]);

  useEffect(() => {
    if (actionDetail && !form.title_template && !form.body_template) {
      setForm(prev => ({
        ...prev,
        title_template: actionDetail.default_title_template || '',
        body_template: actionDetail.default_body_template || '',
      }));
    }
  }, [actionDetail]);

  const selectedAction = actions.find(a => a.code === form.action_code);
  const availableVariables = (() => {
    try {
      if (!selectedAction?.available_variables) return [];
      if (typeof selectedAction.available_variables === 'string') {
        return JSON.parse(selectedAction.available_variables);
      }
      return selectedAction.available_variables;
    } catch {
      return [];
    }
  })();

  const handleSave = async () => {
    if (!form.action_code || !form.name) {
      return toast.error('Acción y nombre son requeridos');
    }
    setSaving(true);
    try {
      const payload = { ...form, branch_id: branchId };
      const method = form.id ? 'put' : 'post';
      const url = form.id ? `/api/notifications/rules/${form.id}` : '/api/notifications/rules';
      await axios[method](url, payload);
      toast.success('Regla guardada correctamente');
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al guardar regla');
    } finally {
      setSaving(false);
    }
  };

  const addCondition = () => {
    setForm(prev => ({
      ...prev,
      conditions: [...prev.conditions, { field: '', operator: 'eq', value: '' }],
    }));
  };

  const updateCondition = (index, condition) => {
    setForm(prev => {
      const updated = [...prev.conditions];
      updated[index] = condition;
      return { ...prev, conditions: updated };
    });
  };

  const removeCondition = (index) => {
    setForm(prev => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index),
    }));
  };

  const toggleRecipient = (user) => {
    setForm(prev => {
      const userId = user.user_id || user.id;
      const exists = prev.recipients.some(r => (r.user_id || r.id) === userId);
      if (exists) {
        return { ...prev, recipients: prev.recipients.filter(r => (r.user_id || r.id) !== userId) };
      }
      return { ...prev, recipients: [...prev.recipients, { user_id: userId, nombre: user.nombre, username: user.username, email: user.email }] };
    });
  };

  const filteredUsers = users.filter(u =>
    !userSearch || u.nombre?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.username?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const inputCls = "w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all";
  const labelCls = "block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div>
          <h3 className="font-bold text-slate-800">
            {form.id ? 'Editar regla' : 'Nueva regla'}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {selectedAction ? `${selectedAction.name} — ${selectedAction.category}` : 'Selecciona una acción'}
          </p>
        </div>
        <button onClick={onCancel} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
          <X size={18} />
        </button>
      </div>

      <div className="border-b border-slate-100">
        <div className="flex">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === tab.id
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {activeTab === 'general' && (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Acción a notificar</label>
              <select
                value={form.action_code}
                onChange={(e) => setForm(prev => ({ ...prev, action_code: e.target.value }))}
                className={inputCls}
              >
                <option value="">Seleccionar acción...</option>
                {actions.map(a => (
                  <option key={a.code} value={a.code}>{a.name} ({a.category})</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Nombre de la regla</label>
              <input
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                className={inputCls}
                placeholder="Ej: Alerta tanque Premium crítico"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-slate-700">Regla activa</span>
              </label>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <label className={labelCls}>Canales de notificación</label>
              <div className="flex flex-wrap gap-4 mt-2">
                {[
                  { key: 'channel_system', label: 'Sistema (in-app)', color: 'indigo' },
                  { key: 'channel_email', label: 'Correo electrónico', color: 'blue' },
                  { key: 'channel_whatsapp', label: 'WhatsApp', color: 'green' },
                ].map(ch => (
                  <label key={ch.key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form[ch.key]}
                      onChange={(e) => setForm(prev => ({ ...prev, [ch.key]: e.target.checked }))}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-slate-700">{ch.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'conditions' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">
              Agrega condiciones opcionales. Si no hay condiciones, la regla se ejecutará siempre que ocurra la acción.
            </p>
            {form.conditions.map((cond, i) => (
              <ConditionRow
                key={i}
                condition={cond}
                index={i}
                onChange={updateCondition}
                onRemove={removeCondition}
                availableVariables={availableVariables}
              />
            ))}
            <button
              type="button"
              onClick={addCondition}
              className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              <Plus size={16} />
              Agregar condición
            </button>
          </div>
        )}

        {activeTab === 'template' && (
          <TemplateEditor
            title={form.title_template}
            body={form.body_template}
            availableVariables={availableVariables}
            onTitleChange={(v) => setForm(prev => ({ ...prev, title_template: v }))}
            onBodyChange={(v) => setForm(prev => ({ ...prev, body_template: v }))}
          />
        )}

        {activeTab === 'recipients' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Usuarios que recibirán esta notificación ({form.recipients.length} seleccionados)
              </p>
              <button
                type="button"
                onClick={() => setShowUserModal(true)}
                className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700"
              >
                <Users size={16} />
                Seleccionar usuarios
              </button>
            </div>

            {form.recipients.length > 0 ? (
              <div className="space-y-1.5">
                {form.recipients.map((r, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-100">
                    <div>
                      <span className="text-sm font-bold text-slate-700">{r.nombre || r.username}</span>
                      <span className="text-xs text-slate-400 ml-2">({r.email})</span>
                    </div>
                    <button onClick={() => toggleRecipient(r)} className="text-slate-400 hover:text-red-500">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <Users size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No hay destinatarios seleccionados</p>
              </div>
            )}

            {showUserModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800">Seleccionar destinatarios</h3>
                    <button onClick={() => setShowUserModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                      <X size={18} />
                    </button>
                  </div>
                  <div className="p-4">
                    <input
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      placeholder="Buscar usuarios..."
                    />
                    <div className="max-h-[300px] overflow-y-auto space-y-1 custom-scrollbar">
                      {filteredUsers.map(u => {
                        const isSelected = form.recipients.some(r => (r.user_id || r.id) === u.id);
                        return (
                          <button
                            key={u.id}
                            onClick={() => toggleRecipient(u)}
                            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-left transition-all ${
                              isSelected ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div>
                              <span className="text-sm font-bold">{u.nombre || u.username}</span>
                              <span className="text-xs text-slate-400 ml-2">({u.email})</span>
                            </div>
                            {isSelected && <span className="text-indigo-600 text-xs font-bold">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
                    <button
                      onClick={() => setShowUserModal(false)}
                      className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-xl text-sm hover:bg-indigo-700 transition-colors"
                    >
                      Listo ({form.recipients.length} seleccionados)
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-5 py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white font-bold rounded-xl text-sm hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? 'Guardando...' : 'Guardar regla'}
        </button>
      </div>
    </div>
  );
};

export default RuleEditor;
