import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import {
    FileText, X, Download, FileSpreadsheet, Search, Loader2, Edit3
} from 'lucide-react';
import Table from '../ui/Table';
import {
    getTodayString,
    getFirstDayOfMonth,
    formatDate,
    normalizeDateRangeInput,
    getDateRangePreset
} from '../../utils/dateUtils';
import BiometricEditOvertimeModal from './BiometricEditOvertimeModal';

const BiometricReportModal = ({ open, onClose }) => {
    const [startDate, setStartDate] = useState(getFirstDayOfMonth());
    const [endDate, setEndDate] = useState(getTodayString());
    const [search, setSearch] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState(null);

    const { data: reportData = { rows: [], summary: {} }, isLoading, refetch } = useQuery({
        queryKey: ['rh-biometric-attendance-report', startDate, endDate, search],
        queryFn: async () => {
            const res = await axios.get('/api/rh/biometric/report', {
                params: {
                    startDate: startDate || undefined,
                    endDate: endDate || undefined,
                    search: search.trim() || undefined
                }
            });
            return res.data || { rows: [], summary: {} };
        },
        enabled: open
    });

    if (!open) return null;

    const rows = Array.isArray(reportData?.rows) ? reportData.rows : [];
    const summary = reportData?.summary || {
        total_registros: 0,
        total_horas_trabajadas: 0,
        total_llegadas_tarde: 0,
        total_horas_extra: 0,
        total_ausencias_justificadas: 0,
        total_ausencias_injustificadas: 0,
        total_permisos_pendientes: 0
    };

    const totalAusencias = Number(summary.total_ausencias_justificadas || 0)
        + Number(summary.total_ausencias_injustificadas || 0)
        + Number(summary.total_permisos_pendientes || 0);

    const handleExport = async (format, template = '') => {
        try {
            setIsExporting(true);
            const res = await axios.get('/api/rh/biometric/report/export', {
                params: {
                    startDate: startDate || undefined,
                    endDate: endDate || undefined,
                    search: search.trim() || undefined,
                    format,
                    template
                },
                responseType: 'blob'
            });

            const isExcel = format.includes('excel') || format === 'excel';
            const mimeType = isExcel
                ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                : 'application/pdf';
            const ext = isExcel ? 'xlsx' : 'pdf';
            const blob = new Blob([res.data], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const filename = template === 'andelsa' || format === 'andelsa_excel'
                ? `Horas_Extras_Quincenal_${startDate}_al_${endDate}.${ext}`
                : `Reporte_Asistencia_${startDate}_al_${endDate}.${ext}`;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            toast.success(`Reporte ${isExcel ? 'Excel' : 'PDF'} generado con éxito.`);
        } catch (error) {
            console.error('Error al exportar reporte:', error);
            toast.error('Error al exportar el reporte');
        } finally {
            setIsExporting(false);
        }
    };

    const headers = [
        { label: 'Fecha', sortKey: 'fecha', sortType: 'date' },
        { label: 'Empleado', sortKey: 'nombre', sortType: 'string' },
        { label: 'Entrada', sortKey: 'entrada', sortType: 'string' },
        { label: 'Sal. Alm.', sortKey: 'salida_almuerzo', sortType: 'string' },
        { label: 'Ent. Alm.', sortKey: 'entrada_almuerzo', sortType: 'string' },
        { label: 'Salida', sortKey: 'salida', sortType: 'string' },
        { label: 'Horas', sortKey: 'horas_trabajadas', sortType: 'number', className: 'text-right' },
        { label: 'Tardanza', sortKey: 'minutos_tardanza', sortType: 'number', className: 'text-right' },
        { label: 'H. Extra', sortKey: 'horas_extra', sortType: 'number', className: 'text-right' }
    ];

    return (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50/70">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-800">
                                Reporte de Asistencia y Control Horario
                            </h2>
                            <p className="text-xs text-slate-500 font-medium">
                                Horas laboradas, tardanzas, horas extras, permisos e inasistencias
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={() => handleExport('andelsa_excel', 'andelsa')}
                            disabled={isExporting}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-xl transition-all shadow-sm disabled:opacity-50"
                        >
                            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                            <span>Formato Quincenal (.xlsx)</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleExport('excel', 'tabular')}
                            disabled={isExporting}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all shadow-sm disabled:opacity-50"
                        >
                            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 text-emerald-600" />}
                            <span>Listado Excel</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleExport('pdf')}
                            disabled={isExporting}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all shadow-sm disabled:opacity-50"
                        >
                            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            <span>Descargar PDF</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors ml-1"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Filters Bar */}
                <div className="p-4 bg-slate-50/80 border-b border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="flex items-center gap-2 flex-wrap sm:col-span-2">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Rango:</span>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => {
                                const next = normalizeDateRangeInput('start', e.target.value, startDate, endDate);
                                setStartDate(next.startDate);
                                setEndDate(next.endDate);
                            }}
                            className="text-xs font-semibold border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                        />
                        <span className="text-slate-400 text-xs font-bold">a</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => {
                                const next = normalizeDateRangeInput('end', e.target.value, startDate, endDate);
                                setStartDate(next.startDate);
                                setEndDate(next.endDate);
                            }}
                            className="text-xs font-semibold border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                        />
                        {[
                            { id: 'quincena_actual', label: 'Quincena Actual' },
                            { id: 'quincena_anterior', label: 'Quincena Anterior' },
                            { id: 'mes_actual', label: 'Este Mes' }
                        ].map((p) => {
                            const pr = getDateRangePreset(p.id);
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => { setStartDate(pr.startDate); setEndDate(pr.endDate); }}
                                    className="px-2 py-1 rounded-lg text-[10.5px] font-bold bg-white text-slate-600 border border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-colors"
                                >
                                    {p.label}
                                </button>
                            );
                        })}
                    </div>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Buscar por colaborador..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full text-xs font-medium border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    </div>
                </div>

                {/* KPIs Summary */}
                <div className="px-6 py-3 bg-white border-b border-slate-100 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Días / Registros</span>
                        <span className="text-base font-black text-slate-800">{summary.total_registros || 0}</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Horas Laboradas</span>
                        <span className="text-base font-black text-indigo-700">{summary.total_horas_trabajadas || 0} hrs</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
                        <span className="text-[10px] font-bold text-rose-500 uppercase block">Llegadas Tarde</span>
                        <span className="text-base font-black text-rose-600">{summary.total_llegadas_tarde || 0}</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
                        <span className="text-[10px] font-bold text-emerald-600 uppercase block">Horas Extra</span>
                        <span className="text-base font-black text-emerald-700">{summary.total_horas_extra || 0} hrs</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70 col-span-2 sm:col-span-1">
                        <span className="text-[10px] font-bold text-amber-600 uppercase block">Permisos / Faltas</span>
                        <span className="text-base font-black text-amber-700">{totalAusencias}</span>
                    </div>
                </div>

                {/* Report Table */}
                <div className="overflow-y-auto flex-1 p-4">
                    <Table
                        headers={headers}
                        data={rows}
                        isLoading={isLoading}
                        emptyMessage="No hay registros de asistencia para el rango seleccionado."
                        renderRow={(r, idx) => (
                            <tr key={`${r.codigo}-${r.fecha}-${idx}`} className="hover:bg-slate-50/70 transition-colors text-xs">
                                <td className="py-2 px-3 whitespace-nowrap font-mono font-medium">
                                    {formatDate(r.fecha)}
                                    {r.es_festivo && (
                                        <span className="ml-1 text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                                            Festivo
                                        </span>
                                    )}
                                </td>
                                <td className="py-2 px-3">
                                    <span className="font-bold text-slate-800 block">{r.nombre}</span>
                                    <span className="text-[10px] text-slate-400">[{r.codigo}] {r.departamento}</span>
                                    {!r.es_ausencia && r.ausencia_label && (
                                        <span className="block text-[10px] font-semibold text-indigo-600 mt-0.5">
                                            {r.ausencia_label}
                                        </span>
                                    )}
                                </td>
                                {r.es_ausencia ? (
                                    <td colSpan={4} className="py-2 px-3">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border ${
                                            r.ausencia_estado === 'pendiente'
                                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                : r.ausencia_goce
                                                    ? 'bg-sky-50 text-sky-700 border-sky-200'
                                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                        }`}>
                                            {r.observacion || r.entrada}
                                        </span>
                                    </td>
                                ) : (
                                    <>
                                        <td className="py-2 px-3 font-mono">{r.entrada}</td>
                                        <td className="py-2 px-3 font-mono text-slate-500">{r.salida_almuerzo}</td>
                                        <td className="py-2 px-3 font-mono text-slate-500">{r.entrada_almuerzo}</td>
                                        <td className="py-2 px-3 font-mono">{r.salida}</td>
                                    </>
                                )}
                                <td className="py-2 px-3 font-mono font-bold text-right text-slate-800">
                                    {r.horas_trabajadas > 0 ? r.horas_trabajadas.toFixed(2) : '—'}
                                </td>
                                <td className="py-2 px-3 font-mono text-right whitespace-nowrap">
                                    {r.es_llegada_tarde ? (
                                        <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                            {r.minutos_tardanza} m
                                        </span>
                                    ) : (
                                        <span className="text-slate-300">—</span>
                                    )}
                                </td>
                                <td className="py-2 px-3 font-mono text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1.5">
                                        {r.horas_extra > 0 ? (
                                            <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                                +{r.horas_extra.toFixed(2)} h
                                            </span>
                                        ) : (
                                            <span className="text-slate-300">—</span>
                                        )}
                                        {!r.es_ausencia && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedEntry({
                                                        ...r,
                                                        horas_extra_calculadas: r.horas_extra,
                                                        horas_extra_aprobadas: r.horas_extra
                                                    });
                                                    setIsEditModalOpen(true);
                                                }}
                                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                                title="Editar horas extra"
                                            >
                                                <Edit3 className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        )}
                    />
                </div>

                <div className="flex items-center justify-end px-6 py-3 border-t border-slate-100 bg-slate-50/50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-200/70 rounded-xl transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>

            <BiometricEditOvertimeModal
                open={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                entry={selectedEntry}
                onSuccess={() => refetch()}
            />
        </div>
    );
};

export default BiometricReportModal;
