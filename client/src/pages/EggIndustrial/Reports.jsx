import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { unwrapList } from '../../utils/apiUtils';
import { getTodayString } from '../../utils/dateUtils';
import ReportLayout from '../../components/ui/ReportLayout';
import EggReportTable from '../../components/egg/tabs/EggReportTab';

const tabs = [['production','Producción'],['raw-materials','Materia prima'],['packaging','Envasado'],['quality','Calidad'],['wastes','Mermas']];
const initialFilters = () => {
    const start = new Date(); start.setDate(start.getDate() - 30);
    return { from: getTodayString(start), to: getTodayString(), provider_id: '', product_type: '', batch_id: '' };
};

export default function EggReports() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('production');
    const [filters, setFilters] = useState(initialFilters);
    const [applied, setApplied] = useState(initialFilters);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [exporting, setExporting] = useState(false);
    const companyId = user?.company_id;
    const params = Object.fromEntries(Object.entries(applied).filter(([,value]) => value !== ''));
    if (activeTab === 'raw-materials') { params.egg_type = params.product_type; delete params.product_type; }
    const endpoint = `/api/egg-industrial/reports/${activeTab}`;
    const report = useQuery({ queryKey: ['egg-report', companyId, activeTab, params], enabled: !!companyId,
        queryFn: async ({ signal }) => unwrapList(await axios.get(endpoint, { params, signal })) });
    const providers = useQuery({ queryKey: ['egg-report-providers', companyId], enabled: !!companyId,
        queryFn: async ({ signal }) => unwrapList(await axios.get('/api/egg-industrial/raw-materials', { signal })) });
    const batches = useQuery({ queryKey: ['egg-report-batches', companyId], enabled: !!companyId,
        queryFn: async ({ signal }) => unwrapList(await axios.get('/api/egg-industrial/batches', { signal })) });
    useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);
    useEffect(() => { setPdfUrl(null); }, [companyId, activeTab, applied]);
    const providerOptions = [...new Map((Array.isArray(providers.data) ? providers.data : []).filter(r => r.provider_id).map(r => [r.provider_id, r.provider_name])).entries()];
    const apply = () => {
        if (!filters.from || !filters.to || filters.from > filters.to) { toast.error('Seleccione un período válido.'); return; }
        setApplied({ ...filters });
    };
    const exportReport = async format => {
        setExporting(true);
        try {
            const { data } = await axios.get(endpoint, { params: { ...params, format }, responseType: 'blob' });
            const url = URL.createObjectURL(data);
            if (format === 'pdf') setPdfUrl(url);
            else {
                const link = document.createElement('a'); link.href = url; link.download = `huevo_${activeTab}_${applied.from}_${applied.to}.xlsx`; link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
        } catch { toast.error('No se pudo generar el reporte.'); }
        finally { setExporting(false); }
    };
    const field = (name,value) => setFilters(prev => ({ ...prev, [name]: value }));
    return <div className="min-w-0 space-y-4">
        <nav className="flex flex-wrap gap-2" aria-label="Reportes industriales">{(Array.isArray(tabs) ? tabs : []).map(([key,label]) => <button key={key} onClick={() => setActiveTab(key)} className={`rounded-lg px-3 py-2 text-sm font-bold ${key === activeTab ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{label}</button>)}</nav>
        <ReportLayout title={`Reporte de ${tabs.find(([key]) => key === activeTab)?.[1]}`} subtitle={`${applied.from} al ${applied.to}`} category="Huevo industrial"
            pdfUrl={pdfUrl} isGenerating={exporting} onGenerate={() => exportReport('pdf')} onExportExcel={() => exportReport('excel')} fileName={`huevo_${activeTab}.pdf`} canGenerate={!!companyId && !exporting}>
            <div className="space-y-3 text-sm">
                <label className="block">Desde<input className="w-full rounded border p-2" type="date" value={filters.from} onChange={e => field('from',e.target.value)} /></label>
                <label className="block">Hasta<input className="w-full rounded border p-2" type="date" value={filters.to} onChange={e => field('to',e.target.value)} /></label>
                {['raw-materials','quality'].includes(activeTab) && <label className="block">Proveedor<select className="w-full rounded border p-2" value={filters.provider_id} onChange={e => field('provider_id',e.target.value)}><option value="">Todos</option>{(Array.isArray(providerOptions) ? providerOptions : []).map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label>}
                {['production','packaging','raw-materials'].includes(activeTab) && <label className="block">Tipo de producto<input className="w-full rounded border p-2" value={filters.product_type} onChange={e => field('product_type',e.target.value)} placeholder="Todos" /></label>}
                {['packaging','wastes'].includes(activeTab) && <label className="block">Lote<select className="w-full rounded border p-2" value={filters.batch_id} onChange={e => field('batch_id',e.target.value)}><option value="">Todos</option>{(Array.isArray(batches.data) ? batches.data : []).map(row => <option key={row.id} value={row.id}>{row.batch_code_display || row.batch_uuid}</option>)}</select></label>}
                <button type="button" onClick={apply} className="w-full rounded-lg bg-indigo-600 p-2 font-bold text-white">Aplicar filtros</button>
                <p className="text-xs text-slate-500">Vista y exportaciones usan el período aplicado. Producción y envasado son etapas de la misma masa.</p>
            </div>
        </ReportLayout>
        <EggReportTable type={activeTab} rows={report.data || []} loading={report.isLoading} error={report.error} />
    </div>;
}
