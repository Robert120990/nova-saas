import { ArrowDownLeft, Scale, FileText } from 'lucide-react';
import Table from '../../ui/Table';
import Money from '../../ui/Money';
import { formatDate } from '../../../utils/dateUtils';

const RetencionesRecibidasTab = ({
    data = [],
    summary = {},
    isLoading = false
}) => {
    const items = Array.isArray(data) ? data : [];

    const headers = [
        { label: '#', className: 'text-center w-10 whitespace-nowrap' },
        { label: 'Fecha', className: 'text-center w-24 whitespace-nowrap' },
        { label: 'Agente de Retención (Cliente)', className: 'w-60' },
        { label: 'NIT', className: 'text-center w-36 whitespace-nowrap' },
        { label: 'NRC', className: 'text-center w-24 whitespace-nowrap' },
        { label: 'Tipo Doc', className: 'text-center w-24 whitespace-nowrap' },
        { label: 'No. Doc / Control', className: 'w-44 whitespace-nowrap' },
        { label: 'Código Generación', className: 'w-44 whitespace-nowrap' },
        { label: 'Sucursal', className: 'w-32 whitespace-nowrap' },
        { label: 'Venta Gravada', className: 'text-right w-28 whitespace-nowrap' },
        { label: 'Débito Fiscal', className: 'text-right w-24 whitespace-nowrap' },
        { label: 'Retención 1%', className: 'text-right w-28 whitespace-nowrap' },
        { label: 'Total Venta', className: 'text-right w-28 whitespace-nowrap' }
    ];

    const renderRow = (item, index) => (
        <tr key={item.id || index} className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 text-[11px]">
            <td className="py-1.5 px-2.5 text-center font-semibold text-slate-400 whitespace-nowrap">{item.corr || index + 1}</td>
            <td className="py-1.5 px-2.5 text-center text-slate-600 font-medium whitespace-nowrap">{formatDate(item.fecha)}</td>
            <td className="py-1.5 px-2.5 font-semibold text-slate-800 whitespace-nowrap">
                <div className="truncate max-w-xs" title={item.cliente_nombre}>{item.cliente_nombre}</div>
            </td>
            <td className="py-1.5 px-2.5 text-center text-slate-600 font-mono text-[11px] whitespace-nowrap">{item.cliente_nit || '---'}</td>
            <td className="py-1.5 px-2.5 text-center text-slate-600 font-mono text-[11px] whitespace-nowrap">{item.cliente_nrc || '---'}</td>
            <td className="py-1.5 px-2.5 text-center whitespace-nowrap">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase whitespace-nowrap ${
                    item.tipo_documento === '06'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                }`}>
                    {item.tipo_documento === '06' ? 'Retención (06)' : item.tipo_documento || '03'}
                </span>
            </td>
            <td className="py-1.5 px-2.5 text-indigo-700 font-semibold font-mono text-[11px] truncate max-w-xs whitespace-nowrap" title={item.numero_control}>
                {item.numero_control || '---'}
            </td>
            <td className="py-1.5 px-2.5 text-slate-500 font-mono text-[10px] truncate max-w-xs whitespace-nowrap" title={item.codigo_generacion}>
                {item.codigo_generacion || '---'}
            </td>
            <td className="py-1.5 px-2.5 text-slate-600 font-medium whitespace-nowrap">{item.branch_name || 'Central'}</td>
            <td className="py-1.5 px-2.5 text-right font-medium text-slate-700 whitespace-nowrap">
                <Money value={item.monto_sujeto} />
            </td>
            <td className="py-1.5 px-2.5 text-right font-medium text-slate-500 whitespace-nowrap">
                <Money value={item.total_iva} />
            </td>
            <td className="py-1.5 px-2.5 text-right font-bold text-emerald-600 whitespace-nowrap">
                <Money value={item.monto_retencion} />
            </td>
            <td className="py-1.5 px-2.5 text-right font-semibold text-slate-800 whitespace-nowrap">
                <Money value={item.total_pagar} />
            </td>
        </tr>
    );

    const renderCard = (item, index) => (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">#{item.corr || index + 1} ({item.tipo_documento})</span>
                <span className="text-xs font-medium text-slate-500">{formatDate(item.fecha)}</span>
            </div>
            <div className="font-semibold text-slate-800 text-sm">{item.cliente_nombre}</div>
            <div className="text-xs text-slate-500 font-mono">Control: {item.numero_control || '---'}</div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">Gravado: <Money value={item.monto_sujeto} /></span>
                <span className="text-sm font-bold text-emerald-600">Retención 1%: <Money value={item.monto_retencion} /></span>
            </div>
        </div>
    );

    return (
        <div className="space-y-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex items-center gap-3">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                        <ArrowDownLeft className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-[11px] font-bold text-slate-500 uppercase">Total Retención 1% Recibida</div>
                        <div className="text-lg font-bold text-emerald-600">
                            <Money value={summary.total_retencion || 0} />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex items-center gap-3">
                    <div className="p-3 bg-slate-100 text-slate-700 rounded-xl">
                        <Scale className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-[11px] font-bold text-slate-500 uppercase">Ventas Gravadas Sujetas</div>
                        <div className="text-lg font-bold text-slate-800">
                            <Money value={summary.total_monto_sujeto || 0} />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex items-center gap-3">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                        <FileText className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-[11px] font-bold text-slate-500 uppercase">Ventas con Retención</div>
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

export default RetencionesRecibidasTab;
