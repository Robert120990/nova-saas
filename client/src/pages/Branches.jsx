import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import { Plus, Edit, Trash2, Phone, Mail, Home } from 'lucide-react';
import { toast } from 'sonner';

const Branches = () => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedBranch, setSelectedBranch] = useState(null);
    const [selectedDept, setSelectedDept] = useState('');
    const [selectedMun, setSelectedMun] = useState('');
    const [previewUrl, setPreviewUrl] = useState(null);

    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await axios.get('/api/branches')).data
    });

    const { data: departments = [] } = useQuery({
        queryKey: ['catalogs', 'departments'],
        queryFn: async () => (await axios.get('/api/catalogs/departments')).data
    });

    const { data: municipalities = [] } = useQuery({
        queryKey: ['catalogs', 'municipalities', selectedDept],
        queryFn: async () => (await axios.get(`/api/catalogs/municipalities?dep_code=${selectedDept}`)).data,
        enabled: !!selectedDept
    });

    const mutation = useMutation({
        mutationFn: (data) => {
            if (selectedBranch) return axios.put(`/api/branches/${selectedBranch.id}`, data);
            return axios.post('/api/branches', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['branches']);
            setIsModalOpen(false);
            setSelectedBranch(null);
            toast.success(selectedBranch ? 'Sucursal actualizada' : 'Sucursal creada');
        },
        onError: (error) => {
            toast.error(error?.response?.data?.error || error?.response?.data?.message || 'Error al guardar');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/branches/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries(['branches']);
            toast.success('Sucursal eliminada');
        }
    });

    const { data: establishmentTypes = [] } = useQuery({
        queryKey: ['catalogs', 'cat_009_tipo_establecimiento'],
        queryFn: async () => (await axios.get('/api/catalogs/cat_009_tipo_establecimiento')).data
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        mutation.mutate(formData);
    };

    const handleEdit = (branch) => {
        setSelectedBranch(branch);
        setSelectedDept(branch.departamento);
        setSelectedMun(branch.municipio);
        setPreviewUrl(null);
        setIsModalOpen(true);
    };

    const fieldCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-sm";
    const labelCls = "block text-xs font-semibold text-slate-500 mb-1";

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Sucursales / Establecimientos</h2>
                    <p className="text-slate-500 mt-1 font-medium">Administra los puntos físicos y virtuales</p>
                </div>
                <button 
                    onClick={() => { 
                        setSelectedBranch(null); 
                        setSelectedDept(''); 
                        setSelectedMun('');
                        setPreviewUrl(null);
                        setIsModalOpen(true); 
                    }}
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
                            </td>
                            <td className="px-6 py-4">
                                <div className="text-xs text-slate-500 font-medium">{b.municipio_nombre || b.municipio}, {b.departamento_nombre || b.departamento}</div>
                                <div className="text-[10px] text-slate-400 truncate max-w-[200px]">{b.direccion}</div>
                            </td>
                            <td className="px-6 py-4">
                                {b.telefono && <div className="text-xs text-slate-600 flex items-center gap-1"><Phone size={12} className="text-slate-400"/> {b.telefono}</div>}
                                {b.correo && <div className="text-xs text-slate-600 flex items-center gap-1"><Mail size={12} className="text-slate-400"/> {b.correo}</div>}
                            </td>
                            <td className="px-6 py-4 flex gap-2">
                                <button onClick={() => handleEdit(b)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit size={18}/></button>
                                <button onClick={() => { if(confirm('¿Eliminar establecimiento?')) deleteMutation.mutate(b.id) }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18}/></button>
                            </td>
                        </tr>
                    )}
                />
            </div>

            <Modal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                title={selectedBranch ? 'Editar Establecimiento' : 'Nuevo Establecimiento'}
                maxWidth="max-w-lg"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Código</label>
                            <input name="codigo" defaultValue={selectedBranch?.codigo} required placeholder="001" className={fieldCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Tipo de Establecimiento</label>
                            <select name="tipo_establecimiento" defaultValue={selectedBranch?.tipo_establecimiento || '01'} className={fieldCls} required>
                                {establishmentTypes
                                    .map(t => (
                                    <option key={t.code} value={t.code}>{t.description}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className={labelCls}>Nombre de Sucursal / Establecimiento</label>
                        <input name="nombre" defaultValue={selectedBranch?.nombre} required placeholder="Ej: Sucursal Escalón" className={fieldCls} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Teléfono</label>
                            <input name="telefono" defaultValue={selectedBranch?.telefono} placeholder="2200-0000" className={fieldCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Correo (Opcional)</label>
                            <input name="correo" type="email" defaultValue={selectedBranch?.correo} placeholder="sucursal@empresa.com" className={fieldCls} />
                        </div>
                    </div>
                    <div>
                        <label className={labelCls}>Código MH</label>
                        <input name="codigo_mh" defaultValue={selectedBranch?.codigo_mh} placeholder="Código Ministerio de Hacienda" className={fieldCls} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Departamento</label>
                            <select
                                name="departamento"
                                className={fieldCls}
                                value={selectedDept}
                                onChange={(e) => setSelectedDept(e.target.value)}
                                required
                            >
                                <option value="">Seleccionar</option>
                                {departments?.map(d => <option key={d.code} value={d.code}>{d.description}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Municipio</label>
                            <select name="municipio" value={selectedMun} onChange={(e) => setSelectedMun(e.target.value)} className={fieldCls} required>
                                <option value="">Seleccionar</option>
                                {municipalities?.map(m => <option key={m.code} value={m.code}>{m.description}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className={labelCls}>Dirección</label>
                        <textarea name="direccion" defaultValue={selectedBranch?.direccion} required placeholder="Calle, pasaje, local..." className={`${fieldCls} h-20 resize-none`} />
                    </div>
                    <div>
                        <label className={labelCls}>Logo</label>
                        <div className="flex gap-4 items-center p-3 bg-slate-50 border border-slate-200 border-dashed rounded-xl">
                            <div className="flex-1">
                                <input 
                                    name="logo" 
                                    type="file" 
                                    accept="image/*" 
                                    className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-all cursor-pointer"
                                    onChange={(e) => {
                                        const file = e.target.files[0];
                                        if (file) {
                                            setPreviewUrl(URL.createObjectURL(file));
                                        }
                                    }}
                                />
                                <p className="mt-1 text-[10px] text-slate-400">PNG, JPG o GIF. Máximo 2MB.</p>
                            </div>
                            {(previewUrl || selectedBranch?.logo_url) && (
                                <div className="w-16 h-16 bg-white border border-slate-200 rounded-lg overflow-hidden flex-shrink-0 shadow-sm relative group">
                                    <img 
                                        src={previewUrl || selectedBranch.logo_url} 
                                        alt="Vista previa" 
                                        className="w-full h-full object-contain" 
                                    />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                        <span className="text-[8px] text-white font-bold uppercase">Previsualizar</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-500 font-semibold hover:text-slate-700 transition-colors text-sm">Cancelar</button>
                        <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold transition-all text-sm active:scale-95">
                            {selectedBranch ? 'Actualizar' : 'Registrar'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Branches;
