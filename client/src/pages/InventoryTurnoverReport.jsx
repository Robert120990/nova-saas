import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
    GitBranch, 
    Tags, 
    Clock,
    CheckCircle2,
    CheckSquare,
    Square
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import ReportLayout from '../components/ui/ReportLayout';

const INACTIVITY_OPTIONS = [
    { value: '30', label: '+30 días sin movimiento', badge: 'Baja' },
    { value: '60', label: '+60 días sin movimiento', badge: 'Lenta' },
    { value: '90', label: '+90 días sin movimiento (Recomendado)', badge: 'Obsoleta' },
    { value: '120', label: '+120 días sin movimiento', badge: 'Crítica' },
    { value: '0', label: 'Todos los productos (Diagnóstico general)', badge: 'Completo' },
];

const InventoryTurnoverReport = () => {
    const { user } = useAuth();
    const [selectedBranch, setSelectedBranch] = useState(user?.branch_id || '');
    const [daysInactive, setDaysInactive] = useState('90');
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [onlyStagnant, setOnlyStagnant] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);

    // Queries
    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await axios.get('/api/branches')).data
    });

    const { data: categories = [] } = useQuery({
        queryKey: ['categories-all'],
        queryFn: async () => (await axios.get('/api/categories', { params: { limit: 1000 } })).data?.data || []
    });

    const handleToggleCategory = (id) => {
        setSelectedCategories(prev => 
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const handleGenerateReport = async () => {
        if (!selectedBranch) {
            toast.error('Debe seleccionar una sucursal');
            return;
        }

        setIsGenerating(true);
        try {
            const params = { 
                branch_id: selectedBranch,
                days_inactive: daysInactive,
                only_stagnant: onlyStagnant
            };
            if (selectedCategories.length > 0) {
                params.category_ids = selectedCategories.join(',');
            }

            const response = await axios.get('/api/inventory/turnover-report', {
                params,
                responseType: 'blob'
            });

            if (response.data.type !== 'application/pdf') {
                const text = await response.data.text();
                let errMsg = 'Error en el formato del reporte';
                try {
                    const err = JSON.parse(text);
                    errMsg = err.message || errMsg;
                } catch {}
                throw new Error(errMsg);
            }

            const blob = new Blob([response.data], { type: 'application/pdf' });
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
            toast.success('Reporte de rotación generado');
        } catch (error) {
            console.error('Error generating report:', error);
            toast.error(error.message || 'Error al generar el reporte de rotación');
        } finally {
            setIsGenerating(false);
        }
    };

    useEffect(() => {
        return () => {
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        };
    }, [pdfUrl]);

    const handleDownload = () => {
        if (!pdfUrl) return;
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.setAttribute('download', `Rotacion_Inventario_${daysInactive}d.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const handleExportExcel = async () => {
        try {
            const params = { 
                branch_id: selectedBranch,
                days_inactive: daysInactive,
                only_stagnant: onlyStagnant,
                format: 'excel' 
            };
            if (selectedCategories.length > 0) {
                params.category_ids = selectedCategories.join(',');
            }
            const response = await axios.get('/api/inventory/turnover-report', {
                params,
                responseType: 'blob'
            });
            const blob = new Blob([response.data], { 
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Rotacion_Inventario_${daysInactive}d.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            toast.success('Reporte exportado a Excel correctamente');
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            toast.error('Error al exportar a Excel');
        }
    };

    return (
        <ReportLayout
            title="Rotación y Sin Movimiento"
            subtitle="Detección de productos estancados, cálculo de días de inactividad y capital inmovilizado."
            category="Inventario"
            pdfUrl={pdfUrl}
            isGenerating={isGenerating}
            onGenerate={handleGenerateReport}
            onDownload={handleDownload}
            onExportExcel={handleExportExcel}
            canGenerate={Boolean(selectedBranch)}
        >
            {/* Branch Selection */}
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <GitBranch size={12} className="text-indigo-500" /> Sucursal
                </label>
                <select 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all cursor-pointer"
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                >
                    <option value="">Seleccionar Sucursal...</option>
                    {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.nombre}</option>
                    ))}
                </select>
            </div>

            {/* Inactivity Criteria */}
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Clock size={12} className="text-indigo-500" /> Período de Inactividad
                </label>
                <select 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all cursor-pointer"
                    value={daysInactive}
                    onChange={(e) => setDaysInactive(e.target.value)}
                >
                    {INACTIVITY_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Only Stagnant with Stock */}
            <div className="pt-2">
                <button
                    type="button"
                    onClick={() => setOnlyStagnant(!onlyStagnant)}
                    className="w-full flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left cursor-pointer bg-slate-50 hover:bg-slate-100/80 border-slate-100"
                >
                    {onlyStagnant ? (
                        <CheckSquare size={16} className="text-indigo-600 shrink-0" />
                    ) : (
                        <Square size={16} className="text-slate-400 shrink-0" />
                    )}
                    <div className="min-w-0">
                        <span className="block text-xs font-bold text-slate-800">Solo con stock inmovilizado</span>
                        <span className="block text-[10px] text-slate-400 font-medium">Excluir productos agotados</span>
                    </div>
                </button>
            </div>

            {/* Categories Selection */}
            <div className="space-y-3">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <Tags size={12} className="text-indigo-500" /> Categorías
                    </span>
                    {selectedCategories.length > 0 && (
                        <button 
                            onClick={() => setSelectedCategories([])}
                            className="text-[9px] text-indigo-600 font-bold hover:underline lowercase cursor-pointer"
                        >
                            limpiar
                        </button>
                    )}
                </label>
                
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {categories.map(cat => {
                        const isSelected = selectedCategories.includes(cat.id);
                        return (
                            <button
                                key={cat.id}
                                onClick={() => handleToggleCategory(cat.id)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                                    isSelected 
                                        ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' 
                                        : 'bg-slate-50/50 text-slate-500 hover:bg-slate-100 border border-transparent'
                                }`}
                            >
                                <span className="truncate pr-2">{cat.name}</span>
                                {isSelected && <CheckCircle2 size={12} className="shrink-0" />}
                            </button>
                        );
                    })}
                </div>
            </div>
        </ReportLayout>
    );
};

export default InventoryTurnoverReport;
