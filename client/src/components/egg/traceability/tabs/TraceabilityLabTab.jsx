import { formatDate } from '../../../../utils/dateUtils';
import {
    FlaskConical,
    Plus,
    Download,
    Mail,
    Send,
    Edit,
    CheckSquare,
    Square,
    FileSpreadsheet,
    FileText
} from 'lucide-react';


export default function TraceabilityLabTab({ model }) {
    const { activeTab, labLogs, loadingLab, labReleaseFilter, setLabReleaseFilter, selectedLogIds, setSelectedLogIds, handleOpenQualityLetterModal, handleOpenCreateLab, handleOpenEditLab, handleExportMarioExcel, handleGenerateCoaPdf, handleToggleSelectLog, handleSelectAllLogs, handleOpenUnifiedEmailModal } = model;

    return (<>{activeTab === 'lab' && (
                <div className="space-y-6">
                    {/* Header bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <FlaskConical className="h-4 w-4 text-teal-600" />
                                Bitácora de Análisis de Calidad y Emisión de COA
                            </h2>
                            <p className="text-xs text-slate-500 font-medium">Registro de ensayos microbiológicos, físico-químicos y despacho de certificados</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {selectedLogIds.length > 0 && (
                                <button
                                    onClick={handleOpenUnifiedEmailModal}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm animate-pulse"
                                >
                                    <Mail size={14} />
                                    Enviar {selectedLogIds.length} COA(s) al Cliente
                                </button>
                            )}
                            <button
                                onClick={handleExportMarioExcel}
                                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                                title="Descargar libro Excel con Hojas FQ y MB según formato oficial de Mario"
                            >
                                <FileSpreadsheet size={14} />
                                Excel Mario 2025
                            </button>
                            <button
                                onClick={handleOpenCreateLab}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                            >
                                <Plus size={14} />
                                Nuevo Análisis LAB-004
                            </button>
                        </div>
                    </div>

                    {/* Banner de Lotes Seleccionados para Despacho Multi-Lote */}
                    {selectedLogIds.length > 0 && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-indigo-900">
                            <div className="flex items-center gap-2">
                                <CheckSquare className="h-4 w-4 text-indigo-600 shrink-0" />
                                <span>
                                    <strong>{selectedLogIds.length} lote(s) seleccionado(s)</strong> para despacho unificado. Cada lote conservará su certificado individual de calidad, pero se enviarán agrupados en un solo correo para el cliente.
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setSelectedLogIds([])}
                                    className="px-3 py-1 bg-white border border-indigo-200 text-indigo-700 rounded-lg font-bold hover:bg-indigo-100"
                                >
                                    Desmarcar Todos
                                </button>
                                <button
                                    onClick={handleOpenUnifiedEmailModal}
                                    className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-1 shadow-sm"
                                >
                                    <Send size={12} />
                                    Enviar Correo Unificado
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Table of Lab Logs */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                        {/* Filtros de Dictamen y Liberación */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100">
                            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                                {(Array.isArray([
                                    { id: 'todos', label: 'Todos los Ensayos' },
                                    { id: 'cuarentena', label: 'Cuarentena (Incubación)' },
                                    { id: 'liberado', label: 'Liberados Aprobados' },
                                    { id: 'bloqueado_haccp', label: 'Bloqueados HACCP' }
                                ]) ? [
                                    { id: 'todos', label: 'Todos los Ensayos' },
                                    { id: 'cuarentena', label: 'Cuarentena (Incubación)' },
                                    { id: 'liberado', label: 'Liberados Aprobados' },
                                    { id: 'bloqueado_haccp', label: 'Bloqueados HACCP' }
                                ] : []).map(f => (
                                    <button
                                        key={f.id}
                                        type="button"
                                        onClick={() => setLabReleaseFilter(f.id)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            labReleaseFilter === f.id
                                                ? 'bg-white text-indigo-700 shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                            <span className="text-xs text-slate-500 font-medium">
                                Mostrando {labLogs.filter(log => {
                                    if (labReleaseFilter === 'todos') return true;
                                    const rel = log.release_status || (log.status === 'aprobado' ? 'liberado' : log.status === 'rechazado' ? 'bloqueado_haccp' : 'cuarentena');
                                    return rel === labReleaseFilter;
                                }).length} de {labLogs.length} registros
                            </span>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                            {loadingLab ? (
                                <div className="p-8 text-center text-slate-500 text-xs font-medium animate-pulse">Cargando bitácora de calidad...</div>
                            ) : labLogs.length === 0 ? (
                                <div className="p-8 text-center text-slate-500 text-xs font-medium">No se han registrado análisis de laboratorio aún.</div>
                            ) : (
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                            <th className="p-3 w-10 text-center">
                                                <button
                                                    onClick={handleSelectAllLogs}
                                                    title={selectedLogIds.length === labLogs.length ? 'Desmarcar todos' : 'Seleccionar todos'}
                                                    className="text-slate-500 hover:text-indigo-600"
                                                >
                                                    {selectedLogIds.length === labLogs.length ? <CheckSquare size={16} /> : <Square size={16} />}
                                                </button>
                                            </th>
                                            <th className="p-3">Fecha</th>
                                            <th className="p-3">Lote Juliano / Producto</th>
                                            <th className="p-3">Cliente Destino</th>
                                            <th className="p-3">Mesófilos</th>
                                            <th className="p-3">Coliformes</th>
                                            <th className="p-3">E. Coli / Salmonella</th>
                                            <th className="p-3 text-center">Sólidos / pH</th>
                                            <th className="p-3 text-center">Dictamen</th>
                                            <th className="p-3 text-center">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                                        {(Array.isArray(labLogs.filter(log => {
                                            if (labReleaseFilter === 'todos') return true;
                                            const rel = log.release_status || (log.status === 'aprobado' ? 'liberado' : log.status === 'rechazado' ? 'bloqueado_haccp' : 'cuarentena');
                                            return rel === labReleaseFilter;
                                        })) ? labLogs.filter(log => {
                                            if (labReleaseFilter === 'todos') return true;
                                            const rel = log.release_status || (log.status === 'aprobado' ? 'liberado' : log.status === 'rechazado' ? 'bloqueado_haccp' : 'cuarentena');
                                            return rel === labReleaseFilter;
                                        }) : []).map(log => {
                                            const isSelected = selectedLogIds.includes(log.id);
                                            const lotCode = log.batch_code_display || log.batch_uuid || `LOTE-${log.id}`;
                                            const customerDisplay = log.customer_name || log.customer_nombre_db || 'Venta General';
                                            const dateDisplay = log.sample_date ? formatDate(log.sample_date) : (log.analysis_date ? formatDate(log.analysis_date) : 'N/A');
                                            const statusVal = log.status || log.result_status || 'aprobado';

                                            return (
                                                <tr key={log.id} className={`transition-colors ${isSelected ? 'bg-indigo-50/50' : 'hover:bg-slate-50/80'}`}>
                                                    <td className="p-3 text-center">
                                                        <button
                                                            onClick={() => handleToggleSelectLog(log.id)}
                                                            className={`${isSelected ? 'text-indigo-600' : 'text-slate-300 hover:text-slate-500'}`}
                                                        >
                                                            {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                                                        </button>
                                                    </td>
                                                    <td className="p-3 text-xs text-slate-600 whitespace-nowrap">
                                                        {dateDisplay}
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-slate-900 text-xs font-mono">{lotCode}</span>
                                                            <span className="text-[10px] text-slate-500 capitalize">{log.product_type} ({log.presentation || 'Cubeta 30 Lb'})</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3">
                                                        <span className="font-semibold text-slate-800 text-xs">{customerDisplay}</span>
                                                    </td>
                                                    <td className="p-3 text-teal-700 font-bold">
                                                        {log.mesophilic_aerobic_cfu ? `< ${log.mesophilic_aerobic_cfu} UFC/g` : (log.mesofilos_aerobios || '< 1,000 UFC/g')}
                                                    </td>
                                                    <td className="p-3 text-teal-700 font-bold">
                                                        {log.total_coliforms_mpn ? `< ${log.total_coliforms_mpn} UFC/g` : (log.coliformes_totales || '< 10 UFC/g')}
                                                    </td>
                                                    <td className="p-3 text-xs">
                                                        <span className="block text-slate-800 font-bold">{log.e_coli_mpn ? 'Ausencia' : (log.escherichia_coli || 'Ausencia')}</span>
                                                        <span className="text-teal-700 font-bold">{log.salmonella_25g || log.salmonella_spp || 'Ausencia'}</span>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <span className="text-slate-900 font-bold">
                                                            {log.solids_percentage ? `${log.solids_percentage}%` : (log.solidos_totales_pct ? `${log.solidos_totales_pct}%` : '24.2%')}
                                                        </span>
                                                        <span className="text-slate-500 text-[10px] block">pH: {log.ph || '7.4'}</span>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusVal === 'aprobado' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                                                statusVal === 'cuarentena' || statusVal === 'retenido' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                                                    'bg-rose-50 text-rose-700 border border-rose-200'
                                                            }`}>
                                                            {statusVal}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button
                                                                onClick={() => handleGenerateCoaPdf(log)}
                                                                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-all shadow-xs"
                                                                title="Descargar Certificado de Análisis Oficial"
                                                            >
                                                                <Download size={12} />
                                                                COA PDF
                                                            </button>
                                                            <button
                                                                onClick={() => handleOpenQualityLetterModal(log)}
                                                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-lg text-xs font-bold flex items-center gap-1 transition-all shadow-xs"
                                                                title="Generar Carta de Calidad del Lote (PDF / Word / Excel)"
                                                            >
                                                                <FileText size={12} />
                                                                Carta Calidad
                                                            </button>
                                                            <button
                                                                onClick={() => handleOpenEditLab(log)}
                                                                className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all"
                                                                title="Editar Análisis y Parámetros del Lote"
                                                            >
                                                                <Edit size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}</>);
}
