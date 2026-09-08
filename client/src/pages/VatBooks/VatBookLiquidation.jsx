import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
    Calculator,
    Calendar,
    GitBranch,
    FileText,
    FileSpreadsheet,
    Loader2,
    TrendingUp,
    TrendingDown,
    Scale,
    Fuel,
    ShoppingBag,
    Info,
    RotateCcw,
    SlidersHorizontal,
    Coins,
    Receipt,
    AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import Money, { MoneyInput } from '../../components/ui/Money';

const MONTHS = [
    { value: '1', label: 'Enero' },
    { value: '2', label: 'Febrero' },
    { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Mayo' },
    { value: '6', label: 'Junio' },
    { value: '7', label: 'Julio' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' }
];

const VatBookLiquidation = () => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear().toString();
    const currentMonth = (currentDate.getMonth() + 1).toString();

    // Filtros principales
    const [year, setYear] = useState(currentYear);
    const [month, setMonth] = useState(currentMonth);
    const [branchId, setBranchId] = useState('all');

    // Parámetros modificables de la declaración
    const [remanenteAnterior, setRemanenteAnterior] = useState(0);
    const [retencionesRenta, setRetencionesRenta] = useState(0);
    const [overrideFuelRate, setOverrideFuelRate] = useState('');
    const [overrideGeneralRate, setOverrideGeneralRate] = useState('');

    // Estado de la UI
    const [activeTab, setActiveTab] = useState('resumen');
    const [showConfig, setShowConfig] = useState(false);
    const [isExporting, setIsExporting] = useState(null);

    // Consulta de sucursales
    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await axios.get('/api/branches')).data
    });

    // Consulta de datos de liquidación
    const queryParams = {
        year,
        month,
        branch_id: branchId,
        remanente_anterior: remanenteAnterior || 0,
        retenciones_renta_sufridas: retencionesRenta || 0,
        fuel_rate: overrideFuelRate !== '' ? overrideFuelRate : undefined,
        general_rate: overrideGeneralRate !== '' ? overrideGeneralRate : undefined
    };

    const { data: response, isLoading, isFetching, refetch } = useQuery({
        queryKey: ['vat-liquidation', year, month, branchId, remanenteAnterior, retencionesRenta, overrideFuelRate, overrideGeneralRate],
        queryFn: async () => (await axios.get('/api/vat-books/liquidation', { params: queryParams })).data,
        staleTime: 30 * 1000
    });

    const data = response?.data;

    // Resetear a valores por defecto legales
    const handleResetParams = () => {
        setRemanenteAnterior(0);
        setRetencionesRenta(0);
        setOverrideFuelRate('');
        setOverrideGeneralRate('');
        toast.info('Parámetros restablecidos a valores por defecto');
    };

    // Descarga de reportes
    const handleExport = async (type) => {
        setIsExporting(type);
        try {
            const endpoint = type === 'pdf' ? '/api/vat-books/liquidation/pdf' : '/api/vat-books/liquidation/excel';
            const mime = type === 'pdf' ? 'application/pdf' : 'spreadsheetml';
            const extension = type === 'pdf' ? 'pdf' : 'xlsx';
            const filename = `Liquidacion_IVA_F07_${year}_${month}.${extension}`;

            const res = await axios.get(endpoint, {
                params: queryParams,
                responseType: 'blob'
            });

            const contentType = res.headers['content-type'] || '';
            if (!contentType.includes(mime)) {
                const text = await res.data.text();
                console.error('Error al exportar:', text);
                toast.error('El servidor retornó una respuesta inesperada');
                return;
            }

            const blob = new Blob([res.data], { type: contentType });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            toast.success(type === 'pdf' ? 'Reporte PDF exportado correctamente' : 'Reporte Excel exportado correctamente');
        } catch (error) {
            console.error('Error al exportar:', error);
            if (error.response?.data instanceof Blob) {
                try {
                    const text = await error.response.data.text();
                    const json = JSON.parse(text);
                    toast.error(json.message || 'Error al exportar documento');
                } catch {
                    toast.error('Error al exportar documento');
                }
            } else {
                toast.error(error.response?.data?.message || 'Error al exportar documento');
            }
        } finally {
            setIsExporting(null);
        }
    };

    const labelCls = "text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1";
    const inputCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-[13px] font-medium shadow-sm";

    return (
        <div className="max-w-[1500px] mx-auto p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6 animate-in fade-in duration-500">
            {/* Cabecera Principal */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                    <div className="flex items-center gap-2.5">
                        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                            <Calculator size={24} className="stroke-[2.2]" />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                                Liquidación de IVA y Pago a Cuenta
                            </h1>
                            <p className="text-slate-500 font-medium text-xs mt-0.5">
                                Formulario F-07 | Débito Fiscal, Crédito Fiscal y Anticipo de Renta (Art. 151 Código Tributario)
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <button
                        onClick={() => setShowConfig(!showConfig)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold text-xs transition-all border ${
                            showConfig 
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-300' 
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                        title="Configurar remanentes y tasas"
                    >
                        <SlidersHorizontal size={15} />
                        <span className="hidden sm:inline">Ajustar Parámetros</span>
                    </button>

                    <button
                        onClick={() => handleExport('pdf')}
                        disabled={isExporting !== null || isLoading}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-md shadow-indigo-600/20 active:scale-95 disabled:opacity-50"
                    >
                        {isExporting === 'pdf' ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                        <span>Exportar PDF</span>
                    </button>

                    <button
                        onClick={() => handleExport('excel')}
                        disabled={isExporting !== null || isLoading}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-md shadow-emerald-600/20 active:scale-95 disabled:opacity-50"
                    >
                        {isExporting === 'excel' ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
                        <span>Exportar Excel</span>
                    </button>
                </div>
            </div>

            {/* Barra de Filtros y Período */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    <div>
                        <label className={labelCls}>Año Fiscal</label>
                        <div className="relative">
                            <select
                                value={year}
                                onChange={(e) => setYear(e.target.value)}
                                className={inputCls}
                            >
                                {[2024, 2025, 2026, 2027].map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                            <Calendar size={16} className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    <div>
                        <label className={labelCls}>Mes del Período</label>
                        <div className="relative">
                            <select
                                value={month}
                                onChange={(e) => setMonth(e.target.value)}
                                className={inputCls}
                            >
                                {MONTHS.map((m) => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                            <Calendar size={16} className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    <div>
                        <label className={labelCls}>Sucursal</label>
                        <div className="relative">
                            <select
                                value={branchId}
                                onChange={(e) => setBranchId(e.target.value)}
                                className={inputCls}
                            >
                                <option value="all">Todas las Sucursales (Consolidado)</option>
                                {branches.map((b) => (
                                    <option key={b.id} value={b.id}>{b.nombre}</option>
                                ))}
                            </select>
                            <GitBranch size={16} className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    <div className="flex items-end">
                        <button
                            onClick={() => refetch()}
                            disabled={isFetching}
                            className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95 disabled:opacity-50"
                        >
                            <RotateCcw size={14} className={isFetching ? 'animate-spin' : ''} />
                            <span>Actualizar Datos</span>
                        </button>
                    </div>
                </div>

                {/* Panel Colapsible de Parámetros y Tasas */}
                {showConfig && (
                    <div className="mt-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                                    Parámetros Tributarios y Acreditaciones
                                </span>
                                <span className="text-[10px] bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-full">
                                    {data?.meta?.isPersonaNatural ? 'Persona Natural' : 'Persona Jurídica'}
                                </span>
                            </div>
                            <button
                                onClick={handleResetParams}
                                className="text-[11px] font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
                            >
                                Restablecer valores estándar
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                            <div>
                                <label className={labelCls}>Remanente Crédito Mes Anterior</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-slate-400 text-xs font-medium">$</span>
                                    <MoneyInput
                                        value={remanenteAnterior}
                                        onChange={(e) => setRemanenteAnterior(parseFloat(e.target.value) || 0)}
                                        className={`${inputCls} pl-7`}
                                        placeholder="0.00"
                                    />
                                </div>
                                <span className="text-[10px] text-slate-400 mt-1 block">Acreditable al Impuesto Determinado</span>
                            </div>

                            <div>
                                <label className={labelCls}>Retenciones Renta Sufridas en Mes</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-slate-400 text-xs font-medium">$</span>
                                    <MoneyInput
                                        value={retencionesRenta}
                                        onChange={(e) => setRetencionesRenta(parseFloat(e.target.value) || 0)}
                                        className={`${inputCls} pl-7`}
                                        placeholder="0.00"
                                    />
                                </div>
                                <span className="text-[10px] text-slate-400 mt-1 block">Deducible del Pago a Cuenta</span>
                            </div>

                            <div>
                                <label className={labelCls}>Tasa Pago Cuenta Combustibles (%)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="10"
                                    value={overrideFuelRate !== '' ? overrideFuelRate : (data?.meta?.fuelRate ?? (data?.meta?.isPersonaNatural ? '0.00' : '0.75'))}
                                    onChange={(e) => setOverrideFuelRate(e.target.value)}
                                    className={inputCls}
                                    placeholder={data?.meta?.isPersonaNatural ? '0.00' : '0.75'}
                                />
                                <span className="text-[10px] text-slate-400 mt-1 block">
                                    Legal: {data?.meta?.isPersonaNatural ? '0.00% (PN Exenta)' : '0.75% (PJ Especial)'}
                                </span>
                            </div>

                            <div>
                                <label className={labelCls}>Tasa Pago Cuenta General (%)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="10"
                                    value={overrideGeneralRate !== '' ? overrideGeneralRate : (data?.meta?.generalRate ?? '1.75')}
                                    onChange={(e) => setOverrideGeneralRate(e.target.value)}
                                    className={inputCls}
                                    placeholder="1.75"
                                />
                                <span className="text-[10px] text-slate-400 mt-1 block">Legal: 1.75% (Art. 151 CT)</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Tarjetas KPI de Resumen */}
            {isLoading ? (
                <div className="p-12 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200 shadow-sm text-slate-400">
                    <Loader2 size={32} className="animate-spin text-indigo-600 mb-2" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Calculando liquidación del período...</span>
                </div>
            ) : data ? (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
                        {/* 1. Débito Fiscal */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-indigo-200 transition-all">
                            <div className="flex items-center justify-between text-indigo-600 mb-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Débito Fiscal Neto</span>
                                <div className="p-1.5 bg-indigo-50 rounded-lg">
                                    <TrendingUp size={16} />
                                </div>
                            </div>
                            <div className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                                <Money value={data.debito_fiscal.totales.neto} />
                            </div>
                            <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
                                <span>Bruto: <Money value={data.debito_fiscal.totales.bruto} /></span>
                                <span className="text-rose-600 font-semibold">NC: <Money value={data.debito_fiscal.totales.nc} /></span>
                            </div>
                        </div>

                        {/* 2. Crédito Fiscal */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-emerald-200 transition-all">
                            <div className="flex items-center justify-between text-emerald-600 mb-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Crédito Fiscal Neto</span>
                                <div className="p-1.5 bg-emerald-50 rounded-lg">
                                    <TrendingDown size={16} />
                                </div>
                            </div>
                            <div className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                                <Money value={data.credito_fiscal.totales.neto} />
                            </div>
                            <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
                                <span>Bruto: <Money value={data.credito_fiscal.totales.bruto} /></span>
                                <span className="text-rose-600 font-semibold">NC: <Money value={data.credito_fiscal.totales.nc} /></span>
                            </div>
                        </div>

                        {/* 3. Impuesto Determinado / Remanente */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-amber-200 transition-all">
                            <div className="flex items-center justify-between text-amber-600 mb-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    {data.liquidacion_iva.impuesto_determinado > 0 ? 'Impuesto IVA Determinado' : 'Remanente de Crédito Mes'}
                                </span>
                                <div className="p-1.5 bg-amber-50 rounded-lg">
                                    <Scale size={16} />
                                </div>
                            </div>
                            <div className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                                {data.liquidacion_iva.impuesto_determinado > 0 ? (
                                    <Money value={data.liquidacion_iva.impuesto_determinado} />
                                ) : (
                                    <span className="text-emerald-700">
                                        <Money value={data.liquidacion_iva.remanente_credito_mes} />
                                    </span>
                                )}
                            </div>
                            <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
                                <span>Acreditable: <Money value={data.liquidacion_iva.total_acreditaciones} /></span>
                                <span className="font-semibold text-indigo-600">A pagar: <Money value={data.liquidacion_iva.total_iva_a_enterar} /></span>
                            </div>
                        </div>

                        {/* 4. Pago a Cuenta */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-purple-200 transition-all">
                            <div className="flex items-center justify-between text-purple-600 mb-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Pago a Cuenta (Renta)</span>
                                <div className="p-1.5 bg-purple-50 rounded-lg">
                                    <Coins size={16} />
                                </div>
                            </div>
                            <div className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                                <Money value={data.pago_cuenta.totales.pago_cuenta_a_pagar} />
                            </div>
                            <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
                                <span>Comb: <Money value={data.pago_cuenta.combustibles.cuota_calculada} /></span>
                                <span>Otros: <Money value={data.pago_cuenta.otros.cuota_calculada} /></span>
                            </div>
                        </div>

                        {/* 5. Total Consolidado F-07 */}
                        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4 rounded-2xl text-white shadow-lg shadow-indigo-950/20 relative overflow-hidden sm:col-span-2 lg:col-span-1">
                            <div className="flex items-center justify-between text-sky-400 mb-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Total Mandamiento F-07</span>
                                <div className="p-1.5 bg-white/10 rounded-lg backdrop-blur-sm">
                                    <Receipt size={16} />
                                </div>
                            </div>
                            <div className="text-xl md:text-2xl font-black text-white tracking-tight">
                                <Money value={data.resumen_f07.total_f07} />
                            </div>
                            <div className="mt-2 text-[11px] text-slate-300 flex items-center justify-between border-t border-white/10 pt-2">
                                <span>IVA: <Money value={data.resumen_f07.total_iva_a_enterar} /></span>
                                <span>Renta: <Money value={data.resumen_f07.pago_cuenta_a_pagar} /></span>
                            </div>
                        </div>
                    </div>

                    {/* Banner Informativo Legal Art. 151 */}
                    <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5 flex items-start gap-3 text-amber-900 text-xs">
                        <Info size={18} className="text-amber-600 mt-0.5 shrink-0" />
                        <div className="space-y-1">
                            <div className="font-bold text-amber-950 flex items-center gap-2">
                                <span>Régimen Especial de Pago a Cuenta de Combustibles (Art. 151 Código Tributario)</span>
                                <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.2 rounded-full font-bold">
                                    {data.meta.isPersonaNatural ? 'Persona Natural: 0.00% Exenta' : 'Persona Jurídica: 0.75%'}
                                </span>
                            </div>
                            <p className="text-amber-800 leading-relaxed text-[11px]">
                                Para personas jurídicas comercializadoras de gasolina y diésel, la tasa mensual de anticipo es del <strong>0.75%</strong> sobre los ingresos brutos de combustibles.
                                En caso de personas naturales titulares de empresas mercantiles, la venta de gasolina y diésel se encuentra <strong>exenta</strong> del anticipo mensual (0.00%).
                                Los demás productos (lubricantes, aditivos, tienda, repuestos o servicios) aplican la tasa general del <strong>1.75%</strong>.
                            </p>
                        </div>
                    </div>

                    {/* Navegación por Pestañas */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="flex overflow-x-auto border-b border-slate-200 scrollbar-none">
                            {[
                                { id: 'resumen', label: 'Resumen Consolidado F-07', icon: Receipt },
                                { id: 'debito', label: 'Detalle Débito Fiscal (Ventas)', icon: TrendingUp },
                                { id: 'credito', label: 'Detalle Crédito Fiscal (Compras)', icon: TrendingDown },
                                { id: 'pago_cuenta', label: 'Cálculo Pago a Cuenta (Art. 151 CT)', icon: Fuel }
                            ].map((tab) => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold whitespace-nowrap transition-all border-b-2 ${
                                            isActive
                                                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                                                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                                        }`}
                                    >
                                        <Icon size={16} className={isActive ? 'text-indigo-600' : 'text-slate-400'} />
                                        <span>{tab.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="p-4 md:p-6">
                            {/* PESTAÑA 1: RESUMEN CONSOLIDADO F-07 */}
                            {activeTab === 'resumen' && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {/* Bloque Liquidación de IVA */}
                                        <div className="bg-slate-50/70 rounded-2xl p-4 md:p-5 border border-slate-200 space-y-4">
                                            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                                    <Scale size={18} className="text-indigo-600" />
                                                    Liquidación Mensual de IVA
                                                </h3>
                                                <span className="text-[11px] font-semibold text-slate-500">Tasa 13%</span>
                                            </div>

                                            <div className="space-y-2.5 text-xs">
                                                <div className="flex justify-between items-center py-1">
                                                    <span className="text-slate-600 font-medium">Débito Fiscal Neto (Ventas):</span>
                                                    <span className="font-bold text-slate-900"><Money value={data.liquidacion_iva.debito_fiscal_neto} /></span>
                                                </div>
                                                <div className="flex justify-between items-center py-1 text-slate-600">
                                                    <span className="font-medium">(-) Crédito Fiscal Neto (Compras):</span>
                                                    <span className="font-bold text-rose-600">- <Money value={data.liquidacion_iva.credito_fiscal_neto} /></span>
                                                </div>

                                                <div className="h-px bg-slate-200 my-1" />

                                                <div className="flex justify-between items-center py-1 bg-white p-2.5 rounded-xl border border-slate-200">
                                                    <span className="font-bold text-slate-800">
                                                        {data.liquidacion_iva.impuesto_determinado > 0 ? 'Impuesto IVA Determinado:' : 'Remanente de Crédito del Mes:'}
                                                    </span>
                                                    <span className={`font-black text-sm ${data.liquidacion_iva.impuesto_determinado > 0 ? 'text-indigo-600' : 'text-emerald-700'}`}>
                                                        <Money value={data.liquidacion_iva.impuesto_determinado > 0 ? data.liquidacion_iva.impuesto_determinado : data.liquidacion_iva.remanente_credito_mes} />
                                                    </span>
                                                </div>

                                                <div className="space-y-1.5 pt-1">
                                                    <div className="flex justify-between items-center text-slate-500 pl-2">
                                                        <span>(-) Remanente de Crédito Mes Anterior:</span>
                                                        <span className="font-semibold">- <Money value={data.liquidacion_iva.remanente_anterior} /></span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-slate-500 pl-2">
                                                        <span>(-) Retenciones IVA 1% Sufridas:</span>
                                                        <span className="font-semibold">- <Money value={data.liquidacion_iva.retenciones_iva_sufridas} /></span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-slate-500 pl-2">
                                                        <span>(-) Percepciones IVA 1% Soportadas:</span>
                                                        <span className="font-semibold">- <Money value={data.liquidacion_iva.percepciones_iva_soportadas} /></span>
                                                    </div>
                                                </div>

                                                <div className="h-px bg-slate-200 my-1" />

                                                <div className="flex justify-between items-center py-1">
                                                    <span className="font-bold text-slate-700">IVA por Operaciones Propias:</span>
                                                    <span className="font-bold text-slate-900"><Money value={data.liquidacion_iva.iva_pagar_operaciones} /></span>
                                                </div>
                                                <div className="flex justify-between items-center py-1 text-slate-600">
                                                    <span className="font-medium">(+) Retención 13% Sujetos Excluidos a Enterar:</span>
                                                    <span className="font-bold text-indigo-700">+ <Money value={data.liquidacion_iva.retenciones_sujetos_excluidos} /></span>
                                                </div>

                                                <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-900 font-bold mt-2">
                                                    <span>TOTAL IVA A PAGAR (F-07):</span>
                                                    <span className="text-base font-black text-indigo-700"><Money value={data.liquidacion_iva.total_iva_a_enterar} /></span>
                                                </div>

                                                {data.liquidacion_iva.nuevo_remanente_credito > 0 && (
                                                    <div className="flex justify-between items-center p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-[11px] font-semibold">
                                                        <span>Nuevo Remanente a Favor para el Próximo Mes:</span>
                                                        <span className="text-sm font-bold"><Money value={data.liquidacion_iva.nuevo_remanente_credito} /></span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Bloque Pago a Cuenta (Renta) */}
                                        <div className="bg-slate-50/70 rounded-2xl p-4 md:p-5 border border-slate-200 space-y-4">
                                            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                                    <Coins size={18} className="text-purple-600" />
                                                    Pago a Cuenta del Impuesto sobre la Renta
                                                </h3>
                                                <span className="text-[11px] font-semibold text-slate-500">Art. 151 CT</span>
                                            </div>

                                            <div className="space-y-2.5 text-xs">
                                                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                                            <Fuel size={14} className="text-amber-500" />
                                                            <span>Venta de Combustibles ({data.pago_cuenta.combustibles.tasa.toFixed(2)}%):</span>
                                                        </div>
                                                        <span className="font-black text-slate-900"><Money value={data.pago_cuenta.combustibles.cuota_calculada} /></span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 flex justify-between">
                                                        <span>Ingreso Base Computable:</span>
                                                        <span className="font-semibold"><Money value={data.pago_cuenta.combustibles.ingreso_bruto_neto} /></span>
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 block italic">
                                                        {data.pago_cuenta.combustibles.nota}
                                                    </span>
                                                </div>

                                                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                                            <ShoppingBag size={14} className="text-indigo-500" />
                                                            <span>Otros Rubros / General ({data.pago_cuenta.otros.tasa.toFixed(2)}%):</span>
                                                        </div>
                                                        <span className="font-black text-slate-900"><Money value={data.pago_cuenta.otros.cuota_calculada} /></span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 flex justify-between">
                                                        <span>Ingreso Base Computable:</span>
                                                        <span className="font-semibold"><Money value={data.pago_cuenta.otros.ingreso_bruto_neto} /></span>
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 block italic">
                                                        {data.pago_cuenta.otros.nota}
                                                    </span>
                                                </div>

                                                <div className="h-px bg-slate-200 my-1" />

                                                <div className="flex justify-between items-center py-1">
                                                    <span className="font-bold text-slate-700">Subtotal Pago a Cuenta Determinado:</span>
                                                    <span className="font-bold text-slate-900"><Money value={data.pago_cuenta.totales.subtotal_pago_cuenta} /></span>
                                                </div>

                                                <div className="flex justify-between items-center py-1 text-slate-500 pl-2">
                                                    <span>(-) Retenciones de Renta Sufridas:</span>
                                                    <span className="font-semibold text-rose-600">- <Money value={data.pago_cuenta.totales.retenciones_renta_sufridas} /></span>
                                                </div>

                                                <div className="flex justify-between items-center p-3 bg-purple-50 rounded-xl border border-purple-100 text-purple-900 font-bold mt-2">
                                                    <span>TOTAL PAGO A CUENTA A PAGAR:</span>
                                                    <span className="text-base font-black text-purple-700"><Money value={data.pago_cuenta.totales.pago_cuenta_a_pagar} /></span>
                                                </div>

                                                {data.pago_cuenta.totales.remanente_pago_cuenta > 0 && (
                                                    <div className="flex justify-between items-center p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-[11px] font-semibold">
                                                        <span>Remanente de Renta Retenida a Favor:</span>
                                                        <span className="text-sm font-bold"><Money value={data.pago_cuenta.totales.remanente_pago_cuenta} /></span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Gran Total F-07 */}
                                    <div className="p-5 md:p-6 bg-slate-900 text-white rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
                                        <div className="space-y-1 text-center md:text-left">
                                            <span className="text-[11px] font-bold text-sky-400 uppercase tracking-widest">
                                                Ministerio de Hacienda de El Salvador
                                            </span>
                                            <h4 className="text-lg md:text-xl font-black tracking-tight">
                                                Total Mandamiento de Pago F-07 Consolidado
                                            </h4>
                                            <p className="text-xs text-slate-400">
                                                Suma de IVA a enterar (${(data.resumen_f07.total_iva_a_enterar || 0).toFixed(2)}) + Anticipo Pago a Cuenta (${(data.resumen_f07.pago_cuenta_a_pagar || 0).toFixed(2)})
                                            </p>
                                        </div>
                                        <div className="text-center md:text-right">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                                                Monto Total a Enterar
                                            </span>
                                            <span className="text-3xl md:text-4xl font-black text-sky-400 tracking-tight">
                                                <Money value={data.resumen_f07.total_f07} />
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* PESTAÑA 2: DETALLE DÉBITO FISCAL (VENTAS) */}
                            {activeTab === 'debito' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                                            Ventas por Tipo de Documento Tributario
                                        </h3>
                                        <span className="text-xs text-slate-500 font-medium">Solo DTEs válidos y no anulados</span>
                                    </div>

                                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                                    <th className="p-3">Tipo de Documento</th>
                                                    <th className="p-3 text-center">Docs</th>
                                                    <th className="p-3 text-right">Gravadas</th>
                                                    <th className="p-3 text-right">Exentas</th>
                                                    <th className="p-3 text-right">No Sujetas</th>
                                                    <th className="p-3 text-right">IVA Débito (13%)</th>
                                                    <th className="p-3 text-right">Retención 1%</th>
                                                    <th className="p-3 text-right">Total Facturado</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                                <tr className="hover:bg-slate-50/60">
                                                    <td className="p-3 font-semibold text-slate-900">Comprobante de Crédito Fiscal (03)</td>
                                                    <td className="p-3 text-center font-bold text-slate-500">{data.debito_fiscal.ccf.count}</td>
                                                    <td className="p-3 text-right"><Money value={data.debito_fiscal.ccf.gravado} /></td>
                                                    <td className="p-3 text-right"><Money value={data.debito_fiscal.ccf.exento} /></td>
                                                    <td className="p-3 text-right"><Money value={data.debito_fiscal.ccf.nosujeta} /></td>
                                                    <td className="p-3 text-right font-bold text-indigo-600"><Money value={data.debito_fiscal.ccf.iva} /></td>
                                                    <td className="p-3 text-right"><Money value={data.debito_fiscal.ccf.retenido} /></td>
                                                    <td className="p-3 text-right font-bold"><Money value={data.debito_fiscal.ccf.total} /></td>
                                                </tr>
                                                <tr className="hover:bg-slate-50/60">
                                                    <td className="p-3 font-semibold text-slate-900">Factura a Consumidor Final (01)</td>
                                                    <td className="p-3 text-center font-bold text-slate-500">{data.debito_fiscal.fcf.count}</td>
                                                    <td className="p-3 text-right"><Money value={data.debito_fiscal.fcf.gravado} /></td>
                                                    <td className="p-3 text-right"><Money value={data.debito_fiscal.fcf.exento} /></td>
                                                    <td className="p-3 text-right"><Money value={data.debito_fiscal.fcf.nosujeta} /></td>
                                                    <td className="p-3 text-right font-bold text-indigo-600"><Money value={data.debito_fiscal.fcf.iva} /></td>
                                                    <td className="p-3 text-right"><Money value={data.debito_fiscal.fcf.retenido} /></td>
                                                    <td className="p-3 text-right font-bold"><Money value={data.debito_fiscal.fcf.total} /></td>
                                                </tr>
                                                {data.debito_fiscal.otros.count > 0 && (
                                                    <tr className="hover:bg-slate-50/60">
                                                        <td className="p-3 font-semibold text-slate-900">Otros Documentos (11, etc.)</td>
                                                        <td className="p-3 text-center font-bold text-slate-500">{data.debito_fiscal.otros.count}</td>
                                                        <td className="p-3 text-right"><Money value={data.debito_fiscal.otros.gravado} /></td>
                                                        <td className="p-3 text-right"><Money value={data.debito_fiscal.otros.exento} /></td>
                                                        <td className="p-3 text-right"><Money value={data.debito_fiscal.otros.nosujeta} /></td>
                                                        <td className="p-3 text-right font-bold text-indigo-600"><Money value={data.debito_fiscal.otros.iva} /></td>
                                                        <td className="p-3 text-right"><Money value={data.debito_fiscal.otros.retenido} /></td>
                                                        <td className="p-3 text-right font-bold"><Money value={data.debito_fiscal.otros.total} /></td>
                                                    </tr>
                                                )}
                                                <tr className="bg-rose-50/50 hover:bg-rose-50/70 text-rose-900">
                                                    <td className="p-3 font-bold text-rose-800">(-) Notas de Crédito emitidas (05)</td>
                                                    <td className="p-3 text-center font-bold text-rose-700">{data.debito_fiscal.nc.count}</td>
                                                    <td className="p-3 text-right font-semibold">- <Money value={data.debito_fiscal.nc.gravado} /></td>
                                                    <td className="p-3 text-right font-semibold">- <Money value={data.debito_fiscal.nc.exento} /></td>
                                                    <td className="p-3 text-right font-semibold">- <Money value={data.debito_fiscal.nc.nosujeta} /></td>
                                                    <td className="p-3 text-right font-black text-rose-700">- <Money value={data.debito_fiscal.nc.iva} /></td>
                                                    <td className="p-3 text-right font-semibold">- <Money value={data.debito_fiscal.nc.retenido} /></td>
                                                    <td className="p-3 text-right font-bold text-rose-800">- <Money value={data.debito_fiscal.nc.total} /></td>
                                                </tr>
                                            </tbody>
                                            <tfoot>
                                                <tr className="bg-slate-100/90 font-black text-slate-900 border-t-2 border-slate-300">
                                                    <td className="p-3 uppercase">TOTALES NETOS DÉBITO FISCAL:</td>
                                                    <td className="p-3 text-center text-slate-600">
                                                        {data.debito_fiscal.ccf.count + data.debito_fiscal.fcf.count + data.debito_fiscal.otros.count + data.debito_fiscal.nc.count}
                                                    </td>
                                                    <td className="p-3 text-right text-slate-900"><Money value={data.debito_fiscal.totales.ventas_gravadas_netas} /></td>
                                                    <td className="p-3 text-right text-slate-900"><Money value={data.debito_fiscal.totales.ventas_exentas_netas} /></td>
                                                    <td className="p-3 text-right text-slate-900"><Money value={data.debito_fiscal.totales.ventas_nosujetas_netas} /></td>
                                                    <td className="p-3 text-right text-indigo-700 text-sm"><Money value={data.debito_fiscal.totales.neto} /></td>
                                                    <td className="p-3 text-right text-slate-900"><Money value={data.debito_fiscal.totales.retenciones_sufridas_1pct} /></td>
                                                    <td className="p-3 text-right text-slate-900">---</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* PESTAÑA 3: DETALLE CRÉDITO FISCAL (COMPRAS) */}
                            {activeTab === 'credito' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                                            Compras del Período por Tipo de Documento
                                        </h3>
                                        <span className="text-xs text-slate-500 font-medium">Libro de Compras de IVA</span>
                                    </div>

                                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                                    <th className="p-3">Tipo de Documento</th>
                                                    <th className="p-3 text-center">Docs</th>
                                                    <th className="p-3 text-right">Gravadas</th>
                                                    <th className="p-3 text-right">Exentas</th>
                                                    <th className="p-3 text-right">No Sujetas</th>
                                                    <th className="p-3 text-right">IVA Crédito (13%)</th>
                                                    <th className="p-3 text-right">Percepción 1%</th>
                                                    <th className="p-3 text-right">Total Compras</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                                <tr className="hover:bg-slate-50/60">
                                                    <td className="p-3 font-semibold text-slate-900">Comprobante de Crédito Fiscal (03)</td>
                                                    <td className="p-3 text-center font-bold text-slate-500">{data.credito_fiscal.ccf.count}</td>
                                                    <td className="p-3 text-right"><Money value={data.credito_fiscal.ccf.gravado} /></td>
                                                    <td className="p-3 text-right"><Money value={data.credito_fiscal.ccf.exento} /></td>
                                                    <td className="p-3 text-right"><Money value={data.credito_fiscal.ccf.nosujeta} /></td>
                                                    <td className="p-3 text-right font-bold text-emerald-600"><Money value={data.credito_fiscal.ccf.iva} /></td>
                                                    <td className="p-3 text-right"><Money value={data.credito_fiscal.ccf.percepcion} /></td>
                                                    <td className="p-3 text-right font-bold"><Money value={data.credito_fiscal.ccf.total} /></td>
                                                </tr>
                                                {data.credito_fiscal.sujetos_excluidos.count > 0 && (
                                                    <tr className="hover:bg-slate-50/60">
                                                        <td className="p-3 font-semibold text-slate-900">
                                                            Factura Sujetos Excluidos (14)
                                                            <span className="text-[10px] text-indigo-600 block">Retención 13% IVA</span>
                                                        </td>
                                                        <td className="p-3 text-center font-bold text-slate-500">{data.credito_fiscal.sujetos_excluidos.count}</td>
                                                        <td className="p-3 text-right"><Money value={data.credito_fiscal.sujetos_excluidos.gravado} /></td>
                                                        <td className="p-3 text-right"><Money value={data.credito_fiscal.sujetos_excluidos.exento} /></td>
                                                        <td className="p-3 text-right"><Money value={data.credito_fiscal.sujetos_excluidos.nosujeta} /></td>
                                                        <td className="p-3 text-right font-bold text-indigo-600"><Money value={data.credito_fiscal.sujetos_excluidos.retencion} /></td>
                                                        <td className="p-3 text-right"><Money value={data.credito_fiscal.sujetos_excluidos.percepcion} /></td>
                                                        <td className="p-3 text-right font-bold"><Money value={data.credito_fiscal.sujetos_excluidos.total} /></td>
                                                    </tr>
                                                )}
                                                {data.credito_fiscal.otros.count > 0 && (
                                                    <tr className="hover:bg-slate-50/60">
                                                        <td className="p-3 font-semibold text-slate-900">Otras Compras y Servicios</td>
                                                        <td className="p-3 text-center font-bold text-slate-500">{data.credito_fiscal.otros.count}</td>
                                                        <td className="p-3 text-right"><Money value={data.credito_fiscal.otros.gravado} /></td>
                                                        <td className="p-3 text-right"><Money value={data.credito_fiscal.otros.exento} /></td>
                                                        <td className="p-3 text-right"><Money value={data.credito_fiscal.otros.nosujeta} /></td>
                                                        <td className="p-3 text-right font-bold text-emerald-600"><Money value={data.credito_fiscal.otros.iva} /></td>
                                                        <td className="p-3 text-right"><Money value={data.credito_fiscal.otros.percepcion} /></td>
                                                        <td className="p-3 text-right font-bold"><Money value={data.credito_fiscal.otros.total} /></td>
                                                    </tr>
                                                )}
                                                {data.credito_fiscal.nc.count > 0 && (
                                                    <tr className="bg-rose-50/50 hover:bg-rose-50/70 text-rose-900">
                                                        <td className="p-3 font-bold text-rose-800">(-) Notas de Crédito de compras (05/06)</td>
                                                        <td className="p-3 text-center font-bold text-rose-700">{data.credito_fiscal.nc.count}</td>
                                                        <td className="p-3 text-right font-semibold">- <Money value={data.credito_fiscal.nc.gravado} /></td>
                                                        <td className="p-3 text-right font-semibold">- <Money value={data.credito_fiscal.nc.exento} /></td>
                                                        <td className="p-3 text-right font-semibold">- <Money value={data.credito_fiscal.nc.nosujeta} /></td>
                                                        <td className="p-3 text-right font-black text-rose-700">- <Money value={data.credito_fiscal.nc.iva} /></td>
                                                        <td className="p-3 text-right font-semibold">- <Money value={data.credito_fiscal.nc.percepcion} /></td>
                                                        <td className="p-3 text-right font-bold text-rose-800">- <Money value={data.credito_fiscal.nc.total} /></td>
                                                    </tr>
                                                )}
                                            </tbody>
                                            <tfoot>
                                                <tr className="bg-slate-100/90 font-black text-slate-900 border-t-2 border-slate-300">
                                                    <td className="p-3 uppercase">TOTALES NETOS CRÉDITO FISCAL:</td>
                                                    <td className="p-3 text-center text-slate-600">
                                                        {data.credito_fiscal.ccf.count + data.credito_fiscal.sujetos_excluidos.count + data.credito_fiscal.otros.count + data.credito_fiscal.nc.count}
                                                    </td>
                                                    <td className="p-3 text-right text-slate-900"><Money value={data.credito_fiscal.totales.compras_gravadas_netas} /></td>
                                                    <td className="p-3 text-right text-slate-900"><Money value={data.credito_fiscal.totales.compras_exentas_netas} /></td>
                                                    <td className="p-3 text-right text-slate-900"><Money value={data.credito_fiscal.totales.compras_nosujetas_netas} /></td>
                                                    <td className="p-3 text-right text-emerald-700 text-sm"><Money value={data.credito_fiscal.totales.neto} /></td>
                                                    <td className="p-3 text-right text-slate-900"><Money value={data.credito_fiscal.totales.percepciones_soportadas_1pct} /></td>
                                                    <td className="p-3 text-right text-slate-900">---</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* PESTAÑA 4: CÁLCULO DETALLADO PAGO A CUENTA */}
                            {activeTab === 'pago_cuenta' && (
                                <div className="space-y-5">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                                            Segregación de Ingresos y Cálculo de Anticipo (Art. 151 CT)
                                        </h3>
                                        <span className="text-xs text-slate-500 font-medium">Cálculo de Ingresos Brutos Netos</span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                        {/* Tarjeta Combustibles */}
                                        <div className="bg-white p-5 rounded-2xl border-2 border-amber-200/70 shadow-sm space-y-4 relative overflow-hidden">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                                                        <Fuel size={20} />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-900 text-sm">Gasolina y Diésel</h4>
                                                        <span className="text-[10px] text-slate-500 uppercase font-semibold">
                                                            {data.pago_cuenta.combustibles.nota}
                                                        </span>
                                                    </div>
                                                </div>
                                                <span className="bg-amber-100 text-amber-900 font-black text-xs px-2.5 py-1 rounded-lg">
                                                    {data.pago_cuenta.combustibles.tasa.toFixed(2)}%
                                                </span>
                                            </div>

                                            <div className="space-y-2 text-xs border-t border-slate-100 pt-3">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-600">Ingresos Brutos Netos (Gravados + Exentos):</span>
                                                    <span className="font-bold text-slate-900"><Money value={data.pago_cuenta.combustibles.ingreso_bruto_neto} /></span>
                                                </div>
                                                <div className="flex justify-between items-center text-slate-500 text-[11px]">
                                                    <span>Tasa Aplicable:</span>
                                                    <span className="font-semibold">{data.pago_cuenta.combustibles.tasa.toFixed(2)}%</span>
                                                </div>
                                                <div className="flex justify-between items-center p-3 bg-amber-50/60 rounded-xl border border-amber-100 font-bold text-amber-950 mt-2">
                                                    <span>Cuota Anticipo Combustibles:</span>
                                                    <span className="text-base font-black text-amber-700">
                                                        <Money value={data.pago_cuenta.combustibles.cuota_calculada} />
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Tarjeta Otros Rubros */}
                                        <div className="bg-white p-5 rounded-2xl border-2 border-indigo-200/70 shadow-sm space-y-4 relative overflow-hidden">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                                                        <ShoppingBag size={20} />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-900 text-sm">Otros Productos y Servicios</h4>
                                                        <span className="text-[10px] text-slate-500 uppercase font-semibold">
                                                            Lubricantes, Tienda, Aditivos, Pista
                                                        </span>
                                                    </div>
                                                </div>
                                                <span className="bg-indigo-100 text-indigo-900 font-black text-xs px-2.5 py-1 rounded-lg">
                                                    {data.pago_cuenta.otros.tasa.toFixed(2)}%
                                                </span>
                                            </div>

                                            <div className="space-y-2 text-xs border-t border-slate-100 pt-3">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-600">Ingresos Brutos Netos (Gravados + Exentos):</span>
                                                    <span className="font-bold text-slate-900"><Money value={data.pago_cuenta.otros.ingreso_bruto_neto} /></span>
                                                </div>
                                                <div className="flex justify-between items-center text-slate-500 text-[11px]">
                                                    <span>Tasa General Aplicable:</span>
                                                    <span className="font-semibold">{data.pago_cuenta.otros.tasa.toFixed(2)}%</span>
                                                </div>
                                                <div className="flex justify-between items-center p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 font-bold text-indigo-950 mt-2">
                                                    <span>Cuota Anticipo Otros Rubros:</span>
                                                    <span className="text-base font-black text-indigo-700">
                                                        <Money value={data.pago_cuenta.otros.cuota_calculada} />
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Liquidación Final de Pago a Cuenta */}
                                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
                                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                                            Liquidación Final del Anticipo a Enterar
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                            <div className="bg-white p-3 rounded-xl border border-slate-200">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Total Anticipo Determinado</span>
                                                <span className="font-black text-slate-900 text-base"><Money value={data.pago_cuenta.totales.subtotal_pago_cuenta} /></span>
                                            </div>
                                            <div className="bg-white p-3 rounded-xl border border-slate-200">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">(-) Retenciones Renta Sufridas</span>
                                                <span className="font-black text-rose-600 text-base">- <Money value={data.pago_cuenta.totales.retenciones_renta_sufridas} /></span>
                                            </div>
                                            <div className="bg-purple-50 p-3 rounded-xl border border-purple-200">
                                                <span className="text-[10px] font-bold text-purple-700 uppercase block mb-1">Pago a Cuenta a Pagar (F-07)</span>
                                                <span className="font-black text-purple-900 text-base"><Money value={data.pago_cuenta.totales.pago_cuenta_a_pagar} /></span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400">
                    <AlertCircle size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-semibold">No se encontraron datos para el período seleccionado.</p>
                </div>
            )}
        </div>
    );
};

export default VatBookLiquidation;
