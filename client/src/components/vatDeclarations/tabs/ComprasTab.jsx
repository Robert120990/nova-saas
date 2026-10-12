import { ShoppingBag, Receipt, Scale, FileText } from 'lucide-react';
import Table from '../../ui/Table';
import Money from '../../ui/Money';
import { formatDate } from '../../../utils/dateUtils';

const ComprasTab = ({
    data = [],
    summary = {},
    isLoading = false
}) => {
    const items = Array.isArray(data) ? data : [];

    const headers = [
        { label: '#', className: 'text-center w-10 whitespace-nowrap' },
        { label: 'Fecha', className: 'text-center w-24 whitespace-nowrap' },
        { label: 'Tipo Doc', className: 'text-center w-24 whitespace-nowrap' },
        { label: 'No. Documento', className: 'w-32 whitespace-nowrap' },
        { label: 'Código Generación', className: 'w-44 whitespace-nowrap' },
        { label: 'Proveedor', className: 'w-60' },
        { label: 'NIT', className: 'text-center w-32 whitespace-nowrap' },
        { label: 'NRC', className: 'text-center w-24 whitespace-nowrap' },
        { label: 'Sucursal', className: 'w-28 whitespace-nowrap' },
        { label: 'Gravadas', className: 'text-right w-24 whitespace-nowrap' },
        { label: 'Exentas', className: 'text-right w-20 whitespace-nowrap' },
        { label: 'IVA', className: 'text-right w-20 whitespace-nowrap' },
        { label: 'No Sujeta', className: 'text-right w-20 whitespace-nowrap' },
        { label: 'Ret / Per', className: 'text-right w-20 whitespace-nowrap' },
        { label: 'Ant. Cta', className: 'text-right w-20 whitespace-nowrap' },
        { label: 'Total', className: 'text-right w-24 whitespace-nowrap' }
    ];

    const renderRow = (item, index) => {
        const isNC = item.tipo_documento_id === '09' ||
            item.tipo_doc_nombre?.toLowerCase().includes('crédito') ||
            item.tipo_doc_nombre?.toLowerCase().includes('credito');

        const retPer = (item.retencion || 0) + (item.percepcion || 0);

        return (
            <tr key={item.id || index} className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 text-[11px]">
                <td className="py-1.5 px-2.5 text-center font-semibold text-slate-400 whitespace-nowrap">{item.corr || index + 1}</td>
                <td className="py-1.5 px-2.5 text-center text-slate-600 font-medium whitespace-nowrap">{formatDate(item.fecha)}</td>
                <td className="py-1.5 px-2.5 text-center whitespace-nowrap">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
                        isNC
                            ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                    }`}>
                        {item.tipo_doc_nombre || 'Créd. Fiscal'}
                    </span>
                </td>
                <td className="py-1.5 px-2.5 text-slate-700 font-medium font-mono text-[11px] whitespace-nowrap">
                    <span>{item.numero_documento || '---'}</span>
                    {item.documento_afectado && (
                        <span className="block text-[10px] text-slate-400 font-normal">Af: {item.documento_afectado}</span>
                    )}
                </td>
                <td className="py-1.5 px-2.5 text-slate-500 font-mono text-[10px] truncate max-w-xs whitespace-nowrap" title={item.codigo_generacion}>
                    {item.codigo_generacion || '---'}
                </td>
                <td className="py-1.5 px-2.5 font-semibold text-slate-800 whitespace-nowrap">
                    <div className="truncate max-w-xs" title={item.proveedor_nombre}>{item.proveedor_nombre}</div>
                </td>
                <td className="py-1.5 px-2.5 text-center text-slate-600 font-mono text-[11px] whitespace-nowrap">
                    {item.proveedor_nit || '---'}
                </td>
                <td className="py-1.5 px-2.5 text-center text-slate-600 font-mono text-[11px] whitespace-nowrap">
                    {item.proveedor_nrc || '---'}
                </td>
                <td className="py-1.5 px-2.5 text-slate-600 font-medium whitespace-nowrap">{item.branch_name || 'Central'}</td>
                <td className="py-1.5 px-2.5 text-right font-medium text-slate-700 whitespace-nowrap">
                    <Money value={item.total_gravada} />
                </td>
                <td className="py-1.5 px-2.5 text-right font-medium text-slate-500 whitespace-nowrap">
                    <Money value={item.total_exenta} />
                </td>
                <td className="py-1.5 px-2.5 text-right font-medium text-sky-700 whitespace-nowrap">
                    <Money value={item.iva} />
                </td>
                <td className="py-1.5 px-2.5 text-right font-medium text-slate-500 whitespace-nowrap">
                    <Money value={item.total_nosujeta} />
                </td>
                <td className="py-1.5 px-2.5 text-right font-medium text-amber-700 whitespace-nowrap">
                    <Money value={retPer} />
                </td>
                <td className="py-1.5 px-2.5 text-right font-medium text-slate-500 whitespace-nowrap">
                    <Money value={item.anticipo_cuenta || 0} />
                </td>
                <td className="py-1.5 px-2.5 text-right font-bold text-slate-800 whitespace-nowrap">
                    <Money value={item.monto_total} />
                </td>
            </tr>
        );
    };

    const renderCard = (item, index) => (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">#{item.corr || index + 1} ({item.tipo_doc_nombre})</span>
                <span className="text-xs font-medium text-slate-500">{formatDate(item.fecha)}</span>
            </div>
            <div className="font-semibold text-slate-800 text-sm">{item.proveedor_nombre}</div>
            <div className="text-xs text-slate-500 font-mono truncate" title={item.codigo_generacion}>
                Doc: {item.numero_documento} | Cód. Gen: {item.codigo_generacion || '---'}
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">Gravadas: <Money value={item.total_gravada} /></span>
                <span className="text-sm font-bold text-slate-800">Total: <Money value={item.monto_total} /></span>
            </div>
        </div>
    );

    return (
        <div className="space-y-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex items-center gap-3">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                        <ShoppingBag className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-[11px] font-bold text-slate-500 uppercase">Total Compras</div>
                        <div className="text-lg font-bold text-indigo-600">
                            <Money value={summary.total_compras || 0} />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex items-center gap-3">
                    <div className="p-3 bg-sky-50 text-sky-600 rounded-xl">
                        <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-[11px] font-bold text-slate-500 uppercase">Crédito Fiscal IVA</div>
                        <div className="text-lg font-bold text-sky-600">
                            <Money value={summary.total_iva || 0} />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex items-center gap-3">
                    <div className="p-3 bg-slate-100 text-slate-700 rounded-xl">
                        <Scale className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-[11px] font-bold text-slate-500 uppercase">Compras Gravadas</div>
                        <div className="text-lg font-bold text-slate-800">
                            <Money value={summary.total_gravada || 0} />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex items-center gap-3">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                        <FileText className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-[11px] font-bold text-slate-500 uppercase">Comprobantes Registrados</div>
                        <div className="text-lg font-bold text-slate-800">
                            {summary.total_records || 0}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabla de Compras */}
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

export default ComprasTab;
