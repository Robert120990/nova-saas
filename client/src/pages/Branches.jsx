import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../components/ui/Table';
import { BranchModal } from '../components/branches';
import { Plus, Edit, Trash2, Phone, Mail, Home, Percent, FileCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '../context/ConfirmContext';

const formatPercentages = (val) => {
    if (!val) return '5, 10, 15, 20';
    if (Array.isArray(val)) return val.join(', ');
    if (typeof val === 'string') {
        try {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed)) return parsed.join(', ');
        } catch {
            return val;
        }
        return val;
    }
    return '5, 10, 15, 20';
};

const SAVE_TIMEOUT_MS = 15000;

const Branches = () => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedBranch, setSelectedBranch] = useState(null);

    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await axios.get('/api/branches')).data
    });

    const { data: departments = [] } = useQuery({
        queryKey: ['catalogs', 'departments'],
        queryFn: async () => (await axios.get('/api/catalogs/departments')).data
    });

    const { data: establishmentTypes = [] } = useQuery({
        queryKey: ['catalogs', 'cat_009_tipo_establecimiento'],
        queryFn: async () => (await axios.get('/api/catalogs/cat_009_tipo_establecimiento')).data
    });

    const { data: environments = [] } = useQuery({
        queryKey: ['catalogs', 'cat_001_ambiente'],
        queryFn: async () => (await axios.get('/api/catalogs/cat_001_ambiente')).data
    });

    const mutation = useMutation({
        mutationFn: ({ formData, editId }) =>
            editId
                ? axios.put(`/api/branches/${editId}`, formData, { timeout: SAVE_TIMEOUT_MS })
                : axios.post('/api/branches', formData, { timeout: SAVE_TIMEOUT_MS }),
        onSuccess: (_result, variables) => {
            queryClient.invalidateQueries({ queryKey: ['branches'] });
            setIsModalOpen(false);
            setSelectedBranch(null);
            toast.success(variables.editId ? 'Sucursal actualizada' : 'Sucursal creada');
        },
        onError: (error) => {
            const msg = error?.code === 'ECONNABORTED'
                ? 'Tiempo de espera agotado. Verifique su conexión e intente nuevamente.'
                : error?.response?.data?.message || error?.response?.data?.error || 'Error al guardar';
            toast.error(msg);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/branches/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['branches'] });
            toast.success('Sucursal eliminada');
        }
    });

    const handleDeleteBranch = async (id) => {
        const ok = await confirm({
            title: '¿Eliminar establecimiento?',
            message: 'Esta sucursal será eliminada permanentemente. Esta acción no se puede deshacer.',
            confirmLabel: 'Sí, eliminar',
            variant: 'danger',
        });
        if (ok) deleteMutation.mutate(id);
    };

    const handleEdit = (branch) => {
        setSelectedBranch(branch);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setSelectedBranch(null);
        setIsModalOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Sucursales / Establecimientos</h2>
                    <p className="text-slate-500 mt-1 font-medium">Administra los puntos físicos y virtuales</p>
                </div>
                <button 
                    onClick={handleCreate}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                    <Plus size={20}/>
                    <span>Nuevo Establecimiento</span>
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table 
                    headers={['Código', 'Nombre / Tipo', 'Ubicación', 'Contacto', 'Acciones']}
                    data={branches}
                    renderRow={(b) => (
                        <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4">
                                <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">{b.codigo}</span>
                            </td>
                            <td className="px-6 py-4">
                                <div className="text-sm font-bold text-slate-900">{b.nombre}</div>
                                <div className="text-[10px] text-amber-600 mt-1 font-bold uppercase flex items-center gap-1">
                                    <Home size={10}/>
                                    {establishmentTypes.find(t => t.code === b.tipo_establecimiento)?.description || 'Sucursal'}
                                </div>
                                {b.codigo_mh && <div className="text-[10px] text-slate-400 mt-0.5">MH: {b.codigo_mh}</div>}
                                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full border ${
                                        b.ambiente === '2'
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                            : 'bg-amber-50 text-amber-700 border-amber-100'
                                    }`}>
                                        {b.ambiente === '2' ? 'Producción' : 'Pruebas'}
                                    </span>
                                    {b.remision_con_valores ? (
                                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200 flex items-center gap-1" title="Emite Notas de Remisión con precios reales y montos totales">
                                            <FileCheck size={10} /> Remisión valorizada
                                        </span>
                                    ) : (
                                        <span className="text-[9px] font-medium uppercase px-1.5 py-0.5 rounded-full border bg-slate-50 text-slate-500 border-slate-200" title="Emite Notas de Remisión con precio simbólico ($0.00)">
                                            Remisión $0
                                        </span>
                                    )}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="text-xs text-slate-500 font-medium">Dist. {b.distrito_nombre || b.distrito || '01'}, {b.municipio_nombre || b.municipio}, {b.departamento_nombre || b.departamento}</div>
                                <div className="text-[10px] text-slate-400 truncate max-w-[200px]">{b.direccion}</div>
                                {b.discount_percentages && (
                                    <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1 font-medium bg-slate-50 px-2 py-0.5 rounded border border-slate-100 w-fit">
                                        <Percent size={10} className="text-indigo-600" />
                                        <span>Desc: {formatPercentages(b.discount_percentages)}%</span>
                                        {(b.max_discount_percentage || b.max_discount_amount) && (
                                            <span className="text-slate-400">
                                                (Tope: {b.max_discount_percentage ? `${b.max_discount_percentage}%` : ''}{b.max_discount_percentage && b.max_discount_amount ? ' / ' : ''}{b.max_discount_amount ? `$${b.max_discount_amount}` : ''})
                                            </span>
                                        )}
                                    </div>
                                )}
                            </td>
                            <td className="px-6 py-4">
                                {b.telefono && <div className="text-xs text-slate-600 flex items-center gap-1"><Phone size={12} className="text-slate-400"/> {b.telefono}</div>}
                                {b.correo && <div className="text-xs text-slate-600 flex items-center gap-1"><Mail size={12} className="text-slate-400"/> {b.correo}</div>}
                            </td>
                            <td className="px-6 py-4 flex gap-2">
                                <button onClick={() => handleEdit(b)} className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit size={18}/></button>
                                <button onClick={() => handleDeleteBranch(b.id)} className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18}/></button>
                            </td>
                        </tr>
                    )}
                />
            </div>

            <BranchModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                branch={selectedBranch}
                onSave={mutation.mutate}
                isSaving={mutation.isPending}
                departments={departments}
                establishmentTypes={establishmentTypes}
                environments={environments}
            />
        </div>
    );
};

export default Branches;
