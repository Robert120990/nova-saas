import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
    GitBranch, 
    Tags, 
    CheckCircle2,
    Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import ReportLayout from '../components/ui/ReportLayout';

const InventoryMovementsReport = () => {
    const { user } = useAuth();
    
    // Default dates: First day of current month to today
    const today = new Date().toISOString().split('T')[0];
    const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const [selectedBranch, setSelectedBranch] = useState(user?.branch_id || '');
    const [startDate, setStartDate] = useState(firstDay);
    const [endDate, setEndDate] = useState(today);
    const [selectedCategories, setSelectedCategories] = useState([]);
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
        if (!startDate || !endDate) {
            toast.error('Debe seleccionar un rango de fechas');
            return;
        }

        setIsGenerating(true);
        try {
            const params = { 
                branch_id: selectedBranch,
                startDate,
                endDate
            };
            
            if (selectedCategories.length > 0) {
                params.category_ids = selectedCategories.join(',');
            }

            const response = await axios.get('/api/inventory/movements-report', {
                params,
                responseType: 'blob'
            });

            // Verify if the response is actually a PDF
            if (response.data.type !== 'application/pdf') {
                // If it's not a PDF, it's likely an error JSON blob
                const text = await response.data.text();
                const error = JSON.parse(text);
                throw new Error(error.message || 'Error en el formato del reporte');
            }

            const blob = new Blob([response.data], { type: 'application/pdf' });
            
            // Revoke previous URL to free memory and avoid stale data
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
            
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
            toast.success('Reporte de movimientos generado');
        } catch (error) {
            console.error('Error generating report:', error);
            toast.error(error.message || 'Error al generar el reporte de movimientos');
        } finally {
            setIsGenerating(false);
        }
    };

    // Cleanup URL on unmount
    React.useEffect(() => {
        return () => {
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        };
    }, [pdfUrl]);

    const handleDownload = () => {
        if (!pdfUrl) return;
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.setAttribute('download', `Movimientos_Inventario_${startDate}_${endDate}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    return (
        <ReportLayout
            title="Reporte de Movimientos"
            subtitle="Análisis de flujos de inventario: stock inicial, entradas, salidas y saldos finales por periodo."
            category="Inventario"
            pdfUrl={pdfUrl}
            isGenerating={isGenerating}
            onGenerate={handleGenerateReport}
            onDownload={handleDownload}
            canGenerate={Boolean(selectedBranch && startDate && endDate)}
        >
            {/* Branch Selection */}
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <GitBranch size={12} className="text-indigo-500" /> Sucursal
                </label>
                <select 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                >
                    <option value="">Seleccionar Sucursal...</option>
                    {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.nombre}</option>
                    ))}
                </select>
            </div>

            {/* Date Range */}
            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Calendar size={12} className="text-indigo-500" /> Desde
                    </label>
                    <input 
                        type="date"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Calendar size={12} className="text-indigo-500" /> Hasta
                    </label>
                    <input 
                        type="date"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                    />
                </div>
            </div>

            {/* Categories Multi-select */}
            <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Tags size={12} className="text-indigo-500" /> Categorías
                </label>
                <div className="max-h-48 overflow-y-auto pr-2 space-y-1.5 custom-scrollbar">
                    {categories.map(cat => (
                        <label 
                            key={cat.id}
                            className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                                selectedCategories.includes(cat.id)
                                ? 'bg-indigo-50 border-indigo-100 text-indigo-700'
                                : 'bg-white border-slate-50 text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            <input 
                                type="checkbox"
                                className="hidden"
                                checked={selectedCategories.includes(cat.id)}
                                onChange={() => handleToggleCategory(cat.id)}
                            />
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                                selectedCategories.includes(cat.id)
                                ? 'bg-indigo-600 border-indigo-600'
                                : 'bg-white border-slate-200'
                            }`}>
                                {selectedCategories.includes(cat.id) && <CheckCircle2 size={10} className="text-white" />}
                            </div>
                            <span className="text-[11px] font-bold uppercase tracking-tight">{cat.name}</span>
                        </label>
                    ))}
                </div>
            </div>
        </ReportLayout>
    );
};

export default InventoryMovementsReport;
