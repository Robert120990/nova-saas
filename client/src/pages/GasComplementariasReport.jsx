import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
    GitBranch, 
    Calendar, 
    Clock, 
    ChevronDown, 
    ChevronRight,
    Layers,
    Receipt,
    Fuel
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import ReportLayout from '../components/ui/ReportLayout';
import Money from '../components/ui/Money';
import { getTodayString, getFirstDayOfMonth } from '../utils/dateUtils';

const GasComplementariasReport = () => {
    const { user } = useAuth();

    const today = getTodayString();
    const firstDayOfMonth = getFirstDayOfMonth();

    const [filters, setFilters] = useState({
        start_date: firstDayOfMonth,
        end_date: today,
        branch_id: user?.branch_id || 'all',
        turno: 'all',
        modalidad: 'detallado'
    });

    const [isGenerating, setIsGenerating] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [reportData, setReportData] = useState(null);
    const [expandedShifts, setExpandedShifts] = useState({});

    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await axios.get('/api/branches')).data
    });

    const handleFilterChange = (name, value) => {
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const toggleShiftExpand = (shiftKey) => {
        setExpandedShifts(prev => ({ ...prev, [shiftKey]: !prev[shiftKey] }));
    };

    const handleGenerateReport = async () => {
        if (!filters.start_date || !filters.end_date) {
            toast.error('Debe seleccionar un rango de fechas');
            return;
        }

        setIsGenerating(true);
        try {
            const params = {
                start_date: filters.start_date,
                end_date: filters.end_date,
                branch_id: filters.branch_id,
                turno: filters.turno,
                modalidad: filters.modalidad
            };

            // 1. Fetch PDF Blob for preview
            const pdfResponse = await axios.get('/api/gas-station/reports/complementarias/pdf', {
                params,
                responseType: 'blob'
            });

            if (pdfUrl) URL.revokeObjectURL(pdfUrl);

            const blob = new Blob([pdfResponse.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);

            // 2. Fetch structured JSON data for interactive view & metrics
            const jsonResponse = await axios.get('/api/gas-station/reports/complementarias/data', { params });
            if (jsonResponse.data?.success) {
                setReportData(jsonResponse.data.data);
            }

            toast.success('Reporte de complementarias generado');
        } catch (error) {
            console.error('Error al generar reporte:', error);
            toast.error('Error al generar el reporte de complementarias');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!pdfUrl) return;
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.setAttribute('download', `Complementarias_Emitidas_${filters.start_date}_al_${filters.end_date}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const handleExportExcel = async () => {
        try {
            const params = {
                start_date: filters.start_date,
                end_date: filters.end_date,
                branch_id: filters.branch_id,
                turno: filters.turno,
                modalidad: filters.modalidad,
                format: 'excel'
            };
            const response = await axios.get('/api/gas-station/reports/complementarias/pdf', {
                params,
                responseType: 'blob'
            });
            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Complementarias_Emitidas_${filters.start_date}_al_${filters.end_date}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            toast.success('Reporte exportado a Excel');
        } catch (error) {
            console.error('Error al exportar a Excel:', error);
            toast.error('Error al exportar a Excel');
        }
    };

    const grandTotals = reportData?.grandTotals;
    const summaryByDay = reportData?.summaryByDay || [];
    const groupedByDay = reportData?.groupedByDay || [];
    const summaryByProduct = reportData?.summaryByProduct || [];

    return (
        <div className="space-y-6">
            <ReportLayout
                title="Reporte de Complementarias Emitidas"
                subtitle="Resumen de complementarias por día y turno con detalle de combustibles y DTEs"
                category="Gasolinera"
                pdfUrl={pdfUrl}
                isGenerating={isGenerating}
                onGenerate={handleGenerateReport}
                onDownload={handleDownload}
                onExportExcel={handleExportExcel}
                canGenerate={Boolean(filters.start_date && filters.end_date)}
                fileName={`Complementarias_Emitidas_${filters.start_date}_al_${filters.end_date}.pdf`}
            >
                {/* Selector de Sucursal */}
                <div className="space-y-2">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <GitBranch size={13} className="text-indigo-500" /> Sucursal
                    </label>
                    <select
                        name="branch_id"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={filters.branch_id}
                        onChange={(e) => handleFilterChange('branch_id', e.target.value)}
                    >
                        <option value="all">Todas las sucursales</option>
                        {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.nombre}</option>
                        ))}
                    </select>
                </div>

                {/* Selector de Turno */}
                <div className="space-y-2">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <Clock size={13} className="text-indigo-500" /> Turno
                    </label>
                    <select
                        name="turno"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={filters.turno}
                        onChange={(e) => handleFilterChange('turno', e.target.value)}
                    >
                        <option value="all">Todos los turnos</option>
                        <option value="1">Turno 1</option>
                        <option value="2">Turno 2</option>
                        <option value="3">Turno 3</option>
                    </select>
                </div>

                {/* Modalidad de Presentación */}
                <div className="space-y-2">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <Layers size={13} className="text-indigo-500" /> Modalidad de Reporte
                    </label>
                    <select
                        name="modalidad"
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                        value={filters.modalidad}
                        onChange={(e) => handleFilterChange('modalidad', e.target.value)}
                    >
                        <option value="detallado">Detallado (con DTEs individuales)</option>
                        <option value="resumido">Resumido (totales por turno)</option>
                    </select>
                </div>

                {/* Fecha Inicio */}
                <div className="space-y-2">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <Calendar size={13} className="text-indigo-500" /> Fecha Inicio
                    </label>
                    <input
                        type="date"
                        name="start_date"
                        value={filters.start_date}
                        onChange={(e) => handleFilterChange('start_date', e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                </div>

                {/* Fecha Fin */}
                <div className="space-y-2">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <Calendar size={13} className="text-indigo-500" /> Fecha Fin
                    </label>
                    <input
                        type="date"
                        name="end_date"
                        value={filters.end_date}
                        onChange={(e) => handleFilterChange('end_date', e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                </div>
            </ReportLayout>

            {/* Panel de Resumen Interactivo y Métricas (visible cuando hay datos) */}
            {reportData && (
                <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-6 bg-white rounded-[2rem] border border-slate-100 shadow-xl animate-in fade-in duration-500">
                    {/* Header con métricas generales */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
                        <div>
                            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                                <Layers size={22} className="text-indigo-600" />
                                Resumen Consolidado de Complementarias
                            </h2>
                            <p className="text-slate-500 text-xs font-medium mt-0.5">
                                Período del {filters.start_date} al {filters.end_date}
                            </p>
                        </div>
                    </div>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                            <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">Cant. DTEs</span>
                            <span className="text-lg font-black text-slate-900 mt-1 block">
                                {grandTotals?.dtes_count || 0}
                            </span>
                        </div>
                        <div className="p-3.5 bg-indigo-50/50 rounded-2xl border border-indigo-100/60">
                            <span className="text-[10px] font-bold text-indigo-600 uppercase block tracking-wider">Total Galones</span>
                            <span className="text-lg font-black text-indigo-900 mt-1 block">
                                {Number(grandTotals?.galones || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                            <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">Venta Gravada</span>
                            <span className="text-lg font-black text-slate-900 mt-1 block">
                                <Money value={grandTotals?.gravado || 0} />
                            </span>
                        </div>
                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                            <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">IVA (13%)</span>
                            <span className="text-lg font-black text-slate-900 mt-1 block">
                                <Money value={grandTotals?.iva || 0} />
                            </span>
                        </div>
                        <div className="p-3.5 bg-amber-50/50 rounded-2xl border border-amber-100/60">
                            <span className="text-[10px] font-bold text-amber-700 uppercase block tracking-wider">FOVIAL ($0.20)</span>
                            <span className="text-lg font-black text-amber-900 mt-1 block">
                                <Money value={grandTotals?.fovial || 0} />
                            </span>
                        </div>
                        <div className="p-3.5 bg-amber-50/50 rounded-2xl border border-amber-100/60">
                            <span className="text-[10px] font-bold text-amber-700 uppercase block tracking-wider">COTRANS ($0.10)</span>
                            <span className="text-lg font-black text-amber-900 mt-1 block">
                                <Money value={grandTotals?.cotrans || 0} />
                            </span>
                        </div>
                        <div className="p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-100">
                            <span className="text-[10px] font-bold text-emerald-700 uppercase block tracking-wider">Total Facturado</span>
                            <span className="text-lg font-black text-emerald-900 mt-1 block">
                                <Money value={grandTotals?.total || 0} />
                            </span>
                        </div>
                    </div>

                    {/* Resumen Consolidado por Combustible */}
                    {summaryByProduct.length > 0 && (
                        <div className="space-y-3 pt-2">
                            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                <Fuel size={14} className="text-indigo-600" />
                                Desglose Consolidado por Combustible
                            </h3>
                            <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                                <table className="w-full text-left border-collapse text-[13px]">
                                    <thead>
                                        <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                                            <th className="py-2.5 px-4">Combustible</th>
                                            <th className="py-2.5 px-4 text-right">Galones</th>
                                            <th className="py-2.5 px-4 text-right">Venta Gravada</th>
                                            <th className="py-2.5 px-4 text-right">Total Facturado</th>
                                            <th className="py-2.5 px-4 text-right">% Volumen</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                        {summaryByProduct.map((p, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="py-2.5 px-4 font-bold text-slate-800">{p.producto}</td>
                                                <td className="py-2.5 px-4 text-right">{Number(p.galones).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gln</td>
                                                <td className="py-2.5 px-4 text-right"><Money value={p.gravado} /></td>
                                                <td className="py-2.5 px-4 text-right font-bold text-slate-900"><Money value={p.total} /></td>
                                                <td className="py-2.5 px-4 text-right font-bold text-indigo-600">{p.porcentaje}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Tabla de Resumen Consolidado por Día */}
                    {summaryByDay.length > 0 && (
                        <div className="space-y-3 pt-2">
                            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                <Calendar size={14} className="text-indigo-600" />
                                Resumen Consolidado por Día
                            </h3>
                            <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                                <table className="w-full text-left border-collapse text-[13px]">
                                    <thead>
                                        <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                                            <th className="py-2.5 px-4">Fecha</th>
                                            <th className="py-2.5 px-4">Sucursal</th>
                                            <th className="py-2.5 px-4 text-center">Turnos</th>
                                            <th className="py-2.5 px-4 text-right">Cant. DTEs</th>
                                            <th className="py-2.5 px-4 text-right">Total Galones</th>
                                            <th className="py-2.5 px-4 text-right">Venta Gravada</th>
                                            <th className="py-2.5 px-4 text-right">IVA (13%)</th>
                                            <th className="py-2.5 px-4 text-right">FOVIAL</th>
                                            <th className="py-2.5 px-4 text-right">COTRANS</th>
                                            <th className="py-2.5 px-4 text-right">Total Facturado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                        {summaryByDay.map((d, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="py-2.5 px-4 font-bold text-slate-900">{d.fecha}</td>
                                                <td className="py-2.5 px-4 text-slate-700">{d.sucursal}</td>
                                                <td className="py-2.5 px-4 text-center text-xs font-semibold text-slate-600">
                                                    <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                                        {d.turnos}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-4 text-right font-medium">{d.totals.dtes_count}</td>
                                                <td className="py-2.5 px-4 text-right font-medium">
                                                    {Number(d.totals.galones).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gln
                                                </td>
                                                <td className="py-2.5 px-4 text-right"><Money value={d.totals.gravado} /></td>
                                                <td className="py-2.5 px-4 text-right"><Money value={d.totals.iva} /></td>
                                                <td className="py-2.5 px-4 text-right text-amber-700"><Money value={d.totals.fovial} /></td>
                                                <td className="py-2.5 px-4 text-right text-amber-700"><Money value={d.totals.cotrans} /></td>
                                                <td className="py-2.5 px-4 text-right font-bold text-slate-900"><Money value={d.totals.total} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-slate-100/90 font-bold text-[12px] text-slate-900 border-t-2 border-slate-300">
                                            <td className="py-3 px-4 font-black" colSpan={3}>TOTAL GENERAL ({grandTotals?.dtes_count || 0} DTEs):</td>
                                            <td className="py-3 px-4 text-right font-black">{grandTotals?.dtes_count || 0}</td>
                                            <td className="py-3 px-4 text-right font-black">
                                                {Number(grandTotals?.galones || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gln
                                            </td>
                                            <td className="py-3 px-4 text-right font-black"><Money value={grandTotals?.gravado || 0} /></td>
                                            <td className="py-3 px-4 text-right font-black"><Money value={grandTotals?.iva || 0} /></td>
                                            <td className="py-3 px-4 text-right font-black text-amber-800"><Money value={grandTotals?.fovial || 0} /></td>
                                            <td className="py-3 px-4 text-right font-black text-amber-800"><Money value={grandTotals?.cotrans || 0} /></td>
                                            <td className="py-3 px-4 text-right font-black text-emerald-800 text-sm"><Money value={grandTotals?.total || 0} /></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Tabla de Detalle por Día y Turno (con acordeón de DTEs) */}
                    <div className="space-y-3 pt-2">
                        <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                            <Receipt size={14} className="text-indigo-600" />
                            Detalle Agrupado por Día y Turno
                        </h3>

                        <div className="space-y-4">
                            {groupedByDay.map((day) => (
                                <div key={day.fecha} className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                                    {/* Cabecera del Día */}
                                    <div className="bg-slate-100/80 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200">
                                        <div className="flex items-center gap-2">
                                            <Calendar size={16} className="text-indigo-600" />
                                            <span className="font-black text-slate-900 text-sm">
                                                Fecha: {day.fecha}
                                            </span>
                                            <span className="text-xs font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                                                {day.shifts.length} {day.shifts.length === 1 ? 'Turno' : 'Turnos'}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-4 text-xs">
                                            <span className="text-slate-600">
                                                <strong>{day.totals.dtes_count}</strong> DTEs
                                            </span>
                                            <span className="text-slate-600">
                                                <strong>{Number(day.totals.galones).toFixed(2)}</strong> gln
                                            </span>
                                            <span className="font-bold text-slate-900">
                                                Total: <Money value={day.totals.total} />
                                            </span>
                                        </div>
                                    </div>

                                    {/* Tabla de turnos dentro del día */}
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse text-[13px]">
                                            <thead>
                                                <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                                                    <th className="py-2.5 px-4 w-10"></th>
                                                    <th className="py-2.5 px-4">Turno</th>
                                                    <th className="py-2.5 px-4">Sucursal</th>
                                                    <th className="py-2.5 px-4 text-right">Cant. DTEs</th>
                                                    <th className="py-2.5 px-4 text-right">Galones</th>
                                                    <th className="py-2.5 px-4 text-right">Gravado</th>
                                                    <th className="py-2.5 px-4 text-right">IVA</th>
                                                    <th className="py-2.5 px-4 text-right">FOVIAL</th>
                                                    <th className="py-2.5 px-4 text-right">COTRANS</th>
                                                    <th className="py-2.5 px-4 text-right">Total Facturado</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {day.shifts.map((shift) => {
                                                    const shiftKey = `${day.fecha}_${shift.turno}_${shift.branch_id}`;
                                                    const isExpanded = expandedShifts[shiftKey];

                                                    return (
                                                        <React.Fragment key={shiftKey}>
                                                            <tr className="hover:bg-slate-50/70 transition-colors">
                                                                <td className="py-2.5 px-2 text-center">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleShiftExpand(shiftKey)}
                                                                        className="p-1 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors cursor-pointer"
                                                                        title={isExpanded ? "Ocultar DTEs" : "Ver DTEs"}
                                                                    >
                                                                        {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                                                    </button>
                                                                </td>
                                                                <td className="py-2.5 px-4 font-bold text-slate-900">
                                                                    Turno {shift.turno}
                                                                </td>
                                                                <td className="py-2.5 px-4 text-slate-700">
                                                                    {shift.branch_name}
                                                                </td>
                                                                <td className="py-2.5 px-4 text-right font-medium">
                                                                    {shift.totals.dtes_count}
                                                                </td>
                                                                <td className="py-2.5 px-4 text-right font-medium">
                                                                    {Number(shift.totals.galones).toFixed(2)} gln
                                                                </td>
                                                                <td className="py-2.5 px-4 text-right">
                                                                    <Money value={shift.totals.gravado} />
                                                                </td>
                                                                <td className="py-2.5 px-4 text-right">
                                                                    <Money value={shift.totals.iva} />
                                                                </td>
                                                                <td className="py-2.5 px-4 text-right text-amber-700">
                                                                    <Money value={shift.totals.fovial} />
                                                                </td>
                                                                <td className="py-2.5 px-4 text-right text-amber-700">
                                                                    <Money value={shift.totals.cotrans} />
                                                                </td>
                                                                <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                                                                    <Money value={shift.totals.total} />
                                                                </td>
                                                            </tr>

                                                            {/* Acordeón de DTEs de este turno */}
                                                            {isExpanded && (
                                                                <tr>
                                                                    <td colSpan={10} className="bg-slate-50/90 p-4 border-b border-slate-200">
                                                                        <div className="space-y-3">
                                                                            <div className="flex items-center justify-between">
                                                                                <span className="text-[11px] font-black text-indigo-700 uppercase tracking-wider">
                                                                                    DTEs Emitidos en Turno {shift.turno} ({shift.dtes.length} comprobantes)
                                                                                </span>
                                                                            </div>
                                                                            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                                                                <table className="w-full text-left text-xs">
                                                                                    <thead>
                                                                                        <tr className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                                                                                            <th className="py-2 px-3">Hora</th>
                                                                                            <th className="py-2 px-3">N° Control</th>
                                                                                            <th className="py-2 px-3">Código Generación</th>
                                                                                            <th className="py-2 px-3">Combustible</th>
                                                                                            <th className="py-2 px-3 text-right">Galones</th>
                                                                                            <th className="py-2 px-3 text-right">Gravado</th>
                                                                                            <th className="py-2 px-3 text-right">IVA</th>
                                                                                            <th className="py-2 px-3 text-right">FOVIAL</th>
                                                                                            <th className="py-2 px-3 text-right">COTRANS</th>
                                                                                            <th className="py-2 px-3 text-right">Total Facturado</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="divide-y divide-slate-100">
                                                                                        {shift.dtes.map((dte) => (
                                                                                            <tr key={dte.id} className="hover:bg-indigo-50/30">
                                                                                                <td className="py-2 px-3 font-mono text-slate-500">{dte.hora_emision}</td>
                                                                                                <td className="py-2 px-3 font-mono font-bold text-slate-800">{dte.numero_control}</td>
                                                                                                <td className="py-2 px-3 font-mono text-[11px] text-slate-500">{dte.codigo_generacion}</td>
                                                                                                <td className="py-2 px-3 font-medium text-slate-700">
                                                                                                    {dte.items.map(it => `${it.producto}`).join(', ') || 'Combustible'}
                                                                                                </td>
                                                                                                <td className="py-2 px-3 text-right font-medium">
                                                                                                    {dte.items.reduce((acc, it) => acc + it.galones, 0).toFixed(2)} gln
                                                                                                </td>
                                                                                                <td className="py-2 px-3 text-right"><Money value={dte.total_gravado} /></td>
                                                                                                <td className="py-2 px-3 text-right"><Money value={dte.total_iva} /></td>
                                                                                                <td className="py-2 px-3 text-right text-amber-700"><Money value={dte.fovial} /></td>
                                                                                                <td className="py-2 px-3 text-right text-amber-700"><Money value={dte.cotrans} /></td>
                                                                                                <td className="py-2 px-3 text-right font-bold text-slate-900"><Money value={dte.total_pagar} /></td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GasComplementariasReport;
