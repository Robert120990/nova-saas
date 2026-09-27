import {
    Plus,
    Flame,
    Calendar
} from 'lucide-react';
import { getJulianDayInfo } from '../../../utils/julianDate';


export default function ProductionHeader({ model }) {
    const { user, navigate, batches, activeTab, setActiveTab, setBatchForm, setCipBlockedError, setHaccpViolationAlert, setIsNewBatchModalOpen, setIsPasteurizeModalOpen, setEditingBatch } = model;

    return (<div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 w-fit">
                    <button
                        onClick={() => { setActiveTab('batches'); setCipBlockedError(null); setHaccpViolationAlert(null); }}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'batches' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            }`}
                    >
                        Lotes de Producción
                    </button>
                    <button
                        onClick={() => { setActiveTab('cip'); setCipBlockedError(null); setHaccpViolationAlert(null); }}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'cip' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                            }`}
                    >
                        Registros de Sanitización (CIP)
                    </button>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => navigate('/industrial/calendario')}
                        className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-indigo-200 shadow-sm"
                    >
                        <Calendar size={14} />
                        Calendario de Producción
                    </button>
                    <button
                        onClick={() => {
                            setEditingBatch(null);
                            const dayInfo = getJulianDayInfo();
                            const todayBatches = (Array.isArray(batches) ? batches : []).filter(b => {
                                if (!b.batch_code_display) return false;
                                const parts = (Array.isArray(b.batch_code_display.toUpperCase().replace(/^LOTE\s*/i, '').split('-')) ? b.batch_code_display.toUpperCase().replace(/^LOTE\s*/i, '').split('-') : []).map(s => s.trim());
                                return parts.length === 3 && parseInt(parts[1], 10) === dayInfo.dayOfYear;
                            });
                            const nextRun = todayBatches.length > 0
                                ? Math.max(...(Array.isArray(todayBatches) ? todayBatches : []).map(b => {
                                    const parts = (Array.isArray((b.batch_code_display || '').toUpperCase().replace(/^LOTE\s*/i, '').split('-')) ? (b.batch_code_display || '').toUpperCase().replace(/^LOTE\s*/i, '').split('-') : []).map(s => s.trim());
                                    return parseInt(b.run_number, 10) || parseInt(parts[0], 10) || 1;
                                })) + 1
                                : 1;

                            setBatchForm({
                                product_type: 'huevo entero',
                                presentation: 'cubeta 30LB',
                                presentations: ['cubeta 30LB'],
                                run_number: nextRun,
                                batch_code_display: `LOTE ${String(nextRun).padStart(2, '0')}-${dayInfo.dayOfYearStr}-${dayInfo.year2Digit}`,
                                scheduled_production_id: null,
                                raw_materials: [],
                                remanente_ids: [],
                                ingredients: {
                                    boxes_count: '',
                                    water_bottles: '',
                                    sugar_lbs: '',
                                    salt_lbs: '',
                                    citric_acid_lbs: '',
                                    milk_powder_lbs: '',
                                    ppg_g: ''
                                },
                                operator_name: user?.nombre || '',
                                bypass_cip_check: false
                            });
                            setCipBlockedError(null);
                            setIsNewBatchModalOpen(true);
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                    >
                        <Plus size={14} />
                        Iniciar Nueva Producción
                    </button>
                    <button
                        onClick={() => { setIsPasteurizeModalOpen(true); setHaccpViolationAlert(null); }}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                    >
                        <Flame size={14} />
                        Pasteurizar
                    </button>
                </div>
            </div>);
}
