import { Download, FileSpreadsheet, Save, Lock, Unlock, Trash2, FileText, ReceiptText, Search } from 'lucide-react';

const Quincena25ActionBar = ({ model }) => {
    const { selectedYear, selectedDepto, selectedBranch, searchTerm, setSearchTerm, setPreviewPeriodo, departamentos, itemsActuales, esPagada, handleGuardar, handleCerrarPeriodo, handleReabrirPeriodo, handleEliminarPeriodo, handleDownloadBanco, handleDownloadHaciendaF14, hasCurrentDraft, contextBusy } = model;
    return (
        <>
            {/* Toolbar de Acciones (Guardar, Cerrar, PDFs, Exportaciones) */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-2">
                {/* Buscador de Empleado */}
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
                    <input
                        type="text"
                        placeholder="Buscar por código, nombre..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
            
                {/* Botones de Operación */}
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                    {/* Guardar Planilla */}
                    {itemsActuales.length > 0 && !esPagada && (
                        <button
                            onClick={handleGuardar}
                            disabled={contextBusy || !hasCurrentDraft}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 transition-all"
                        >
                            <Save size={14} />
                            Guardar Planilla
                        </button>
                    )}
            
                    {/* Cerrar Período */}
                    {itemsActuales.length > 0 && !esPagada && (
                        <button
                            onClick={handleCerrarPeriodo}
                            disabled={contextBusy || hasCurrentDraft}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-900 text-white shadow-sm transition-all"
                        >
                            <Lock size={14} />
                            Cerrar Período
                        </button>
                    )}
            
                    {/* Reabrir Período */}
                    {esPagada && (
                        <button
                            onClick={handleReabrirPeriodo}
                            disabled={contextBusy}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-all"
                        >
                            <Unlock size={14} />
                            Reabrir Período
                        </button>
                    )}
            
                    {/* Ver Planilla Oficial PDF */}
                    {itemsActuales.length > 0 && (
                        <button
                            onClick={() => setPreviewPeriodo({
                                anio: selectedYear,
                                tipo: 'quincena25',
                                departamento_id: selectedDepto,
                                departamento_nombre: departamentos.find(d => String(d.id) === String(selectedDepto))?.descripcion,
                                branch_id: selectedBranch
                            })}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-all"
                        >
                            <FileText size={14} />
                            Planilla PDF
                        </button>
                    )}
            
                    {/* Ver Recibos de Pago PDF */}
                    {itemsActuales.length > 0 && (
                        <button
                            onClick={() => setPreviewPeriodo({
                                anio: selectedYear,
                                tipo: 'quincena25-recibos',
                                departamento_id: selectedDepto,
                                departamento_nombre: departamentos.find(d => String(d.id) === String(selectedDepto))?.descripcion,
                                branch_id: selectedBranch
                            })}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-all"
                        >
                            <ReceiptText size={14} />
                            Recibos PDF
                        </button>
                    )}
            
                    {/* Exportar Banco */}
                    {itemsActuales.length > 0 && (
                        <button
                            onClick={() => handleDownloadBanco('ambos')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 transition-all"
                        >
                            <Download size={14} />
                            Banco (CSV/TXT)
                        </button>
                    )}
            
                    {/* Exportar Anexo F-14 Hacienda */}
                    {itemsActuales.length > 0 && (
                        <button
                            onClick={handleDownloadHaciendaF14}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all"
                            title="Descargar Anexo F-14 para Ministerio de Hacienda (MH.UVI.DGII/006.001/2026)"
                        >
                            <FileSpreadsheet size={14} />
                            Anexo F-14 MH
                        </button>
                    )}
            
                    {/* Eliminar Período */}
                    {itemsActuales.length > 0 && !esPagada && (
                        <button
                            onClick={handleEliminarPeriodo}
                            disabled={contextBusy}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-xl text-red-600 hover:bg-red-50 border border-red-200 transition-all"
                            title="Eliminar registros calculados"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            </div>
        </>
    );
};

export default Quincena25ActionBar;
