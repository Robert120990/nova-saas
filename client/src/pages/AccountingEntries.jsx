import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Plus, FileText, Search } from 'lucide-react';
import { toast } from 'sonner';
import PdfViewerModal from '../components/ui/PdfViewerModal';
import {
    AccountingEntryModal,
    AccountingEntryViewModal,
    AccountingEntriesTable
} from '../components/accounting';
import { unwrapList } from '../utils/apiUtils';
import Pagination from '../components/ui/Pagination';
import { useDirtyTracker } from '../hooks/useDirtyTracker';
import { useAuth } from '../context/AuthContext';

const AccountingEntries = () => {
    const { user } = useAuth();
    const companyId = user?.company_id;
    const headers = { 'x-company-id': companyId };
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [viewEntry, setViewEntry] = useState(null);
    const [editingEntry, setEditingEntry] = useState(null);
    const [search, setSearch] = useState('');
    const [pdfModal, setPdfModal] = useState({
        isOpen: false,
        url: null,
        title: '',
        fileName: '',
        isLoading: false,
        error: null,
    });
    const editRequest = useRef(0);
    const viewRequest = useRef(0);
    useEffect(() => () => { editRequest.current += 1; viewRequest.current += 1; }, []);

    useDirtyTracker('partidas', isModalOpen);

    const { data: entriesData, isLoading } = useQuery({
        queryKey: ['entries', companyId, page],
        queryFn: async ({ signal }) => (await axios.get(`/api/accounting/entries?page=${page}&limit=15`, { headers, signal })).data,
        enabled: !!companyId,
    });

    const entries = unwrapList(entriesData);
    const filteredEntries = useMemo(() => {
        if (!search) return entries;
        const q = search.toLowerCase();
        return entries.filter(e =>
            e.number?.toLowerCase().includes(q) ||
            e.description?.toLowerCase().includes(q) ||
            e.entry_type_name?.toLowerCase().includes(q)
        );
    }, [entries, search]);

    const { data: entryTypes = [] } = useQuery({
        queryKey: ['entryTypes', companyId],
        queryFn: async ({ signal }) => unwrapList(await axios.get('/api/accounting/entry-types', { headers, signal })),
        enabled: !!companyId,
    });
    const { data: accounts = [] } = useQuery({
        queryKey: ['accounts', companyId],
        queryFn: async ({ signal }) => unwrapList(await axios.get('/api/accounting/accounts', { headers, signal })),
        enabled: !!companyId,
    });

    const createMutation = useMutation({
        mutationFn: (data) => axios.post('/api/accounting/entries', data, { headers }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['entries'] });
            setIsModalOpen(false);
            resetForm();
            toast.success('Partida registrada');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Error'),
    });

    const voidMutation = useMutation({
        mutationFn: (id) => axios.put(`/api/accounting/entries/${id}/void`, {}, { headers }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['entries'] });
            toast.success('Partida anulada');
        },
        onError: (err) => {
            toast.error(err?.response?.status === 404 ? 'La partida seleccionada ya no existe o fue eliminada' : (err?.response?.data?.message || 'Error al anular partida'));
            if (err?.response?.status === 404) queryClient.invalidateQueries({ queryKey: ['entries'] });
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, ...data }) => axios.put(`/api/accounting/entries/${id}`, data, { headers }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['entries'] });
            setIsModalOpen(false);
            setEditingEntry(null);
            resetForm();
            toast.success('Partida actualizada');
        },
        onError: (err) => {
            if (err?.response?.status === 404) {
                toast.error('La partida ya no existe o fue eliminada en el servidor');
                setIsModalOpen(false);
                setEditingEntry(null);
                resetForm();
                queryClient.invalidateQueries({ queryKey: ['entries'] });
            } else {
                toast.error(err?.response?.data?.message || 'Error al actualizar partida');
            }
        },
    });

    const resetForm = () => {
        editRequest.current += 1;
        setEditingEntry(null);
    };

    const handleEdit = async (entry) => {
        if (createMutation.isPending || updateMutation.isPending) return;
        const request = ++editRequest.current;
        try {
            const { data } = await axios.get(`/api/accounting/entries/${entry.id}`, { headers });
            if (request !== editRequest.current) return;
            setEditingEntry(data);
            setIsModalOpen(true);
        } catch (e) {
            if (request === editRequest.current) {
                if (e?.response?.status === 404) {
                    toast.error('La partida seleccionada ya no existe o fue eliminada');
                    queryClient.invalidateQueries({ queryKey: ['entries'] });
                } else {
                    toast.error('Error al cargar partida');
                }
            }
        }
    };

    const handleView = async (entry) => {
        const request = ++viewRequest.current;
        try {
            const { data } = await axios.get(`/api/accounting/entries/${entry.id}`, { headers });
            if (request === viewRequest.current) setViewEntry(data);
        } catch (e) {
            if (request === viewRequest.current) {
                if (e?.response?.status === 404) {
                    toast.error('La partida seleccionada ya no existe o fue eliminada');
                    queryClient.invalidateQueries({ queryKey: ['entries'] });
                } else {
                    toast.error('Error al cargar partida');
                }
            }
        }
    };

    const handleSaveEntry = (formData) => {
        if (createMutation.isPending || updateMutation.isPending) return;
        if (editingEntry) {
            updateMutation.mutate({
                id: editingEntry.id,
                description: formData.description,
                expected_version: editingEntry.version,
                lines: formData.lines
            });
        } else {
            createMutation.mutate(formData);
        }
    };

    const handlePrint = async (entry, mode = 'normal') => {
        const modeLabel = mode === 'mayorizada' ? 'Mayorizada' : 'Normal';
        setPdfModal({
            isOpen: true,
            url: null,
            title: `Póliza de Partida #${entry.number || ''} (${modeLabel})`,
            fileName: `Partida_${entry.number || entry.id}_${modeLabel}.pdf`,
            isLoading: true,
            error: null,
        });
        try {
            const response = await axios.get(`/api/accounting/entries/${entry.id}/print`, {
                params: { mode },
                headers,
                responseType: 'blob'
            });
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setPdfModal(prev => ({ ...prev, url, isLoading: false }));
        } catch (err) {
            console.error('Error printing entry:', err);
            setPdfModal(prev => ({ ...prev, isLoading: false, error: 'No se pudo generar la póliza' }));
            toast.error('Error al generar póliza de la partida');
        }
    };

    const closePdfModal = () => {
        if (pdfModal.url) URL.revokeObjectURL(pdfModal.url);
        setPdfModal({
            isOpen: false,
            url: null,
            title: '',
            fileName: '',
            isLoading: false,
            error: null,
        });
    };

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4 animate-in fade-in pb-20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-3">
                        <FileText size={28} className="text-indigo-600 shrink-0" />
                        Partidas Contables
                    </h1>
                    <p className="text-slate-500 font-medium">Registro de asientos contables</p>
                </div>
                <button
                    onClick={() => { setEditingEntry(null); resetForm(); setIsModalOpen(true); }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl font-black uppercase text-xs flex items-center gap-2"
                >
                    <Plus size={16} /> Nueva Partida
                </button>
            </div>

            <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por número, descripción o tipo..."
                    className="pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold w-full md:w-80 outline-none"
                />
            </div>

            <AccountingEntriesTable
                entries={filteredEntries}
                isLoading={isLoading}
                onView={handleView}
                onEdit={handleEdit}
                onVoid={(e) => voidMutation.mutate(e.id)}
                onPrint={handlePrint}
            />

            {entriesData && (
                <Pagination
                    page={page}
                    totalPages={entriesData.totalPages || 1}
                    onPageChange={setPage}
                />
            )}

            <AccountingEntryModal
                open={isModalOpen}
                onClose={() => {
                    if (createMutation.isPending || updateMutation.isPending) return;
                    setIsModalOpen(false);
                    resetForm();
                }}
                onSubmit={handleSaveEntry}
                editingEntry={editingEntry}
                entryTypes={entryTypes}
                accounts={accounts}
                isSaving={createMutation.isPending || updateMutation.isPending}
            />

            <AccountingEntryViewModal
                open={!!viewEntry}
                onClose={() => { viewRequest.current += 1; setViewEntry(null); }}
                entry={viewEntry}
                onPrint={handlePrint}
            />

            <PdfViewerModal
                isOpen={pdfModal.isOpen}
                onClose={closePdfModal}
                title={pdfModal.title}
                fileName={pdfModal.fileName}
                pdfUrl={pdfModal.url}
                isLoading={pdfModal.isLoading}
                error={pdfModal.error}
                badge="Póliza Contable"
                footerNote="Comprobante de Diario Oficial • Formato Carta con Firmas"
            />
        </div>
    );
};

export default AccountingEntries;
