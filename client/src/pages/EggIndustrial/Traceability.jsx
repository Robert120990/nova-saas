import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import {
    Activity,
    Search,
    Boxes,
    Flame,
    Barcode,
    Snowflake,
    ClipboardList,
    TrendingUp,
    ShieldCheck,
    Lock,
    User,
    Calendar,
    ArrowDown,
    Building2,
    DollarSign,
    Award
} from 'lucide-react';

const EggTraceability = () => {
    const { user } = useAuth();
    const companyId = user?.company_id || 1;

    const [searchCode, setSearchCode] = useState('LOTE-260519-ENTERO'); // Pre-populate with realistic seeded lot code
    const [loading, setLoading] = useState(false);
    const [traceData, setTraceData] = useState(null);

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        
        if (!searchCode.trim()) {
            return toast.error('Debe ingresar un código de lote, UUID o código de barra.');
        }

        setLoading(true);
        setTraceData(null);
        try {
            const res = await axios.get(`/api/egg-industrial/trace/${searchCode.trim()}`);
            setTraceData(res.data);
            toast.success('Historial de trazabilidad 360° recuperado.');
        } catch (error) {
            console.error('Error fetching egg traceability details:', error);
            toast.error(error.response?.data?.message || 'No se encontraron registros para el código suministrado.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-teal-500/10 rounded-2xl border border-teal-500/20 text-teal-400">
                        <ShieldCheck className="h-8 w-8" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white uppercase tracking-wider">Trazabilidad Bidireccional Completa (360°)</h1>
                        <p className="text-[12px] text-slate-400 font-semibold tracking-tight">Rastreo e inocuidad alimentaria del ciclo de vida completo: desde la granja avícola hasta el túnel de congelación comercial</p>
                    </div>
                </div>
            </div>

            {/* Search Input Bar Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 space-y-2">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Código de Lote Comercial, UUID de Lote o Código de Barras</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={searchCode}
                                onChange={(e) => setSearchCode(e.target.value)}
                                placeholder="Ej: LOTE-260519-ENTERO, e573a4b0-c081-42e8-967a-113bd8e461a2..."
                                className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-850 rounded-2xl text-xs text-white font-extrabold placeholder-slate-500 focus:outline-none focus:border-indigo-500 shadow-inner"
                            />
                            <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-500" />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all border border-indigo-500 shadow-lg shadow-indigo-600/15"
                    >
                        {loading ? 'Rastreando...' : 'Buscar Traza'}
                    </button>
                </form>
            </div>

            {/* RENDER LIFECYCLE TIMELINE TREE */}
            {traceData && (
                <div className="space-y-8 relative">
                    <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest text-center">Árbol Cronológico de Inocuidad Alimentaria</h2>

                    {/* TIMELINE CONNECTOR LINE BACKGROUND */}
                    <div className="absolute left-1/2 top-12 bottom-12 w-0.5 bg-slate-800 transform -translate-x-1/2 hidden md:block" />

                    {/* Step 1: RAW MATERIAL INTAKE */}
                    <div className="relative flex flex-col md:flex-row md:justify-start items-center gap-6">
                        <div className="md:w-1/2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 hover:border-slate-700 transition-all z-10">
                            <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Fase 01: Granja y Recepción</span>
                                <span className="text-[9px] font-black bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded-full uppercase">Ingreso Aprobado</span>
                            </div>
                            
                            <div className="space-y-3 text-xs">
                                <div className="flex gap-3">
                                    <Building2 className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-extrabold text-white">{traceData.batch.provider_name}</h4>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Lote Proveedor: {traceData.batch.raw_provider_lot}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-850">
                                    <div>
                                        <span className="text-[8px] font-black text-slate-500 block uppercase">Materia Prima:</span>
                                        <span className="font-bold text-white capitalize">{traceData.batch.raw_egg_type}</span>
                                    </div>
                                    <div>
                                        <span className="text-[8px] font-black text-slate-500 block uppercase">Temp Recepción:</span>
                                        <span className="font-bold text-teal-400">{traceData.batch.raw_temp}°C</span>
                                    </div>
                                    <div className="mt-1">
                                        <span className="text-[8px] font-black text-slate-500 block uppercase">Peso Ingresado:</span>
                                        <span className="font-bold text-white">{parseFloat(traceData.batch.raw_weight).toLocaleString()} Lbs</span>
                                    </div>
                                    <div className="mt-1">
                                        <span className="text-[8px] font-black text-slate-500 block uppercase">Operador:</span>
                                        <span className="font-bold text-slate-300">{traceData.batch.raw_operator}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Dot in center */}
                        <div className="w-8 h-8 rounded-full bg-slate-950 border-4 border-slate-800 flex items-center justify-center text-teal-400 font-black text-xs z-20 absolute left-1/2 transform -translate-x-1/2 hidden md:flex">1</div>
                    </div>

                    {/* Step 2: CLEAN IN PLACE (CIP) */}
                    {traceData.cipLogs && traceData.cipLogs.length > 0 && (
                        <div className="relative flex flex-col md:flex-row md:justify-end items-center gap-6">
                            {/* Dot in center */}
                            <div className="w-8 h-8 rounded-full bg-slate-950 border-4 border-slate-800 flex items-center justify-center text-teal-400 font-black text-xs z-20 absolute left-1/2 transform -translate-x-1/2 hidden md:flex">2</div>
                            
                            <div className="md:w-1/2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 hover:border-slate-700 transition-all z-10">
                                <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Fase 02: Habilitación de Planta</span>
                                    <span className="text-[9px] font-black bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded-full uppercase">Sanitización CIP OK</span>
                                </div>

                                <div className="space-y-3 text-xs">
                                    <p className="text-[11px] text-slate-400 font-semibold">{traceData.cipLogs[0].notes || 'Limpieza y sanitización CIP completada de forma óptima.'}</p>
                                    <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-850">
                                        <div>
                                            <span className="text-[8px] font-black text-slate-500 block uppercase">Equipo:</span>
                                            <span className="font-bold text-white capitalize">{traceData.cipLogs[0].equipment_name}</span>
                                        </div>
                                        <div>
                                            <span className="text-[8px] font-black text-slate-500 block uppercase">Sanitizante:</span>
                                            <span className="font-bold text-white">{traceData.cipLogs[0].chemical_used}</span>
                                        </div>
                                        <div className="mt-1">
                                            <span className="text-[8px] font-black text-slate-500 block uppercase">Temp de Lavado:</span>
                                            <span className="font-bold text-white">{traceData.cipLogs[0].temperature_c}°C</span>
                                        </div>
                                        <div className="mt-1">
                                            <span className="text-[8px] font-black text-slate-500 block uppercase">Duración:</span>
                                            <span className="font-bold text-white">{traceData.cipLogs[0].duration_minutes} Minutos</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: BATCH PROCESSING */}
                    <div className="relative flex flex-col md:flex-row md:justify-start items-center gap-6">
                        <div className="md:w-1/2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 hover:border-slate-700 transition-all z-10">
                            <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Fase 03: Quebrado y Balance de Masas</span>
                                <span className="text-[9px] font-black bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded-full uppercase">Balance Completo</span>
                            </div>

                            <div className="space-y-3 text-xs">
                                <div className="flex gap-3">
                                    <ClipboardList className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-extrabold text-white capitalize">{traceData.batch.product_type} ({traceData.batch.presentation})</h4>
                                        <span className="text-[9px] font-bold font-mono text-slate-500 select-all block">Lote UUID: {traceData.batch.batch_uuid}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-850">
                                    <div>
                                        <span className="text-[8px] font-black text-slate-500 block uppercase">Peso Entrada Lbs:</span>
                                        <span className="font-bold text-white">{parseFloat(traceData.batch.input_weight_lbs).toLocaleString()} Lbs</span>
                                    </div>
                                    <div>
                                        <span className="text-[8px] font-black text-slate-500 block uppercase">Rendimiento Líquido:</span>
                                        <span className="font-bold text-teal-400">{parseFloat(traceData.batch.yield_liquid_lbs).toLocaleString()} Lbs</span>
                                    </div>
                                    <div className="mt-1">
                                        <span className="text-[8px] font-black text-slate-500 block uppercase">Cáscaras de Huevo:</span>
                                        <span className="font-bold text-slate-400">{parseFloat(traceData.batch.waste_shell_lbs).toLocaleString()} Lbs</span>
                                    </div>
                                    <div className="mt-1">
                                        <span className="text-[8px] font-black text-slate-500 block uppercase">Merma/Pérdidas:</span>
                                        <span className="font-bold text-slate-400">{parseFloat(traceData.batch.waste_loss_lbs).toLocaleString()} Lbs</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Dot in center */}
                        <div className="w-8 h-8 rounded-full bg-slate-950 border-4 border-slate-800 flex items-center justify-center text-teal-400 font-black text-xs z-20 absolute left-1/2 transform -translate-x-1/2 hidden md:flex">3</div>
                    </div>

                    {/* Step 4: CRITICAL CONTROL POINT (HACCP) */}
                    {traceData.pasteurizations && traceData.pasteurizations.length > 0 && (
                        <div className="relative flex flex-col md:flex-row md:justify-end items-center gap-6">
                            {/* Dot in center */}
                            <div className="w-8 h-8 rounded-full bg-slate-950 border-4 border-slate-800 flex items-center justify-center text-teal-400 font-black text-xs z-20 absolute left-1/2 transform -translate-x-1/2 hidden md:flex">4</div>
                            
                            <div className="md:w-1/2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 hover:border-slate-700 transition-all z-10">
                                <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Fase 04: Inocuidad HACCP (PCC)</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                        traceData.pasteurizations[0].haccp_compliant
                                            ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                                            : 'bg-rose-500/10 text-rose-500 border border-rose-500/20 animate-pulse font-black'
                                    }`}>
                                        {traceData.pasteurizations[0].haccp_compliant ? 'Conforme HACCP' : 'DESVIACIÓN HACCP'}
                                    </span>
                                </div>

                                <div className="space-y-3 text-xs">
                                    <div className="flex gap-3">
                                        <Flame className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="font-extrabold text-white">Monitoreo del Pasteurizador Digital</h4>
                                            {traceData.pasteurizations[0].deviation_description && (
                                                <p className="text-[10px] text-rose-500 font-black mt-1 uppercase">Falla: {traceData.pasteurizations[0].deviation_description}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-850">
                                        <div>
                                            <span className="text-[8px] font-black text-slate-500 block uppercase">Temp Pasteurizador:</span>
                                            <span className={`font-black ${traceData.pasteurizations[0].haccp_compliant ? 'text-teal-400' : 'text-rose-500'}`}>
                                                {traceData.pasteurizations[0].temperature_c}°C
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[8px] font-black text-slate-500 block uppercase">Holding Time:</span>
                                            <span className="font-bold text-white">{traceData.pasteurizations[0].holding_time_seconds} Segundos</span>
                                        </div>
                                        <div className="mt-1">
                                            <span className="text-[8px] font-black text-slate-500 block uppercase">Presión Hidráulica:</span>
                                            <span className="font-bold text-white">{traceData.pasteurizations[0].pressure_psi} PSI</span>
                                        </div>
                                        <div className="mt-1">
                                            <span className="text-[8px] font-black text-slate-500 block uppercase">Flujo Continuo:</span>
                                            <span className="font-bold text-white">{traceData.pasteurizations[0].flow_rate_gpm} GPM</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 5: PACKAGING */}
                    {traceData.packaging && (
                        <div className="relative flex flex-col md:flex-row md:justify-start items-center gap-6">
                            <div className="md:w-1/2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 hover:border-slate-700 transition-all z-10">
                                <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Fase 05: Envasado y Etiquetado GS1</span>
                                    <span className="text-[9px] font-black bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded-full uppercase">Lote Envasado</span>
                                </div>

                                <div className="space-y-3 text-xs">
                                    <div className="flex gap-3">
                                        <Barcode className="h-5 w-5 text-purple-400 shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="font-extrabold text-white">Lote Comercial: {traceData.packaging.lot_code}</h4>
                                            <span className="text-[9px] text-slate-500 font-bold block uppercase mt-0.5">Código de barras: {traceData.packaging.barcode}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-850">
                                        <div>
                                            <span className="text-[8px] font-black text-slate-500 block uppercase">Unidades Producidas:</span>
                                            <span className="font-bold text-white">{traceData.packaging.units_packaged} Envases</span>
                                        </div>
                                        <div>
                                            <span className="text-[8px] font-black text-slate-500 block uppercase">Peso Envasado:</span>
                                            <span className="font-bold text-teal-400">{parseFloat(traceData.packaging.total_batch_weight_lbs).toLocaleString()} Lbs</span>
                                        </div>
                                        <div className="mt-1">
                                            <span className="text-[8px] font-black text-slate-500 block uppercase">Fecha Vencimiento:</span>
                                            <span className="font-bold text-rose-500">{new Date(traceData.packaging.expiry_date).toLocaleDateString()}</span>
                                        </div>
                                        <div className="mt-1">
                                            <span className="text-[8px] font-black text-slate-500 block uppercase">Operador Envasador:</span>
                                            <span className="font-bold text-slate-350">{traceData.packaging.operator_name}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* Dot in center */}
                            <div className="w-8 h-8 rounded-full bg-slate-950 border-4 border-slate-800 flex items-center justify-center text-teal-400 font-black text-xs z-20 absolute left-1/2 transform -translate-x-1/2 hidden md:flex">5</div>
                        </div>
                    )}

                    {/* Step 6: BLAST FREEZER */}
                    {traceData.blastFreezer && (
                        <div className="relative flex flex-col md:flex-row md:justify-end items-center gap-6">
                            {/* Dot in center */}
                            <div className="w-8 h-8 rounded-full bg-slate-950 border-4 border-slate-800 flex items-center justify-center text-teal-400 font-black text-xs z-20 absolute left-1/2 transform -translate-x-1/2 hidden md:flex">6</div>
                            
                            <div className="md:w-1/2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 hover:border-slate-700 transition-all z-10">
                                <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Fase 06: Túnel Rápido de Congelación</span>
                                    <span className="text-[9px] font-black bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full uppercase">Congelado OK</span>
                                </div>

                                <div className="space-y-3 text-xs">
                                    <div className="flex gap-3">
                                        <Snowflake className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="font-extrabold text-white">Blast Freezer: {traceData.blastFreezer.freezer_location}</h4>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Estatus: {traceData.blastFreezer.status === 'congelado_ok' ? 'Congelado Completo' : traceData.blastFreezer.status}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-850 font-medium">
                                        <div>
                                            <span className="text-[8px] font-black text-slate-500 block uppercase">Temp Núcleo:</span>
                                            <span className="font-bold text-cyan-400">{traceData.blastFreezer.core_temperature_c}°C</span>
                                        </div>
                                        <div>
                                            <span className="text-[8px] font-black text-slate-500 block uppercase">Duración Congelación:</span>
                                            <span className="font-bold text-white">{traceData.blastFreezer.freezing_duration_hours} Horas</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 7: AUDIT DIGITAL EVENT TRAIL */}
                    {traceData.auditTrail && traceData.auditTrail.length > 0 && (
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl max-w-4xl mx-auto space-y-4">
                            <h2 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                                <Activity className="h-4 w-4 text-indigo-400 animate-pulse" />
                                Bitácora de Auditoría Digital Habilitada (IoT Cryptographic Log)
                            </h2>
                            <div className="h-px bg-slate-800" />
                            
                            <div className="space-y-2">
                                {traceData.auditTrail.map(event => (
                                    <div key={event.id} className="p-3 bg-slate-950 border border-slate-850 rounded-2xl flex justify-between items-start gap-4 text-xs">
                                        <div className="space-y-1">
                                            <span className={`text-[8.5px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${
                                                event.severity === 'critical' ? 'bg-rose-500/10 text-rose-500' : event.severity === 'warning' ? 'bg-orange-500/10 text-orange-400' : 'bg-indigo-500/10 text-indigo-400'
                                            }`}>
                                                {event.event_type}
                                            </span>
                                            <p className="text-[11px] text-slate-350 font-semibold mt-1">{event.description}</p>
                                            <span className="text-[9px] text-slate-500 block">Operador Responsable: <b>{event.operator_name}</b></span>
                                        </div>
                                        <span className="text-[10px] text-slate-500 font-extrabold whitespace-nowrap">{new Date(event.created_at).toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default EggTraceability;
