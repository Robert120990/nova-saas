import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { CalendarDays, CalendarRange, Sun, Info } from 'lucide-react';
import ReportLayout from '../ui/ReportLayout';
import { getTodayString } from '../../utils/dateUtils';

function getPreviousMonth(monthStr) {
    const [y, m] = monthStr.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function EnergySfvReportTab({ companyHeaders, selectedLocation }) {
    const today = getTodayString();
    const currentMonth = today.slice(0, 7);
    const prevMonth = getPreviousMonth(currentMonth);
    const currentYearNum = Number(today.slice(0, 4)) || 2026;
    const currentYear = String(currentYearNum);

    const [period, setPeriod] = useState('month'); // 'month' | 'year'
    const [selectedMonth, setSelectedMonth] = useState(prevMonth);
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const pdfUrlRef = useRef(null);
    const companyIdKey = companyHeaders?.['x-company-id'] || '';

    const revokeCurrentPdf = () => {
        if (pdfUrlRef.current) {
            window.URL.revokeObjectURL(pdfUrlRef.current);
            pdfUrlRef.current = null;
        }
        setPdfUrl(null);
    };

    useEffect(() => {
        revokeCurrentPdf();
    }, [companyIdKey]);

    useEffect(() => {
        return () => {
            if (pdfUrlRef.current) {
                window.URL.revokeObjectURL(pdfUrlRef.current);
                pdfUrlRef.current = null;
            }
        };
    }, []);

    const fileName = period === 'year'
        ? `Reporte_SFV_Anual_${selectedYear}.pdf`
        : `Reporte_SFV_Mensual_${selectedMonth}.pdf`;

    const buildParams = (format) => ({
        period,
        ...(period === 'year' ? { year: selectedYear } : { month: selectedMonth }),
        ...(format === 'excel' ? { format: 'excel' } : {})
    });

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const res = await axios.get('/api/energy/analytics/report', {
                params: buildParams('pdf'),
                headers: companyHeaders,
                responseType: 'blob'
            });
            const blob = new Blob([res.data], { type: 'application/pdf' });
            const nextUrl = window.URL.createObjectURL(blob);
            revokeCurrentPdf();
            pdfUrlRef.current = nextUrl;
            setPdfUrl(nextUrl);
            toast.success(period === 'year'
                ? `Reporte SFV Anual (${selectedYear}) generado`
                : `Reporte SFV Mensual (${selectedMonth}) generado`);
        } catch (err) {
            toast.error('Error al generar reporte SFV: ' + (err.response?.data?.message || err.message));
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!pdfUrl) return;
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const handleExportExcel = async () => {
        const toastId = toast.loading('Generando archivo Excel del SFV...');
        try {
            const res = await axios.get('/api/energy/analytics/report', {
                params: buildParams('excel'),
                headers: companyHeaders,
                responseType: 'blob'
            });
            const blob = new Blob([res.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute(
                'download',
                period === 'year'
                    ? `Reporte_SFV_Anual_${selectedYear}.xlsx`
                    : `Reporte_SFV_Mensual_${selectedMonth}.xlsx`
            );
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Reporte Excel SFV descargado', { id: toastId });
        } catch (err) {
            toast.error('Error al exportar Excel: ' + (err.response?.data?.message || err.message), { id: toastId });
        }
    };

    const yearOptions = Array.from({ length: 5 }, (_, idx) => String(currentYearNum - 3 + idx));

    return (
        <div className="-mx-2 sm:-mx-4">
            <ReportLayout
                title="Reporte SFV"
                category="Eficiencia Energética"
                subtitle={`Desempeño del Sistema Fotovoltaico y Baterías BESS • ${selectedLocation?.plantName || selectedLocation?.legalName || 'Planta Solar'}`}
                pdfUrl={pdfUrl}
                isGenerating={isGenerating}
                onGenerate={handleGenerate}
                onDownload={handleDownload}
                onExportExcel={handleExportExcel}
                generateButtonText={period === 'year' ? `Generar Reporte ${selectedYear}` : 'Generar Reporte Mensual'}
                fileName={fileName}
                footerNote="Reporte Operativo Oficial del Sistema Fotovoltaico (SFV) • Formato Carta sin firmas"
            >
                {/* Selector de Localidad Activa */}
                {selectedLocation && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center gap-2.5">
                        <Sun className="w-4 h-4 text-amber-600 shrink-0" />
                        <div className="min-w-0">
                            <span className="text-[10px] font-bold text-amber-700 uppercase block leading-tight">
                                Planta Seleccionada
                            </span>
                            <span className="text-xs font-black text-slate-900 truncate block">
                                {selectedLocation.plantName} ({selectedLocation.hasBatteries ? 'Solar + BESS' : 'Solo Solar'})
                            </span>
                        </div>
                    </div>
                )}

                {/* Tipo de Período: Por Mes o Por Año */}
                <div className="space-y-2">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Período del Reporte
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
                        <button
                            type="button"
                            onClick={() => setPeriod('month')}
                            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                                period === 'month'
                                    ? 'bg-white text-indigo-700 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <CalendarDays className="w-3.5 h-3.5" />
                            Por Mes
                        </button>
                        <button
                            type="button"
                            onClick={() => setPeriod('year')}
                            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                                period === 'year'
                                    ? 'bg-white text-indigo-700 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <CalendarRange className="w-3.5 h-3.5" />
                            Por Año
                        </button>
                    </div>
                </div>

                {/* Selector Mensual o Anual */}
                {period === 'month' ? (
                    <div className="space-y-2.5">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Mes a Reportar
                        </label>
                        <input
                            type="month"
                            value={selectedMonth}
                            max={currentMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                        />
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setSelectedMonth(prevMonth)}
                                className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold border transition-colors ${
                                    selectedMonth === prevMonth
                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                Mes Anterior
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedMonth(currentMonth)}
                                className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold border transition-colors ${
                                    selectedMonth === currentMonth
                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                Mes Actual
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Año a Reportar
                        </label>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                        >
                            {yearOptions.map((y) => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setSelectedYear(currentYear)}
                                className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold border transition-colors ${
                                    selectedYear === currentYear
                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                Año Actual ({currentYear})
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedYear(String(currentYearNum - 1))}
                                className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold border transition-colors ${
                                    selectedYear === String(currentYearNum - 1)
                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                Año Anterior ({currentYearNum - 1})
                            </button>
                        </div>
                    </div>
                )}

                {/* Resumen de contenido del reporte */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 space-y-1">
                    <p className="font-bold text-slate-800 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        Contenido incluido ({period === 'year' ? 'Anual' : 'Mensual'}):
                    </p>
                    {period === 'year' ? (
                        <ul className="list-disc pl-4 space-y-0.5 leading-relaxed">
                            <li>Resumen ejecutivo anual (kWh, MWh, ahorros y CO₂).</li>
                            <li>Estado de inversores Growatt y capacidad en paneles.</li>
                            <li>Desglose mensual Ene–Dic con % de participación.</li>
                            <li>Consolidado trimestral (Q1 – Q4).</li>
                        </ul>
                    ) : (
                        <ul className="list-disc pl-4 space-y-0.5 leading-relaxed">
                            <li>Resumen ejecutivo mensual, mejor día y pico kW.</li>
                            <li>Estado de inversores y análisis de impacto operativo.</li>
                            <li>Detalle día a día de generación, BESS y ahorro.</li>
                            <li>Comparativa histórica mensual del año.</li>
                        </ul>
                    )}
                </div>
            </ReportLayout>
        </div>
    );
}
