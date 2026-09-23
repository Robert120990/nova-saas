import { X, Search, User } from 'lucide-react';
import Pagination from '../ui/Pagination';

/**
 * PosCustomerSearchModal Component
 * Search modal for customers/taxpayers by Name, NIT, or NRC with pagination and quick select.
 */
const PosCustomerSearchModal = ({
    isOpen,
    onClose,
    customerName,
    setCustomerName,
    customerNit,
    setCustomerNit,
    customerNrc,
    setCustomerNrc,
    handleCustomerSelect,
    isLoadingCustomerSearch,
    customerSearchData = { data: [], total: 0, totalPages: 1 },
    customerSearchPage,
    setCustomerSearchPage,
    personTypes = []
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                <div className="p-4 md:p-8 border-b bg-slate-50/30 flex justify-between items-center">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Buscar Cliente</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-xl shadow-sm transition-all">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-4 md:p-8 md:pb-4 flex flex-col gap-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Nombre / Razón Social"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/5 text-[13px] font-bold transition-all shadow-inner"
                            />
                        </div>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="NIT"
                                value={customerNit}
                                onChange={(e) => setCustomerNit(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/5 text-[13px] font-bold transition-all shadow-inner"
                            />
                        </div>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="NRC"
                                value={customerNrc}
                                onChange={(e) => setCustomerNrc(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/5 text-[13px] font-bold transition-all shadow-inner"
                            />
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            handleCustomerSelect('', null);
                            onClose();
                        }}
                        className="self-start text-[11px] font-black text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 px-3 py-1.5 rounded-lg uppercase transition-all"
                    >
                        Consumidor Final (General)
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-4 custom-scrollbar">
                    {isLoadingCustomerSearch ? (
                        <div className="py-16 text-center text-slate-400 text-sm font-medium">Cargando clientes...</div>
                    ) : (customerSearchData?.data || []).length === 0 ? (
                        <div className="text-center py-16 opacity-30">
                            <User size={64} className="mx-auto mb-4" />
                            <p className="font-black uppercase tracking-widest text-sm">No se encontraron clientes</p>
                            <p className="text-[10px] font-bold mt-2 italic">Prueba con otro nombre, NIT o NRC</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {(customerSearchData?.data || []).map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => {
                                        handleCustomerSelect(c.id, c);
                                        onClose();
                                    }}
                                    className="flex items-center gap-3 p-3 rounded-2xl border border-slate-50 hover:border-indigo-400 hover:bg-indigo-50/40 transition-all text-left group"
                                >
                                    <div className="p-2 bg-white rounded-xl shadow-sm text-slate-400 group-hover:text-indigo-500 group-hover:scale-110 transition-transform">
                                        <User size={20} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-slate-900 text-sm truncate leading-tight">{c.nombre}</div>
                                        <div className="text-[10px] font-mono text-indigo-400 font-bold uppercase">
                                            {c.nit ? `NIT: ${c.nit}` : ''}
                                            {c.nit && c.nrc ? ' | ' : ''}
                                            {c.nrc ? `NRC: ${c.nrc}` : ''}
                                            {!c.nit && !c.nrc ? (c.numero_documento || 'S/D') : ''}
                                        </div>
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">
                                        {personTypes.find(t => t.code === c.tipo_persona)?.description || 'NATURAL'}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                {customerSearchData?.totalPages > 1 && (
                    <div className="border-t border-slate-100 p-4">
                        <Pagination
                            currentPage={customerSearchPage}
                            totalPages={customerSearchData.totalPages}
                            totalItems={customerSearchData.total}
                            onPageChange={setCustomerSearchPage}
                            itemsOnPage={customerSearchData.data?.length || 0}
                            isLoading={isLoadingCustomerSearch}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default PosCustomerSearchModal;
