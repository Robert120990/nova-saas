import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import { History, Eye, Lock, Unlock, Search, Pencil, Trash2, Loader2, AlertTriangle, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { downloadCloseoutPdf } from '../utils/closeoutPdf';

const GasReadingHistory = () => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const { data: response = { data: [], total: 0, totalPages: 0 }, isLoading } = useQuery({
        queryKey: ['gas-closeouts', debouncedSearch, page, user?.branch_id],
        queryFn: async () => (await axios.get('/api/gas-station/closeouts', { params: { search: debouncedSearch, page, branch_id: user?.branch_id } })).data
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => axios.delete(`/api/gas-station/closeouts/${id}`),
        onSuccess: () => {
            toast.success('Cierre eliminado');
            setDeleteConfirm(null);
            queryClient.invalidateQueries({ queryKey: ['gas-closeouts'] });
            queryClient.invalidateQueries({ queryKey: ['gas-last-turno'] });
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al eliminar')
    });

    const handleView = (item) => {
        navigate(`/gas-station/cierre-lecturas?editId=${item.id}`);
    };

    const handleEdit = (item) => {
        navigate(`/gas-station/cierre-lecturas?editId=${item.id}`);
    };

    const handlePdf = async (item) => {
        try {
            const { data } = await axios.get(`/api/gas-station/closeouts/${item.id}/print-full`);
            await downloadCloseoutPdf(data);
        } catch (error) {
            toast.error('Error al generar PDF');
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <History size={20} className="text-indigo-600" />
                        Historial de Lecturas
                    </h2>
                    <p className="text-slate-500 text-[11px] font-medium">Gasolinera — Cierres de lectura registrados</p>
                </div>
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                    type="text"
                    placeholder="Buscar por turno o vendedor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-xs font-medium shadow-sm"
                />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <Table
                    headers={['Fecha', 'Turno #', 'Vendedor', 'Estado', 'Galones Vendidos', 'Total Monto', 'Diferencia', 'Acciones']}
                    data={response.data}
                    isLoading={isLoading}
                    renderRow={(c) => (
                        <tr key={c.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                            <td className="px-3 py-1">
                                <span className="text-xs font-bold text-slate-700">
                                    {new Date(c.fecha_turno).toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </span>
                            </td>
                            <td className="px-3 py-1">
                                <span className="text-xs font-mono font-bold text-slate-900">{c.numero_turno}</span>
                            </td>
                            <td className="px-3 py-1 text-xs text-slate-600">{c.seller_name}</td>
                            <td className="px-3 py-1">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                    c.estado === 'cerrado'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-amber-50 text-amber-700'
                                }`}>
                                    {c.estado === 'cerrado' ? <Lock size={10} /> : <Unlock size={10} />}
                                    {c.estado}
                                </span>
                            </td>
                            <td className="px-3 py-1 text-xs font-mono font-bold text-indigo-600">{parseFloat(c.total_diferencia).toFixed(5)}</td>
                            <td className="px-3 py-1 text-xs font-mono font-bold text-slate-900">${parseFloat(c.total_monto).toFixed(2)}</td>
                            <td className="px-3 py-1">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold font-mono ${
                                    parseFloat(c.total_diferencia_efectivo) >= 0
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-red-50 text-red-700'
                                }`}>
                                    {parseFloat(c.total_diferencia_efectivo) >= 0 ? '+' : ''}
                                    ${parseFloat(c.total_diferencia_efectivo).toFixed(2)}
                                </span>
                            </td>
                            <td className="px-3 py-1">
                                <div className="flex items-center gap-1">
                                    {c.estado === 'cerrado' ? (
                                        <button
                                            onClick={() => handleView(c)}
                                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            title="Ver detalle"
                                        >
                                            <Eye size={15} />
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => handleEdit(c)}
                                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="Editar cierre"
                                            >
                                                <Pencil size={15} />
                                            </button>
                                            <button
                                                onClick={() => setDeleteConfirm(c)}
                                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                title="Eliminar cierre"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={() => handlePdf(c)}
                                        className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                        title="Descargar PDF"
                                    >
                                        <Printer size={15} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    )}
                />
            </div>

            <Pagination
                currentPage={page}
                totalPages={response.totalPages}
                totalItems={response.total}
                onPageChange={setPage}
                itemsOnPage={response.data.length}
                isLoading={isLoading}
            />

            {/* Delete confirmation modal */}
            <Modal
                isOpen={!!deleteConfirm}
                onClose={() => setDeleteConfirm(null)}
                title="Eliminar Cierre"
                maxWidth="max-w-sm"
            >
                <div className="text-center py-4">
                    <AlertTriangle size={40} className="mx-auto text-rose-400 mb-3" />
                    <p className="text-sm font-medium text-slate-700 mb-1">
                        ¿Eliminar Turno #{deleteConfirm?.numero_turno}?
                    </p>
                    <p className="text-xs text-slate-400">Esta acción no se puede deshacer.</p>
                </div>
                <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                    <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-4 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                        disabled={deleteMutation.isPending}
                        className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                        {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
                    </button>
                </div>
            </Modal>


        </div>
    );
};

export default GasReadingHistory;
