import { ArrowUpRight, Scale, FileText } from 'lucide-react';
import Table from '../../ui/Table';
import Money from '../../ui/Money';
import { formatDate } from '../../../utils/dateUtils';

const RetencionesEmitidasTab = ({
    data = [],
    summary = {},
    isLoading = false
}) => {
    const items = Array.isArray(data) ? data : [];

    const headers = [
        { label: '#', className: 'text-center w-10 whitespace-nowrap' },
        { label: 'Origen', className: 'text-center w-20 whitespace-nowrap' },
        { label: 'Fecha', className: 'text-center w-24 whitespace-nowrap' },
        { label: 'Sujeto Retenido (Proveedor)', className: 'w-60' },
        { label: 'NIT', className: 'text-center w-36 whitespace-nowrap' },
        { label: 'NRC', className: 'text-center w-24 whitespace-nowrap' },
        { label: 'Número de Resolución', className: 'w-48 whitespace-nowrap' },
        { label: 'Serie de Documento', className: 'w-48 whitespace-nowrap' },
        { label: 'Número de Documento', className: 'w-44 whitespace-nowrap' },
        { label: 'Doc. Origen', className: 'w-32 whitespace-nowrap' },
        { label: 'Sucursal', className: 'w-32 whitespace-nowrap' },
        { label: 'Monto Sujeto', className: 'text-right w-28 whitespace-nowrap' },
        { label: 'Retención 1%', className: 'text-right w-28 whitespace-nowrap' }
    ];

    const renderRow = (item, index) => (
        <tr key={item.id || index} className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 text-[11px]">
            <td className="py-1.5 px-2.5 text-center font-semibold text-slate-400 whitespace-nowrap">{item.corr || index + 1}</td>
            <td className="py-1.5 px-2.5 text-center whitespace-nowrap">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
                    item.origen === 'compra' ? 'bg-sky-50 text-sky-700 border border-sky-200/60' :
                    item.origen === 'dte-07' ? 'bg-purple-50 text-purple-700 border border-purple-200/60' :
                    'bg-slate-100 text-slate-700 border border-slate-200/60'
                }`}>
                    {item.origen}
                </span>
            </td>
            <td className="py-1.5 px-2.5 text-center text-slate-600 font-medium whitespace-nowrap">{formatDate(item.fecha)}</td>
            <td className="py-1.5 px-2.5 font-semibold text-slate-800 whitespace-nowrap">
                <div className="truncate max-w-xs" title={item.proveedor_nombre}>{item.proveedor_nombre}</div>
            </td>
            <td className="py-1.5 px-2.5 text-center text-slate-600 font-mono text-[11px] whitespace-nowrap">{item.proveedor_nit || '---'}</td>
            <td className="py-1.5 px-2.5 text-center text-slate-600 font-mono text-[11px] whitespace-nowrap">{item.proveedor_nrc || '---'}</td>
            <td className="py-1.5 px-2.5 text-slate-600 font-mono text-[10px] whitespace-nowrap truncate max-w-[180px]" title={item.numero_resolucion}>
                {item.numero_resolucion || '---'}
            </td>
            <td className="py-1.5 px-2.5 text-slate-600 font-mono text-[10px] whitespace-nowrap truncate max-w-[180px]" title={item.serie_documento}>
                {item.serie_documento || '---'}
            </td>
            <td className="py-1.5 px-2.5 text-indigo-700 font-semibold font-mono text-[11px] whitespace-nowrap">
                {item.numero_documento || '---'}
            </td>
            <td className="py-1.5 px-2.5 text-slate-500 font-mono text-[11px] whitespace-nowrap">{item.doc_origen || '---'}</td>
            <td className="py-1.5 px-2.5 text-slate-600 font-medium whitespace-nowrap">{item.branch_name || 'Central'}</td>
            <td className="py-1.5 px-2.5 text-right font-medium text-slate-700 whitespace-nowrap">
                <Money value={item.monto_sujeto} />
            </td>
            <td className="py-1.5 px-2.5 text-right font-bold text-amber-600 whitespace-nowrap">
                <Money value={item.monto_retencion} />
            </td>
        </tr>
    );

    const renderCard = (item, index) => (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">#{item.corr || index + 1} ({item.origen.toUpperCase()})</span>
                <span className="text-xs font-medium text-slate-500">{formatDate(item.fecha)}</span>
            </div>
            <div className="font-semibold text-slate-800 text-sm">{item.proveedor_nombre}</div>
            <div className="text-xs text-slate-500 font-mono space-y-0.5">
                <div><span className="text-slate-400 font-sans font-medium">Resolución:</span> {item.numero_resolucion || '---'}</div>
                <div><span className="text-slate-400 font-sans font-medium">Serie:</span> {item.serie_documento || '---'}</div>
                <div><span className="text-slate-400 font-sans font-medium">Doc:</span> {item.numero_documento || '---'}</div>
                {item.doc_origen && item.doc_origen !== '---' && (
                    <div><span className="text-slate-400 font-sans font-medium">Origen:</span> {item.doc_origen}</div>
                )}
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">Monto Sujeto: <Money value={item.monto_sujeto} /></span>
                <span className="text-sm font-bold text-amber-600">Retención 1%: <Money value={item.monto_retencion} /></span>
            </div>
        </div>
    );

    return (
        <div className="space-y-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex items-center gap-3">
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                        <ArrowUpRight className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-[11px] font-bold text-slate-500 uppercase">Total Retención 1% Emitida</div>
                        <div className="text-lg font-bold text-amber-600">
                            <Money value={summary.total_retencion || 0} />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex items-center gap-3">
                    <div className="p-3 bg-slate-100 text-slate-700 rounded-xl">
                        <Scale className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-[11px] font-bold text-slate-500 uppercase">Monto Sujeto Gravado</div>
                        <div className="text-lg font-bold text-slate-800">
                            <Money value={summary.total_monto_sujeto || 0} />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex items-center gap-3">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                        <FileText className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-[11px] font-bold text-slate-500 uppercase">Retenciones Emitidas</div>
                        <div className="text-lg font-bold text-slate-800">
                            {summary.total_records || 0}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabla de Registros */}
            <Table
                headers={headers}
                data={items}
                renderRow={renderRow}
                renderCard={renderCard}
                isLoading={isLoading}
                compact={true}
                maxHeight="600px"
                containerClassName="table-scrollbar"
            />
        </div>
    );
};

export default RetencionesEmitidasTab;
