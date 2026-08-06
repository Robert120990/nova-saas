import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import {
    Plus, Trash2, Save, X, ChevronRight, ChevronDown, Eye, EyeOff,
    ArrowUp, ArrowDown, Settings, Search, Minimize2, Maximize2
} from 'lucide-react';
import iconMap from '../config/iconMap';

const iconKeys = Object.keys(iconMap).filter(k => k !== 'Circle').sort();

const MenuItems = () => {
    const queryClient = useQueryClient();
    const [editingId, setEditingId] = useState(null);
    const [creating, setCreating] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [collapsedGroups, setCollapsedGroups] = useState(new Set());
    const [form, setForm] = useState({ label: '', path: '', icon: 'Settings', parent_id: null, sort_order: 0, is_active: true, hide_in_menu: false, permission_key: '' });

    const { data: items = [], isLoading } = useQuery({
        queryKey: ['menu-items-all'],
        queryFn: async () => (await axios.get('/api/menu-items')).data,
    });

    const tree = useMemo(() => buildTree(items), [items]);
    const totalItems = items.length;

    const { matchedIds, forceExpandIds, matchCount } = useMemo(() => {
        if (!searchTerm.trim()) return { matchedIds: new Set(), forceExpandIds: new Set(), matchCount: 0 };

        const query = searchTerm.toLowerCase().trim();
        const matched = new Set();
        items.forEach(item => {
            const label = (item.label || '').toLowerCase();
            const path = (item.path || '').toLowerCase();
            const perm = (item.permission_key || '').toLowerCase();
            if (label.includes(query) || path.includes(query) || perm.includes(query)) {
                matched.add(item.id);
            }
        });

        const parentMap = {};
        items.forEach(i => { parentMap[i.id] = i.parent_id; });

        const ancestors = new Set();
        matched.forEach(id => {
            let current = parentMap[id];
            while (current) {
                ancestors.add(current);
                current = parentMap[current];
            }
        });

        return { matchedIds: matched, forceExpandIds: ancestors, matchCount: matched.size };
    }, [searchTerm, items]);

    const isSearching = searchTerm.trim().length > 0;

    const toggleCollapse = useCallback((id) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    const expandAll = useCallback(() => setCollapsedGroups(new Set()), []);
    const collapseAll = useCallback(() => {
        const ids = new Set();
        items.forEach(item => {
            const children = items.filter(i => i.parent_id === item.id);
            if (children.length > 0) ids.add(item.id);
        });
        setCollapsedGroups(ids);
    }, [items]);

    const hasMatchingDescendant = useCallback((item) => {
        if (!item.children || item.children.length === 0) return false;
        return item.children.some(child =>
            matchedIds.has(child.id) || hasMatchingDescendant(child)
        );
    }, [matchedIds]);

    const saveMutation = useMutation({
        mutationFn: async (data) => {
            if (editingId) return axios.put(`/api/menu-items/${editingId}`, data);
            return axios.post('/api/menu-items', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['menu-items-all']);
            queryClient.invalidateQueries(['menu-items']);
            queryClient.invalidateQueries(['menu-permissions']);
            toast.success(editingId ? 'Item actualizado' : 'Item creado');
            setEditingId(null);
            setCreating(false);
            setForm({ label: '', path: '', icon: 'Settings', parent_id: null, sort_order: 0, is_active: true, hide_in_menu: false, permission_key: '' });
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/menu-items/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries(['menu-items-all']);
            queryClient.invalidateQueries(['menu-items']);
            queryClient.invalidateQueries(['menu-permissions']);
            toast.success('Item eliminado');
        },
    });

    const reorderMutation = useMutation({
        mutationFn: (data) => axios.put('/api/menu-items/reorder', data),
        onSuccess: () => {
            queryClient.invalidateQueries(['menu-items-all']);
            queryClient.invalidateQueries(['menu-items']);
            queryClient.invalidateQueries(['menu-permissions']);
        },
    });

    const handleEdit = (item) => {
        setEditingId(item.id);
        setCreating(false);
        setForm({
            label: item.label,
            path: item.path || '',
            icon: item.icon_name || item.icon || 'Settings',
            parent_id: item.parent_id,
            sort_order: item.sort_order || 0,
            is_active: item.is_active,
            hide_in_menu: !!item.hide_in_menu,
            permission_key: item.permission_key || '',
        });
    };

    const handleNew = () => {
        setCreating(true);
        setEditingId(null);
        setForm({ label: '', path: '', icon: 'Settings', parent_id: null, sort_order: 0, is_active: true, hide_in_menu: false, permission_key: '' });
    };

    const handleSave = () => {
        if (!form.label) return toast.error('El label es requerido');
        saveMutation.mutate(form);
    };

    const handleCancel = () => {
        setEditingId(null);
        setCreating(false);
        setForm({ label: '', path: '', icon: 'Settings', parent_id: null, sort_order: 0, is_active: true, hide_in_menu: false, permission_key: '' });
    };

    const handleMove = (item, direction) => {
        const siblings = items.filter(i => i.parent_id === item.parent_id && i.id !== item.id).sort((a, b) => a.sort_order - b.sort_order);
        let target;
        if (direction === 'up') {
            target = siblings.filter(i => i.sort_order < item.sort_order).pop();
        } else {
            target = siblings.filter(i => i.sort_order > item.sort_order).shift();
        }
        if (!target) return;
        const updates = [
            { id: item.id, sort_order: target.sort_order, parent_id: item.parent_id },
            { id: target.id, sort_order: item.sort_order, parent_id: target.parent_id },
        ];
        reorderMutation.mutate({ items: updates });
    };

    if (isLoading) return <div className="p-8 text-slate-400">Cargando...</div>;

    return (
        <div className="h-[calc(100vh-90px)] flex gap-6 p-2">
            <div className="flex-1 bg-[#0f172a] rounded-2xl border border-slate-800/50 flex flex-col shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-[#1e293b]/20 flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-lg">
                            <Settings size={20} className="text-indigo-400" />
                        </div>
                        <h2 className="text-xl font-bold text-white tracking-tight">Menú del Sistema</h2>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={handleNew} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all flex items-center gap-2 text-sm shadow-lg shadow-indigo-600/20 active:scale-95">
                            <Plus size={18} /> Nuevo Item
                        </button>
                    </div>
                </div>

                <div className="px-6 py-3 border-b border-slate-800/30 flex items-center gap-3 flex-wrap">
                    <div className="relative flex-1 min-w-[250px]">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Buscar por nombre, ruta o permiso..."
                            className="w-full bg-[#1e293b]/60 border border-slate-700/50 rounded-xl pl-10 pr-4 py-2 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={expandAll}
                            className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white transition-all hover:bg-indigo-600/20 hover:border-indigo-500/50"
                            title="Expandir todo"
                        >
                            <Maximize2 size={16} />
                        </button>
                        <button
                            onClick={collapseAll}
                            className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white transition-all hover:bg-indigo-600/20 hover:border-indigo-500/50"
                            title="Colapsar todo"
                        >
                            <Minimize2 size={16} />
                        </button>
                    </div>
                    <div className="text-[11px] font-medium text-slate-500 whitespace-nowrap">
                        {isSearching
                            ? `${matchCount} de ${totalItems} items`
                            : `${totalItems} items`}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    <div className="space-y-1">
                        {tree.map(item => (
                            <TreeNode
                                key={item.id}
                                item={item}
                                allItems={items}
                                editingId={editingId}
                                form={form}
                                setForm={setForm}
                                onEdit={handleEdit}
                                onSave={handleSave}
                                onCancel={handleCancel}
                                onDelete={(id) => { if (confirm('¿Eliminar este item? Los hijos se eliminarán también.')) deleteMutation.mutate(id); }}
                                onMove={handleMove}
                                isSaving={saveMutation.isPending}
                                depth={0}
                                searchTerm={searchTerm}
                                matchedIds={matchedIds}
                                forceExpandIds={forceExpandIds}
                                collapsedGroups={collapsedGroups}
                                onToggleCollapse={toggleCollapse}
                                hasMatchingDescendant={hasMatchingDescendant}
                            />
                        ))}
                    </div>

                    {creating && (
                        <CreateForm
                            form={form}
                            setForm={setForm}
                            items={items}
                            onSave={handleSave}
                            onCancel={handleCancel}
                            isSaving={saveMutation.isPending}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

function TreeNode({ item, allItems, editingId, form, setForm, onEdit, onSave, onCancel, onDelete, onMove, isSaving, depth, searchTerm, matchedIds, forceExpandIds, collapsedGroups, onToggleCollapse, hasMatchingDescendant }) {
    const isEditing = editingId === item.id;
    const Icon = iconMap[item.icon_name || item.icon] || iconMap.Circle;
    const hasChildren = item.children && item.children.length > 0;
    const isSearching = searchTerm && searchTerm.trim().length > 0;
    const itemMatches = matchedIds.has(item.id);
    const isForceExpanded = forceExpandIds.has(item.id);
    const isCollapsed = !isSearching && !isForceExpanded && collapsedGroups.has(item.id);
    const hasMatchInDescendants = hasChildren && hasMatchingDescendant(item);

    const shouldShow = !isSearching || itemMatches || hasMatchInDescendants;
    if (!shouldShow) return null;

    return (
        <div>
            <div
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all group border ${
                    isEditing
                        ? 'bg-indigo-600/10 border-indigo-600/20'
                        : itemMatches
                        ? 'bg-indigo-500/10 border-indigo-500/30 ring-1 ring-indigo-500/20'
                        : hasMatchInDescendants
                        ? 'bg-white/3 border-slate-700/30'
                        : 'hover:bg-white/5 border-transparent'
                }`}
                style={{ paddingLeft: `${16 + depth * 24}px` }}
            >
                {hasChildren && (
                    <button
                        onClick={() => onToggleCollapse(item.id)}
                        className="p-0.5 text-slate-500 hover:text-white transition-colors shrink-0"
                    >
                        {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    </button>
                )}
                {!hasChildren && <span className="w-[18px] shrink-0" />}

                {isEditing ? (
                    <EditForm item={item} form={form} setForm={setForm} allItems={allItems} onSave={onSave} onCancel={onCancel} isSaving={isSaving} />
                ) : (
                    <>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Icon size={16} className={`shrink-0 ${itemMatches ? 'text-indigo-400' : 'text-slate-500'}`} />
                            <span className={`text-sm font-bold truncate ${itemMatches ? 'text-indigo-200' : 'text-white'}`}>{item.label}</span>
                            {item.path && <span className="text-[10px] font-mono text-slate-500 truncate hidden lg:block">{item.path}</span>}
                            {item.permission_key && <span className="text-[10px] font-mono text-indigo-400/60 truncate hidden xl:block">{item.permission_key}</span>}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => onMove(item, 'up')} className="p-1 text-slate-600 hover:text-white transition-colors" title="Subir">
                                <ArrowUp size={14} />
                            </button>
                            <button onClick={() => onMove(item, 'down')} className="p-1 text-slate-600 hover:text-white transition-colors" title="Bajar">
                                <ArrowDown size={14} />
                            </button>
                            {item.is_active ? (
                                <Eye size={14} className="text-green-500/50" />
                            ) : (
                                <EyeOff size={14} className="text-red-500/50" />
                            )}
                            <button onClick={() => onEdit(item)} className="p-1.5 text-slate-600 hover:text-indigo-400 transition-colors" title="Editar">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                            </button>
                            <button onClick={() => onDelete(item.id)} className="p-1.5 text-slate-600 hover:text-red-400 transition-colors" title="Eliminar">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </>
                )}
            </div>

            {hasChildren && !isCollapsed && (
                <div>
                    {item.children.map(child => (
                        <TreeNode
                            key={child.id}
                            item={child}
                            allItems={allItems}
                            editingId={editingId}
                            form={form}
                            setForm={setForm}
                            onEdit={onEdit}
                            onSave={onSave}
                            onCancel={onCancel}
                            onDelete={onDelete}
                            onMove={onMove}
                            isSaving={isSaving}
                            depth={depth + 1}
                            searchTerm={searchTerm}
                            matchedIds={matchedIds}
                            forceExpandIds={forceExpandIds}
                            collapsedGroups={collapsedGroups}
                            onToggleCollapse={onToggleCollapse}
                            hasMatchingDescendant={hasMatchingDescendant}
                        />
                    ))}
                </div>
            )}

            {hasChildren && isCollapsed && !isSearching && (
                <div className="text-[10px] text-slate-600 px-4 py-0.5" style={{ paddingLeft: `${16 + (depth + 1) * 24}px` }}>
                    {item.children.length} items ocultos
                </div>
            )}
        </div>
    );
}

function EditForm({ item, form, setForm, allItems, onSave, onCancel, isSaving }) {
    const parents = allItems.filter(i => !i.parent_id || i.id === item.parent_id);
    return (
        <div className="flex-1 grid grid-cols-[2fr_1fr_1.5fr_1fr_1fr_auto] gap-3 items-center">
            <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })}
                className="bg-[#1e293b] border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder="Label" />
            <input value={form.path} onChange={e => setForm({ ...form, path: e.target.value })}
                className="bg-[#1e293b] border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder="/ruta" />
            <select value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })}
                className="bg-[#1e293b] border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:ring-2 focus:ring-indigo-500/50">
                {iconKeys.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            <select value={form.parent_id || ''} onChange={e => setForm({ ...form, parent_id: e.target.value ? parseInt(e.target.value) : null })}
                className="bg-[#1e293b] border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:ring-2 focus:ring-indigo-500/50">
                <option value="">Sin padre</option>
                {parents.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="rounded" />
                Activo
            </label>
            <div className="flex items-center gap-1">
                <button onClick={onSave} disabled={isSaving} className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50">
                    <Save size={14} />
                </button>
                <button onClick={onCancel} className="p-1.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors">
                    <X size={14} />
                </button>
            </div>
        </div>
    );
}

function CreateForm({ form, setForm, items, onSave, onCancel, isSaving }) {
    const parents = items.filter(i => !i.parent_id || i.path === null);
    return (
        <div className="mt-4 p-4 bg-[#1e293b]/40 border border-indigo-500/30 rounded-2xl">
            <p className="text-xs font-bold text-indigo-400 uppercase mb-3">Nuevo Item</p>
            <div className="grid grid-cols-[2fr_1fr_1.5fr_1fr_1fr_1fr_auto] gap-3 items-end">
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Label</label>
                    <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value, permission_key: e.target.value.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_').replace(/^_|_$/g, '') || form.permission_key })}
                        className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder="Nombre del menú" />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Ruta</label>
                    <input value={form.path} onChange={e => setForm({ ...form, path: e.target.value })}
                        className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder="/ruta/ejemplo" />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Icono</label>
                    <select value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })}
                        className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white text-xs outline-none focus:ring-2 focus:ring-indigo-500/50">
                        {iconKeys.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Padre</label>
                    <select value={form.parent_id || ''} onChange={e => setForm({ ...form, parent_id: e.target.value ? parseInt(e.target.value) : null })}
                        className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white text-xs outline-none focus:ring-2 focus:ring-indigo-500/50">
                        <option value="">Sin padre (grupo raíz)</option>
                        {parents.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Permiso</label>
                    <input value={form.permission_key} onChange={e => setForm({ ...form, permission_key: e.target.value })}
                        className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500/50" placeholder="auto-generado" />
                </div>
                <div className="flex items-center gap-3 pb-1">
                    <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                        <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                        Activo
                    </label>
                    <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                        <input type="checkbox" checked={form.hide_in_menu} onChange={e => setForm({ ...form, hide_in_menu: e.target.checked })} />
                        Oculto
                    </label>
                </div>
                <div className="flex items-center gap-1 pb-1">
                    <button onClick={onSave} disabled={isSaving} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 transition-all text-xs disabled:opacity-50 shadow-lg shadow-indigo-600/20">
                        {isSaving ? '...' : 'Crear'}
                    </button>
                    <button onClick={onCancel} className="px-4 py-2 bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-600 transition-all text-xs">
                        Cancelar
                    </button>
                </div>
            </div>
            <p className="text-[10px] text-slate-600 mt-2">
                {form.permission_key ? `Permiso: ${form.permission_key}` : 'El permiso se genera automáticamente desde el label'}
            </p>
        </div>
    );
}

function buildTree(items) {
    const itemMap = {};
    const roots = [];
    items.forEach(item => {
        itemMap[item.id] = { ...item, children: [], icon_name: item.icon };
    });
    items.forEach(item => {
        if (item.parent_id && itemMap[item.parent_id]) {
            itemMap[item.parent_id].children.push(itemMap[item.id]);
        } else if (!item.parent_id) {
            roots.push(itemMap[item.id]);
        }
    });
    return roots;
}

export default MenuItems;
