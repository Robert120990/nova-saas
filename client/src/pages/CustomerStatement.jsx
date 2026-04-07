import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
    FileText, 
    Search, 
    Download, 
    Mail, 
    Printer, 
    User, 
    Building2,
    DollarSign,
    FilterX,
    Calendar,
    Clock
} from 'lucide-react';
import { toast } from 'sonner';
import SearchableSelect from '../components/ui/SearchableSelect';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';

const fmt = (n) => `$${parseFloat(n || 0).toFixed(2)}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-SV') : '—';

const CustomerStatement = () => {
    const [selectedBranchId, setSelectedBranchId] = useState('');
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [activeTab, setActiveTab] = useState('movimientos'); // 'movimientos' | 'antiguedad'

    // Queries
    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await axios.get('/api/branches')).data
    });

    const { data: customers = [] } = useQuery({
        queryKey: ['customers-all'],
        queryFn: async () => (await axios.get('/api/customers', { params: { limit: 1000 } })).data?.data || []
    });

    // Pestaña 1: Estado de Cuenta (Movimientos)
    const { data: statementData, isLoading: isLoadingStatement } = useQuery({
        queryKey: ['customer-statement', selectedCustomerId, selectedBranchId, searchTerm, page],
        queryFn: async () => {
            if (!selectedCustomerId || !selectedBranchId) return null;
            const res = await axios.get('/api/cxc/statement', { 
                params: { customer_id: selectedCustomerId, branch_id: selectedBranchId, search: searchTerm, page, limit } 
            });
            return res.data;
        },
        enabled: !!selectedCustomerId && !!selectedBranchId && activeTab === 'movimientos'
    });

    // Pestaña 2: Antigüedad de Saldos
    const { data: agingData, isLoading: isLoadingAging } = useQuery({
        queryKey: ['customer-aging', selectedCustomerId, selectedBranchId],
        queryFn: async () => {
            if (!selectedCustomerId || !selectedBranchId) return null;
            const res = await axios.get('/api/cxc/aging-report', { 
                params: { customer_id: selectedCustomerId, branch_id: selectedBranchId } 
            });
            return res.data;
        },
        enabled: !!selectedCustomerId && !!selectedBranchId && activeTab === 'antiguedad'
    });

    const handleSendEmail = async () => {
        if (!selectedCustomerId || !selectedBranchId) return;
        
        const endpoint = activeTab === 'movimientos' 
            ? '/api/cxc/statement/send-email' 
            : '/api/cxc/aging-report/send-email';

        const promise = axios.post(endpoint, {
            customer_id: selectedCustomerId,
            branch_id: selectedBranchId
        });

        toast.promise(promise, {
            loading: 'Enviando reporte...',
            success: 'Reporte enviado al cliente',
            error: 'Error al enviar el correo'
        });
    };

    const handleExportExcel = async () => {
        if (activeTab === 'movimientos') {
            if (!statementData?.movements?.length) return toast.error('No hay datos para exportar');
            try {
                const { utils, writeFile } = await import('xlsx');
                const exportData = statementData.movements.map(m => ({
                    'Fecha': fmtDate(m.fecha),
                    'Tipo': m.tipo,
                    'Número/Referencia': m.numero,
                    'Concepto': m.concepto,
                    'Cargo (+)': parseFloat(m.cargo),
                    'Abono (-)': parseFloat(m.abono),
                    'Saldo': parseFloat(m.balance)
                }));
                const ws = utils.json_to_sheet(exportData);
                const wb = utils.book_new();
                utils.book_append_sheet(wb, ws, "Estado de Cuenta");
                writeFile(wb, `Estado_Cuenta_${selectedCustomerId}_${new Date().getTime()}.xlsx`);
                toast.success('Excel generado');
            } catch (error) { toast.error('Error al generar Excel'); }
        } else {
            if (!agingData?.documents?.length) return toast.error('No hay datos para exportar');
            try {
                const { utils, writeFile } = await import('xlsx');
                const exportData = agingData.documents.map(d => ({
                    'Fecha': fmtDate(d.fecha),
                    'Documento': d.documento,
                    'Tipo': d.tipo,
                    '0-30': d.d0_30,
                    '31-60': d.d31_60,
                    '61-90': d.d61_90,
                    '91-180': d.d91_180,
                    '181-365': d.d181_365,
                    '+365': d.d365_plus
                }));
                const ws = utils.json_to_sheet(exportData);
                const wb = utils.book_new();
                utils.book_append_sheet(wb, ws, "Antigüedad de Saldos");
                writeFile(wb, `Antiguedad_Saldos_${selectedCustomerId}_${new Date().getTime()}.xlsx`);
                toast.success('Excel generado');
            } catch (error) { toast.error('Error al generar Excel'); }
        }
    };

    const handleExportPDF = async () => {
        if (!selectedCustomerId || !selectedBranchId) return;
        
        const endpoint = activeTab === 'movimientos' 
            ? '/api/cxc/statement/pdf' 
            : '/api/cxc/aging-report/pdf';
        
        const fileName = activeTab === 'movimientos' ? 'Estado_Cuenta' : 'Antiguedad_Saldos';

        const toastId = toast.loading('Generando PDF...');
        try {
            const res = await axios.get(endpoint, {
                params: { customer_id: selectedCustomerId, branch_id: selectedBranchId },
                responseType: 'blob'
            });
            
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${fileName}_${selectedCustomerId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('PDF descargado', { id: toastId });
        } catch (error) {
            toast.error('Error al generar PDF', { id: toastId });
        }
    };

    const totalBalance = activeTab === 'movimientos' 
        ? statementData?.total_balance 
        : agingData?.total_balance;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">Consulta de Cliente (CxC)</h2>
                    <p className="text-slate-500 font-medium text-xs uppercase tracking-widest">Estado de cuenta y antigüedad de saldos pormenorizado</p>
                </div>
                
                <div className="flex items-center gap-2">
                    <button 
                        onClick={handleExportExcel}
                        className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl hover:bg-emerald-100 transition-all shadow-sm"
                        title="Exportar Excel"
                    >
                        <Download size={20} />
                    </button>
                    <button 
                        onClick={handleExportPDF}
                        className="bg-rose-50 text-rose-600 p-2.5 rounded-xl hover:bg-rose-100 transition-all shadow-sm"
                        title="Exportar PDF"
                    >
                        <Printer size={20} />
                    </button>
                    <button 
                        onClick={handleSendEmail}
                        className="bg-indigo-50 text-indigo-600 p-2.5 rounded-xl hover:bg-indigo-100 transition-all shadow-sm"
                        title="Enviar por Correo"
                    >
                        <Mail size={20} />
                    </button>
                </div>
            </div>

            {/* Selectors Card */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 flex items-center gap-2">
                        <Building2 size={12} /> Seleccionar Sucursal
                    </label>
                    <select 
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl font-bold text-[11px] uppercase outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all cursor-pointer h-[34px]"
                        value={selectedBranchId}
                        onChange={(e) => setSelectedBranchId(e.target.value)}
                    >
                        <option value="">-- ELEGIR SUCURSAL --</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.nombre?.toUpperCase()}</option>)}
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1 flex items-center gap-2">
                        <User size={12} /> Seleccionar Cliente
                    </label>
                    <SearchableSelect 
                        placeholder="BUSCAR CLIENTE POR NOMBRE O DOC..."
                        options={customers}
                        value={selectedCustomerId}
                        onChange={(e) => setSelectedCustomerId(e.target.value)}
                        valueKey="id"
                        labelKey="nombre"
                        codeKey="numero_documento"
                        codeLabel="DOC"
                    />
                </div>
            </div>

            {/* Tab Switcher */}
            <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit self-center mx-auto shadow-inner">
                {[
                    { id: 'movimientos', label: 'Estado de Cuenta', icon: FileText },
                    { id: 'antiguedad', label: 'Antigüedad de Saldos', icon: Clock }
                ].map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                            activeTab === t.id ? 'bg-white text-indigo-600 shadow-xl scale-[1.02]' : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        <t.icon size={14} />
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Summary Balance */}
            {selectedCustomerId && selectedBranchId && totalBalance !== undefined && (
                <div className="bg-indigo-600 rounded-[1.5rem] p-5 text-white flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg shadow-indigo-100 italic animate-in zoom-in-95 duration-300">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                            <DollarSign size={24} />
                        </div>
                        <div>
                            <h3 className="text-[9px] font-black uppercase tracking-widest text-indigo-100">Saldo Total Pendiente</h3>
                            <p className="text-2xl font-black leading-tight">${parseFloat(totalBalance).toFixed(2)}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Content Area */}
            {!selectedCustomerId || !selectedBranchId ? (
                <div className="bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-200 py-32 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="p-6 bg-white rounded-full shadow-sm text-slate-300">
                        <Search size={48} />
                    </div>
                    <div>
                        <p className="text-sm font-black text-slate-400 uppercase tracking-widest italic">Seleccione una sucursal y un cliente para generar el reporte</p>
                    </div>
                </div>
            ) : (activeTab === 'movimientos' ? (
                // Pestaña Movimientos
                isLoadingStatement ? (
                    <div className="py-32 flex flex-col items-center justify-center space-y-4">
                        <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Generando Estado de Cuenta...</p>
                    </div>
                ) : statementData ? (
                    <div className="space-y-6">
                        <div className="flex bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
                            <div className="relative w-full md:w-96">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input 
                                    type="text"
                                    placeholder="FILTRAR POR NÚMERO O REF..."
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] font-bold uppercase outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all font-mono"
                                    value={searchTerm}
                                    onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                                />
                            </div>
                        </div>
                        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                            <Table 
                                headers={['Fecha', 'Documento / Referencia', 'Concepto', 'Cargo (+)', 'Abono (-)', 'Saldo']}
                                data={statementData.movements}
                                renderRow={(m, i) => (
                                    <tr key={i} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-0 italic">
                                        <td className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-tighter">{fmtDate(m.fecha)}</td>
                                        <td className="px-8 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-slate-900 uppercase leading-none mb-1">{m.tipo}</span>
                                                <span className="text-[10px] font-bold text-indigo-500 font-mono tracking-tighter">{m.numero || 'S/N'}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-4">
                                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black tracking-widest uppercase ${
                                                m.concepto === 'VENTA' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                                            }`}>{m.concepto}</span>
                                        </td>
                                        <td className="px-8 py-4 text-xs font-black text-rose-500">{m.cargo > 0 ? `+ ${fmt(m.cargo)}` : ''}</td>
                                        <td className="px-8 py-4 text-xs font-black text-emerald-500">{m.abono > 0 ? `- ${fmt(m.abono)}` : ''}</td>
                                        <td className="px-8 py-4 text-xs font-black text-slate-900 bg-slate-50/30">{fmt(m.balance)}</td>
                                    </tr>
                                )}
                            />
                            {statementData.pagination && (
                                <div className="px-8 border-t border-slate-50">
                                    <Pagination 
                                        currentPage={page} totalPages={statementData.pagination.pages}
                                        totalItems={statementData.pagination.total} onPageChange={setPage}
                                        itemsOnPage={statementData.movements.length} isLoading={isLoadingStatement}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                ) : <NoDataFound />
            ) : (
                // Pestaña Antigüedad
                isLoadingAging ? (
                    <div className="py-32 flex flex-col items-center justify-center space-y-4">
                        <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Generando Antigüedad de Saldos...</p>
                    </div>
                ) : agingData ? (
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden animate-in fade-in lg:mx-[-1rem]">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50/50">
                                    <tr className="border-b border-slate-100 uppercase italic">
                                        <th className="px-6 py-4 text-[9px] font-black text-slate-400 tracking-widest">Fecha</th>
                                        <th className="px-6 py-4 text-[9px] font-black text-slate-400 tracking-widest">Documento</th>
                                        <th className="px-6 py-4 text-[9px] font-black text-slate-400 tracking-widest">Tipo</th>
                                        <th className="px-4 py-4 text-[9px] font-black text-slate-600 tracking-widest text-right whitespace-nowrap">0-30 Días</th>
                                        <th className="px-4 py-4 text-[9px] font-black text-slate-600 tracking-widest text-right whitespace-nowrap">31-60 Días</th>
                                        <th className="px-4 py-4 text-[9px] font-black text-slate-600 tracking-widest text-right whitespace-nowrap">61-90 Días</th>
                                        <th className="px-4 py-4 text-[9px] font-black text-slate-600 tracking-widest text-right whitespace-nowrap">91-180 Días</th>
                                        <th className="px-4 py-4 text-[9px] font-black text-slate-600 tracking-widest text-right whitespace-nowrap">181-365 Días</th>
                                        <th className="px-4 py-4 text-[9px] font-black text-slate-600 tracking-widest text-right whitespace-nowrap">+365 Días</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 italic">
                                    {agingData.documents.map((d, i) => (
                                        <tr key={i} className="hover:bg-slate-50/30 transition-colors">
                                            <td className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase">{fmtDate(d.fecha)}</td>
                                            <td className="px-6 py-3 text-[10px] font-black text-indigo-500 font-mono tracking-tighter">{d.documento}</td>
                                            <td className="px-6 py-3 text-[10px] font-black text-slate-900 uppercase">{d.tipo}</td>
                                            <td className="px-4 py-3 text-[10px] font-bold text-right">{d.d0_30 > 0 ? fmt(d.d0_30) : '—'}</td>
                                            <td className="px-4 py-3 text-[10px] font-bold text-right">{d.d31_60 > 0 ? fmt(d.d31_60) : '—'}</td>
                                            <td className="px-4 py-3 text-[10px] font-bold text-right">{d.d61_90 > 0 ? fmt(d.d61_90) : '—'}</td>
                                            <td className="px-4 py-3 text-[10px] font-bold text-right">{d.d91_180 > 0 ? fmt(d.d91_180) : '—'}</td>
                                            <td className="px-4 py-3 text-[10px] font-bold text-right">{d.d181_365 > 0 ? fmt(d.d181_365) : '—'}</td>
                                            <td className="px-4 py-3 text-[10px] font-bold text-right text-rose-600">{d.d365_plus > 0 ? fmt(d.d365_plus) : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-indigo-50/30 border-t-2 border-indigo-100/50">
                                    <tr className="font-black text-[10px] text-indigo-600 italic">
                                        <td colSpan={3} className="px-6 py-4 text-xs uppercase tracking-widest text-indigo-900">Totales Saldo</td>
                                        <td className="px-4 py-4 text-right">{fmt(agingData.totals.t0_30)}</td>
                                        <td className="px-4 py-4 text-right">{fmt(agingData.totals.t31_60)}</td>
                                        <td className="px-4 py-4 text-right">{fmt(agingData.totals.t61_90)}</td>
                                        <td className="px-4 py-4 text-right">{fmt(agingData.totals.t91_180)}</td>
                                        <td className="px-4 py-4 text-right">{fmt(agingData.totals.t181_365)}</td>
                                        <td className="px-4 py-4 text-right">{fmt(agingData.totals.t365_plus)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                ) : <NoDataFound />
            ))}
        </div>
    );
};

const NoDataFound = () => (
    <div className="bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-200 py-32 flex flex-col items-center justify-center text-center space-y-4 animate-in zoom-in duration-500">
        <div className="p-6 bg-white rounded-full shadow-sm text-slate-300">
            <FilterX size={48} />
        </div>
        <div>
            <p className="text-sm font-black text-slate-400 uppercase tracking-widest italic">No se encontraron datos para los criterios seleccionados</p>
        </div>
    </div>
);

export default CustomerStatement;
