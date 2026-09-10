import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { 
    X, 
    FileText, 
    ReceiptText, 
    Download, 
    Building2, 
    Users, 
    Check, 
    Search, 
    Info, 
    LayoutList, 
    Columns3,
    FileSpreadsheet,
    Files
} from 'lucide-react';

const MONTH_NAMES = [
    '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const PlanillaExportModal = ({ isOpen, onClose, periodo, onConfirm }) => {
    const [formato, setFormato] = useState('resumen'); // 'resumen' | 'detallado'
    const [formatoBancario, setFormatoBancario] = useState('ambos'); // 'csv' | 'txt' | 'ambos'
    const [allBranchesSelected, setAllBranchesSelected] = useState(true);
    const [selectedBranchIds, setSelectedBranchIds] = useState([]);
    const [allDeptosSelected, setAllDeptosSelected] = useState(true);
    const [selectedDeptoIds, setSelectedDeptoIds] = useState([]);
    const [deptoSearch, setDeptoSearch] = useState('');

    const anio = periodo?.anio || periodo?.periodo_anio;
    const mes = periodo?.mes || periodo?.periodo_mes;
    const quincena = periodo?.quincena;
    const tipo = periodo?.tipo || 'planilla'; // 'planilla' | 'recibos' | 'csv'

    // Fetch branches
    const { data: branchesResp } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => {
            const res = await axios.get('/api/branches');
            return Array.isArray(res.data) ? res.data : (res.data?.data || []);
        },
        enabled: isOpen
    });

    const branches = useMemo(() => {
        if (!branchesResp) return [];
        if (Array.isArray(branchesResp)) return branchesResp;
        if (Array.isArray(branchesResp.data)) return branchesResp.data;
        return [];
    }, [branchesResp]);

    // Fetch departamentos
    const { data: deptosResp } = useQuery({
        queryKey: ['rh-departamentos-all'],
        queryFn: async () => {
            const res = await axios.get('/api/rh/departamentos', { params: { limit: 5000 } });
            return Array.isArray(res.data) ? res.data : (res.data?.data || []);
        },
        enabled: isOpen
    });

    const departamentos = useMemo(() => {
        if (!deptosResp) return [];
        if (Array.isArray(deptosResp)) return deptosResp;
        if (Array.isArray(deptosResp.data)) return deptosResp.data;
        return [];
    }, [deptosResp]);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setFormato('resumen');
            setFormatoBancario('ambos');
            setAllBranchesSelected(true);
            setSelectedBranchIds([]);
            setAllDeptosSelected(true);
            setSelectedDeptoIds([]);
            setDeptoSearch('');
        }
    }, [isOpen]);

    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Toggle branch selection
    const handleToggleBranch = (id) => {
        if (allBranchesSelected) {
            // All were checked, uncheck only this one
            const next = branches.map(b => b.id).filter(bId => bId !== id);
            setAllBranchesSelected(false);
            setSelectedBranchIds(next);
        } else {
            const exists = selectedBranchIds.includes(id);
            const next = exists 
                ? selectedBranchIds.filter(bId => bId !== id)
                : [...selectedBranchIds, id];
            
            if (next.length === branches.length) {
                setAllBranchesSelected(true);
                setSelectedBranchIds([]);
            } else {
                setSelectedBranchIds(next);
            }
        }
    };

    const handleSelectAllBranches = (selectAll) => {
        setAllBranchesSelected(selectAll);
        if (selectAll) {
            setSelectedBranchIds([]);
        } else {
            setSelectedBranchIds([]);
        }
    };

    // Toggle depto selection
    const handleToggleDepto = (id) => {
        if (allDeptosSelected) {
            // All were checked, uncheck only this one
            const next = departamentos.map(d => d.id).filter(dId => dId !== id);
            setAllDeptosSelected(false);
            setSelectedDeptoIds(next);
        } else {
            const exists = selectedDeptoIds.includes(id);
            const next = exists 
                ? selectedDeptoIds.filter(dId => dId !== id)
                : [...selectedDeptoIds, id];

            if (next.length === departamentos.length) {
                setAllDeptosSelected(true);
                setSelectedDeptoIds([]);
            } else {
                setSelectedDeptoIds(next);
            }
        }
    };

    const handleSelectAllDeptos = (selectAll) => {
        setAllDeptosSelected(selectAll);
        if (selectAll) {
            setSelectedDeptoIds([]);
        } else {
            setSelectedDeptoIds([]);
        }
    };

    // Filtered departamentos by search term
    const filteredDeptos = useMemo(() => {
        if (!deptoSearch.trim()) return departamentos;
        const q = deptoSearch.toLowerCase().trim();
        return departamentos.filter(d => 
            (d.descripcion || '').toLowerCase().includes(q) ||
            (d.codigo || '').toLowerCase().includes(q)
        );
    }, [departamentos, deptoSearch]);

    // Calculate effective branch count for grouping hint
    const effectiveBranchCount = allBranchesSelected 
        ? branches.length 
        : selectedBranchIds.length;

    const willGroupByBranch = tipo === 'planilla' && effectiveBranchCount > 1;

    const handleConfirm = () => {
        if (!allBranchesSelected && selectedBranchIds.length === 0) {
            toast.error('Debe seleccionar al menos una sucursal');
            return;
        }
        if (!allDeptosSelected && selectedDeptoIds.length === 0) {
            toast.error('Debe seleccionar al menos un departamento');
            return;
        }

        const branch_ids = allBranchesSelected ? [] : selectedBranchIds;
        const departamento_ids = allDeptosSelected ? [] : selectedDeptoIds;

        onConfirm({
            tipo,
            anio,
            mes,
            quincena,
            branch_ids,
            departamento_ids,
            formato,
            formatoBancario
        });
        onClose();
    };

    if (!isOpen) return null;

    const mesLabel = MONTH_NAMES[parseInt(mes)] || `Mes ${mes}`;
    const quincenaLabel = quincena === 'primera' ? '1ra Quincena' : '2da Quincena';

    const modalTitle = tipo === 'planilla'
        ? 'Generar Planilla de Sueldos (PDF)'
        : tipo === 'recibos'
            ? 'Generar Recibos de Pago (PDF)'
            : 'Exportar Archivo Bancario';

    const ActionIcon = tipo === 'planilla' 
        ? FileText 
        : tipo === 'recibos' 
            ? ReceiptText 
            : Download;

    const actionButtonText = tipo === 'planilla' 
        ? 'Ver Planilla' 
        : tipo === 'recibos' 
            ? 'Ver Recibos' 
            : (formatoBancario === 'ambos' ? 'Descargar CSV + TXT' : (formatoBancario === 'txt' ? 'Descargar TXT' : 'Descargar CSV'));

    const actionThemeColor = tipo === 'planilla' 
        ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/25' 
        : tipo === 'recibos' 
            ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/25' 
            : 'bg-sky-600 hover:bg-sky-700 shadow-sky-600/25';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div 
                className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/60">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${
                            tipo === 'planilla' ? 'bg-indigo-50 text-indigo-600' :
                            tipo === 'recibos' ? 'bg-purple-50 text-purple-600' :
                            'bg-sky-50 text-sky-600'
                        }`}>
                            <ActionIcon size={20} />
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-bold text-slate-900">{modalTitle}</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                    {mesLabel} {anio} — {quincenaLabel}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Cerrar modal"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    
                    {/* Format Toggle (Solo para Planilla) */}
                    {tipo === 'planilla' && (
                        <div className="space-y-2 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70">
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                Formato de Planilla
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setFormato('resumen')}
                                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                                        formato === 'resumen'
                                            ? 'bg-white border-indigo-600 shadow-sm ring-2 ring-indigo-600/10'
                                            : 'bg-white/50 border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    <div className={`p-2 rounded-lg mt-0.5 ${
                                        formato === 'resumen' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        <LayoutList size={16} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs font-bold text-slate-900">Resumen</span>
                                            <span className="text-[10px] font-bold px-1.5 py-0.2 text-emerald-700 bg-emerald-50 rounded">Por defecto</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                                            Planilla estándar con ingresos adicionales y otras deducciones consolidadas.
                                        </p>
                                    </div>
                                    {formato === 'resumen' && (
                                        <div className="text-indigo-600 p-0.5"><Check size={16} /></div>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setFormato('detallado')}
                                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                                        formato === 'detallado'
                                            ? 'bg-white border-indigo-600 shadow-sm ring-2 ring-indigo-600/10'
                                            : 'bg-white/50 border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    <div className={`p-2 rounded-lg mt-0.5 ${
                                        formato === 'detallado' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                        <Columns3 size={16} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs font-bold text-slate-900">Detallada</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                                            Muestra todas las columnas desglosadas de ingresos y deducciones.
                                        </p>
                                    </div>
                                    {formato === 'detallado' && (
                                        <div className="text-indigo-600 p-0.5"><Check size={16} /></div>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Format Toggle (Solo para Archivo Bancario CSV / TXT) */}
                    {tipo === 'csv' && (
                        <div className="space-y-2 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70">
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                Formato de Archivo Bancario
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setFormatoBancario('csv')}
                                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                                        formatoBancario === 'csv'
                                            ? 'bg-white border-sky-600 shadow-sm ring-2 ring-sky-600/10'
                                            : 'bg-white/50 border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <div className={`p-2 rounded-lg ${
                                            formatoBancario === 'csv' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            <FileSpreadsheet size={16} />
                                        </div>
                                        {formatoBancario === 'csv' && (
                                            <div className="text-sky-600"><Check size={16} /></div>
                                        )}
                                    </div>
                                    <div className="mt-2.5">
                                        <span className="text-xs font-bold text-slate-900">Solo CSV (.csv)</span>
                                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                                            Valores separados para Excel u hojas de cálculo.
                                        </p>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setFormatoBancario('txt')}
                                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                                        formatoBancario === 'txt'
                                            ? 'bg-white border-sky-600 shadow-sm ring-2 ring-sky-600/10'
                                            : 'bg-white/50 border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <div className={`p-2 rounded-lg ${
                                            formatoBancario === 'txt' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            <FileText size={16} />
                                        </div>
                                        {formatoBancario === 'txt' && (
                                            <div className="text-sky-600"><Check size={16} /></div>
                                        )}
                                    </div>
                                    <div className="mt-2.5">
                                        <span className="text-xs font-bold text-slate-900">Solo TXT (.txt)</span>
                                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                                            Texto plano para plataformas bancarias.
                                        </p>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setFormatoBancario('ambos')}
                                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                                        formatoBancario === 'ambos'
                                            ? 'bg-white border-sky-600 shadow-sm ring-2 ring-sky-600/10'
                                            : 'bg-white/50 border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <div className={`p-2 rounded-lg ${
                                            formatoBancario === 'ambos' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            <Files size={16} />
                                        </div>
                                        {formatoBancario === 'ambos' && (
                                            <div className="text-sky-600"><Check size={16} /></div>
                                        )}
                                    </div>
                                    <div className="mt-2.5">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs font-bold text-slate-900">Ambos (.csv + .txt)</span>
                                            <span className="text-[10px] font-bold px-1.5 py-0.2 text-emerald-700 bg-emerald-50 rounded">Recomendado</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                                            Descarga ambos archivos simultáneamente.
                                        </p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Filter Cards: Sucursales & Departamentos */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* 1. Card Sucursales */}
                        <div className="border border-slate-200 rounded-xl p-3.5 space-y-3 bg-white">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Building2 size={16} className="text-indigo-600" />
                                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                                        Sucursales
                                    </span>
                                </div>
                                <span className="text-[11px] font-semibold text-slate-500">
                                    {allBranchesSelected ? 'Todas' : `${selectedBranchIds.length} de ${branches.length}`}
                                </span>
                            </div>

                            {/* Select All Option */}
                            <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 hover:bg-slate-100/80 cursor-pointer transition-colors">
                                <input
                                    type="checkbox"
                                    checked={allBranchesSelected}
                                    onChange={(e) => handleSelectAllBranches(e.target.checked)}
                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                />
                                <span className="text-xs font-bold text-slate-700">Todas las sucursales</span>
                            </label>

                            {/* Branches Checkbox List */}
                            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                                {branches.map(b => {
                                    const isChecked = allBranchesSelected || selectedBranchIds.includes(b.id);
                                    return (
                                        <label
                                            key={b.id}
                                            className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                                                isChecked ? 'bg-indigo-50/50 text-indigo-950 font-medium' : 'text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => handleToggleBranch(b.id)}
                                                    className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                                />
                                                <span className="truncate">{b.nombre}</span>
                                            </div>
                                            {b.es_casa_matriz ? (
                                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100/60 px-1.5 py-0.5 rounded">Matriz</span>
                                            ) : null}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 2. Card Departamentos */}
                        <div className="border border-slate-200 rounded-xl p-3.5 space-y-3 bg-white">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Users size={16} className="text-indigo-600" />
                                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                                        Departamentos
                                    </span>
                                </div>
                                <span className="text-[11px] font-semibold text-slate-500">
                                    {allDeptosSelected ? 'Todos' : `${selectedDeptoIds.length} de ${departamentos.length}`}
                                </span>
                            </div>

                            {/* Select All Option */}
                            <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 hover:bg-slate-100/80 cursor-pointer transition-colors">
                                <input
                                    type="checkbox"
                                    checked={allDeptosSelected}
                                    onChange={(e) => handleSelectAllDeptos(e.target.checked)}
                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                />
                                <span className="text-xs font-bold text-slate-700">Todos los departamentos</span>
                            </label>

                            {/* Quick Search */}
                            {departamentos.length > 5 && (
                                <div className="relative">
                                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={deptoSearch}
                                        onChange={(e) => setDeptoSearch(e.target.value)}
                                        placeholder="Buscar departamento..."
                                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                </div>
                            )}

                            {/* Deptos Checkbox List */}
                            <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                                {filteredDeptos.length === 0 ? (
                                    <p className="text-[11px] text-slate-400 p-2 text-center">No se encontraron departamentos</p>
                                ) : (
                                    filteredDeptos.map(d => {
                                        const isChecked = allDeptosSelected || selectedDeptoIds.includes(d.id);
                                        return (
                                            <label
                                                key={d.id}
                                                className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                                                    isChecked ? 'bg-indigo-50/50 text-indigo-950 font-medium' : 'text-slate-600 hover:bg-slate-50'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => handleToggleDepto(d.id)}
                                                        className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                                    />
                                                    <span className="truncate">{d.descripcion}</span>
                                                </div>
                                                <span className="text-[10px] text-slate-400 font-mono">{d.codigo}</span>
                                            </label>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Notice for Branch Grouping in Planillas */}
                    {willGroupByBranch && (
                        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 text-xs">
                            <Info size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                            <p className="leading-relaxed">
                                <strong>Agrupación por sucursal activa:</strong> Al haber seleccionado {effectiveBranchCount} sucursales, la planilla se agrupará por cada sucursal con subtotales independientes y el total general acumulado.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-slate-100 bg-slate-50/60">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-md active:scale-95 ${actionThemeColor}`}
                    >
                        <ActionIcon size={15} />
                        <span>{actionButtonText}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PlanillaExportModal;
