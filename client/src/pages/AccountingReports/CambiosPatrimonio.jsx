import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
    Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import ReportLayout from '../../components/ui/ReportLayout';

const CambiosPatrimonio = () => {
    const { user } = useAuth();

    const currentYear = new Date().getFullYear();
    const [filters, setFilters] = useState({
        year: currentYear,
        month: ''
    });

    const [isGenerating, setIsGenerating] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);

    const handleFilterChange = (name, value) => {
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleGenerateReport = async () => {
        if (!filters.year) {
            toast.error('Debe seleccionar un año');
            return;
        }

        setIsGenerating(true);
        try {
            const params = {
                year: filters.year,
                month: filters.month || undefined
            };

            const response = await axios.get('/api/accounting/reports/cambios-patrimonio', {
                params,
                responseType: 'blob'
            });

            if (pdfUrl) URL.revokeObjectURL(pdfUrl);

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
            toast.success('Estado de cambios en el patrimonio generado correctamente');
        } catch (error) {
            console.error('Error generating report:', error);
            toast.error('Error al generar el estado de cambios en el patrimonio');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!pdfUrl) return;
        const fileSuffix = filters.year + (filters.month ? `_${filters.month}` : '');
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.setAttribute('download', `Cambios_Patrimonio_${fileSuffix}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const handleExportExcel = async () => {
        try {
            const params = {
                year: filters.year,
                month: filters.month || undefined,
                format: 'excel'
            };
            const response = await axios.get('/api/accounting/reports/cambios-patrimonio', {
                params,
                responseType: 'blob'
            });
            const blob = new Blob([response.data], { 
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Cambios_Patrimonio.xlsx`);
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
            title="Estado de Cambios en el Patrimonio Neto"
            subtitle="Movimientos en cuentas patrimoniales del período."
            category="Contabilidad"
            pdfUrl={pdfUrl}
            isGenerating={isGenerating}
            onGenerate={handleGenerateReport}
            onDownload={handleDownload}
            onExportExcel={handleExportExcel}
            canGenerate={Boolean(filters.year)}
        >
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Calendar size={12} className="text-indigo-500" /> Año
                    </label>
                    <select value={filters.year} onChange={e => handleFilterChange('year', e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all">
                        {Array.from({length: 10}, (_, i) => currentYear - 5 + i).map(y =>
                            <option key={y} value={y}>{y}</option>
                        )}
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Calendar size={12} className="text-indigo-500" /> Mes
                    </label>
                    <select value={filters.month} onChange={e => handleFilterChange('month', e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all">
                        <option value="">Todos</option>
                        <option value="1">Enero</option>
                        <option value="2">Febrero</option>
                        <option value="3">Marzo</option>
                        <option value="4">Abril</option>
                        <option value="5">Mayo</option>
                        <option value="6">Junio</option>
                        <option value="7">Julio</option>
                        <option value="8">Agosto</option>
                        <option value="9">Septiembre</option>
                        <option value="10">Octubre</option>
                        <option value="11">Noviembre</option>
                        <option value="12">Diciembre</option>
                    </select>
                </div>
            </div>
        </ReportLayout>
    );
};

export default CambiosPatrimonio;
