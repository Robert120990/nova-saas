import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import Modal from '../ui/Modal';
import Money from '../ui/Money';
import { 
    FileText, 
    ArrowUpCircle, 
    ArrowDownCircle, 
    Calendar, 
    Building, 
    ShoppingCart, 
    Truck, 
    Package, 
    CreditCard, 
    Banknote, 
    Download, 
    Copy, 
    Check, 
    AlertCircle, 
    Info, 
    Layers, 
    Receipt
} from 'lucide-react';
import { toast } from 'sonner';

const formatDate = (dateString) => {
    if (!dateString) return '---';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '---';
    return new Intl.DateTimeFormat('es-SV', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(date);
};

const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('es-SV', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).format(date);
};

const KardexOriginModal = ({ movementId, movement, isOpen, onClose }) => {
    const [copiedUUID, setCopiedUUID] = useState(false);
    const [downloadingPDF, setDownloadingPDF] = useState(false);

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['kardex-origin', movementId],
        queryFn: async () => (await axios.get(`/api/inventory/kardex/origin/${movementId}`)).data,
        enabled: !!movementId && isOpen,
        staleTime: 1000 * 60 * 5
    });

    const mov = data?.movement || movement;
    const originType = data?.origin_type || 'generic';
    const header = data?.header || {};
    const items = Array.isArray(data?.items) ? data.items : [];
    const payments = Array.isArray(data?.payments) ? data.payments : [];

    const handleCopyUUID = (uuid) => {
        if (!uuid) return;
        navigator.clipboard.writeText(uuid);
        setCopiedUUID(true);
        toast.success('Código de generación copiado');
        setTimeout(() => setCopiedUUID(false), 2000);
    };

    const handleDownloadSalePDF = async (saleId, codGen) => {
        if (!saleId) return;
        setDownloadingPDF(true);
        try {
            const response = await axios.get(`/api/sales/rtee/${saleId}`, {
                responseType: 'blob'
            });
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${codGen || `Venta-${saleId}`}.pdf`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success('Descargando representación gráfica DTE');
        } catch (err) {
            console.error('Error al descargar PDF:', err);
            toast.error('Error al descargar el PDF de la venta');
        } finally {
            setDownloadingPDF(false);
        }
    };

    const handleDownloadPurchasePDF = async (purchaseId, numDoc) => {
        if (!purchaseId) return;
        setDownloadingPDF(true);
        try {
            const response = await axios.get(`/api/purchases/pdf/${purchaseId}`, {
                responseType: 'blob'
            });
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Compra_${numDoc || purchaseId}.pdf`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.success('Descargando comprobante de compra');
        } catch (err) {
            console.error('Error al descargar PDF:', err);
            toast.error('Error al descargar el PDF de la compra');
        } finally {
            setDownloadingPDF(false);
        }
    };

    const getOriginBadge = () => {
        switch (originType) {
            case 'sale':
                return {
                    label: 'Venta / Facturación',
                    color: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
                    icon: ShoppingCart
                };
            case 'purchase':
                return {
                    label: 'Compra a Proveedor',
                    color: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
                    icon: Truck
                };
            case 'adjustment':
                return {
                    label: 'Ajuste de Inventario',
                    color: 'bg-amber-50 text-amber-700 border-amber-200/80',
                    icon: Layers
                };
            case 'transfer':
                return {
                    label: 'Traslado entre Sucursales',
                    color: 'bg-cyan-50 text-cyan-700 border-cyan-200/80',
                    icon: Building
                };
            case 'physical_inventory':
                return {
                    label: 'Conteo Físico',
                    color: 'bg-purple-50 text-purple-700 border-purple-200/80',
                    icon: Package
                };
            case 'gas_closeout':
                return {
                    label: 'Cierre de Turno Gasolinera',
                    color: 'bg-orange-50 text-orange-700 border-orange-200/80',
                    icon: Receipt
                };
            default:
                return {
                    label: 'Movimiento Interno',
                    color: 'bg-slate-100 text-slate-700 border-slate-200',
                    icon: FileText
                };
        }
    };

    const badge = getOriginBadge();
    const BadgeIcon = badge.icon;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Detalle del Origen del Registro"
            maxWidth="max-w-4xl"
        >
            <div className="space-y-5">
                {/* 1. Tarjeta Resumen del Movimiento en Kárdex */}
                {mov && (
                    <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/70 pb-3 mb-3">
                            <div className="flex items-center gap-2.5">
                                <div className={`p-2 rounded-xl border flex items-center justify-center shrink-0 ${
                                    mov.tipo_movimiento === 'ENTRADA' 
                                        ? 'bg-emerald-100/70 text-emerald-700 border-emerald-300/60' 
                                        : 'bg-rose-100/70 text-rose-700 border-rose-300/60'
                                }`}>
                                    {mov.tipo_movimiento === 'ENTRADA' ? (
                                        <ArrowUpCircle size={18} className="shrink-0" />
                                    ) : (
                                        <ArrowDownCircle size={18} className="shrink-0" />
                                    )}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                            Movimiento Kárdex #{mov.id}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                            mov.tipo_movimiento === 'ENTRADA'
                                                ? 'bg-emerald-100 text-emerald-800'
                                                : 'bg-rose-100 text-rose-800'
                                        }`}>
                                            {mov.tipo_movimiento} ({mov.tipo_movimiento === 'ENTRADA' ? '+' : '-'}{parseFloat(mov.cantidad || 0)})
                                        </span>
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.color}`}>
                                            <BadgeIcon size={11} />
                                            <span>{badge.label}</span>
                                        </span>
                                    </div>
                                    <h4 className="text-sm font-black text-slate-900 leading-tight mt-0.5">
                                        {mov.producto_nombre ? `${mov.producto_nombre} (${mov.producto_codigo || 'S/C'})` : 'Producto en Kárdex'}
                                    </h4>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-right shrink-0">
                                <div>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Fecha de Registro</span>
                                    <div className="flex items-center gap-1 text-slate-700 font-bold text-xs">
                                        <Calendar size={12} className="text-slate-400" />
                                        <span>{formatDate(mov.created_at)}</span>
                                        <span className="font-mono text-[11px] text-slate-400 ml-0.5">{formatTime(mov.created_at)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/70">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Documento Ref.</span>
                                <span className="font-bold text-slate-800 truncate block mt-0.5 font-mono">
                                    {mov.tipo_documento} {mov.documento_id ? `#${mov.documento_id}` : ''}
                                </span>
                            </div>
                            <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/70">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Cantidad Movida</span>
                                <span className={`font-black text-xs block mt-0.5 ${mov.tipo_movimiento === 'ENTRADA' ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {mov.tipo_movimiento === 'ENTRADA' ? '+' : '-'}{parseFloat(mov.cantidad || 0)} {mov.unidad_medida || 'Uds'}
                                </span>
                            </div>
                            <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/70">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Precio Unitario</span>
                                <span className="font-bold text-slate-800 block mt-0.5">
                                    <Money value={mov.precio_venta} />
                                </span>
                            </div>
                            <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/70">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Sucursal</span>
                                <span className="font-bold text-slate-800 truncate block mt-0.5">
                                    {mov.branch_nombre || 'Sucursal Asignada'}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. Estado de Carga */}
                {isLoading && (
                    <div className="flex flex-col items-center justify-center py-16 space-y-3">
                        <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Consultando detalles del origen...
                        </p>
                    </div>
                )}

                {/* 3. Error en la consulta */}
                {isError && (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
                        <AlertCircle className="text-rose-600 shrink-0 mt-0.5" size={18} />
                        <div>
                            <h5 className="text-xs font-black text-rose-900 uppercase">Error al consultar el origen</h5>
                            <p className="text-xs text-rose-700 mt-0.5">
                                {error?.response?.data?.message || error?.message || 'No fue posible cargar el origen de este registro.'}
                            </p>
                        </div>
                    </div>
                )}

                {/* 4. Origen: VENTA / FACTURA DTE */}
                {!isLoading && data && originType === 'sale' && (
                    <div className="space-y-4 animate-in fade-in duration-150">
                        {/* Cabecera del Documento de Venta */}
                        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                                        <FileText size={18} />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">
                                            {header.tipo_documento_nombre || `Documento ${header.tipo_documento || 'DTE'}`}
                                        </span>
                                        <h3 className="text-base font-black text-slate-900 leading-tight">
                                            {header.numero_control || `Venta #${header.id}`}
                                        </h3>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {header.codigo_generacion && (
                                        <button
                                            type="button"
                                            onClick={() => handleDownloadSalePDF(header.id, header.codigo_generacion)}
                                            disabled={downloadingPDF}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold border border-rose-200 transition-colors cursor-pointer"
                                            title="Descargar Representación Gráfica PDF"
                                        >
                                            <Download size={13} />
                                            <span>{downloadingPDF ? 'Descargando...' : 'Descargar PDF'}</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Datos Clave de la Venta */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                                <div>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Cliente</span>
                                    <span className="font-bold text-slate-800 block mt-0.5">
                                        {header.cliente_nombre || 'Consumidor Final'}
                                    </span>
                                    {header.cliente_nrc && (
                                        <span className="text-[10px] text-slate-500 font-mono block">NRC: {header.cliente_nrc}</span>
                                    )}
                                    {header.cliente_documento && (
                                        <span className="text-[10px] text-slate-500 font-mono block">Doc: {header.cliente_documento}</span>
                                    )}
                                </div>

                                <div>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Fecha de Emisión</span>
                                    <span className="font-bold text-slate-800 block mt-0.5">
                                        {formatDate(header.fecha_emision)} {header.hora_emision ? `• ${header.hora_emision}` : ''}
                                    </span>
                                    <span className="text-[10px] text-slate-500 block mt-0.5">
                                        Condición: {header.condicion_operacion === 2 ? 'Crédito' : 'Contado'}
                                    </span>
                                </div>

                                <div>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Sucursal / Vendedor</span>
                                    <span className="font-bold text-slate-800 block mt-0.5">
                                        {header.branch_nombre || 'Sucursal Principal'}
                                    </span>
                                    <span className="text-[10px] text-slate-500 block">
                                        Vendedor: {header.vendedor_nombre || 'Sistema'}
                                    </span>
                                </div>

                                {header.codigo_generacion && (
                                    <div className="col-span-1 sm:col-span-2 md:col-span-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest block">
                                                Código de Generación DTE (UUID)
                                            </span>
                                            <span className="font-mono text-xs font-bold text-slate-800 truncate block">
                                                {header.codigo_generacion}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleCopyUUID(header.codigo_generacion)}
                                            className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1 text-[11px] font-bold shrink-0 cursor-pointer"
                                            title="Copiar Código de Generación"
                                        >
                                            {copiedUUID ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                                            <span>{copiedUUID ? 'Copiado' : 'Copiar'}</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Tabla de Productos de la Venta */}
                        <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
                            <div className="bg-slate-50/70 px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase text-slate-600 tracking-wider">
                                    Productos Incluidos en la Venta ({items.length})
                                </span>
                                <span className="text-[10px] text-slate-400 font-bold">
                                    Fila resaltada corresponde al Kárdex
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50/40 text-[9px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                        <tr>
                                            <th className="px-3.5 py-2">Código</th>
                                            <th className="px-3.5 py-2">Descripción</th>
                                            <th className="px-3.5 py-2 text-right">Cantidad</th>
                                            <th className="px-3.5 py-2 text-right">Precio Unit.</th>
                                            <th className="px-3.5 py-2 text-right">Descuento</th>
                                            <th className="px-3.5 py-2 text-right">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {items.map((it, idx) => {
                                            const isMatchingProduct = mov && String(it.product_id) === String(mov.product_id);
                                            const cant = parseFloat(it.cantidad || 0);
                                            const pUnit = parseFloat(it.precio_unitario || 0);
                                            const desc = parseFloat(it.monto_descuento || 0);
                                            const subtotal = (cant * pUnit) - desc;

                                            return (
                                                <tr 
                                                    key={it.id || idx}
                                                    className={`transition-colors ${
                                                        isMatchingProduct 
                                                            ? 'bg-amber-50/60 font-semibold hover:bg-amber-50' 
                                                            : 'hover:bg-slate-50/60'
                                                    }`}
                                                >
                                                    <td className="px-3.5 py-2 font-mono text-[11px] font-bold text-slate-600 whitespace-nowrap">
                                                        {it.producto_codigo || it.codigo || '—'}
                                                    </td>
                                                    <td className="px-3.5 py-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-bold text-slate-800">{it.producto_nombre || it.descripcion || 'Producto'}</span>
                                                            {isMatchingProduct && (
                                                                <span className="px-1.5 py-0.5 bg-amber-200/70 text-amber-900 rounded text-[9px] font-black uppercase shrink-0">
                                                                    Actual
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-3.5 py-2 text-right font-black text-slate-900 whitespace-nowrap">
                                                        {cant} {it.unidad_medida || ''}
                                                    </td>
                                                    <td className="px-3.5 py-2 text-right text-slate-700 whitespace-nowrap">
                                                        <Money value={pUnit} />
                                                    </td>
                                                    <td className="px-3.5 py-2 text-right text-rose-600 whitespace-nowrap">
                                                        {desc > 0 ? <>-<Money value={desc} /></> : '—'}
                                                    </td>
                                                    <td className="px-3.5 py-2 text-right font-black text-slate-900 whitespace-nowrap">
                                                        <Money value={subtotal} />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Desglose de Totales y Pagos */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Formas de Pago */}
                            <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-xs space-y-2">
                                <div className="flex items-center gap-1.5 text-xs font-black uppercase text-slate-500 tracking-wider">
                                    <CreditCard size={14} className="text-indigo-600" />
                                    <span>Formas de Pago</span>
                                </div>
                                {payments.length > 0 ? (
                                    <div className="space-y-1.5">
                                        {payments.map((p, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-xl text-xs">
                                                <div className="flex items-center gap-2 font-bold text-slate-700">
                                                    <Banknote size={13} className="text-emerald-600" />
                                                    <span>{p.metodo_pago_nombre || (p.metodo_pago === '01' ? 'Efectivo' : 'Tarjeta / Transferencia')}</span>
                                                </div>
                                                <span className="font-black text-slate-900">
                                                    <Money value={p.monto} />
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-400 italic py-2">Sin desglose de pagos disponible</p>
                                )}
                            </div>

                            {/* Resumen de Montos */}
                            <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-xs space-y-2.5">
                                <div className="space-y-1 text-[11px] font-bold uppercase opacity-85">
                                    <div className="flex justify-between border-b border-white/10 pb-1">
                                        <span>Total Gravado:</span>
                                        <span><Money value={header.total_gravado || 0} /></span>
                                    </div>
                                    <div className="flex justify-between border-b border-white/10 pb-1">
                                        <span>Total IVA (13%):</span>
                                        <span><Money value={header.total_iva || 0} /></span>
                                    </div>
                                    {parseFloat(header.total_exento || 0) > 0 && (
                                        <div className="flex justify-between border-b border-white/10 pb-1">
                                            <span>Total Exento:</span>
                                            <span><Money value={header.total_exento} /></span>
                                        </div>
                                    )}
                                    {parseFloat(header.iva_retenido || 0) > 0 && (
                                        <div className="flex justify-between border-b border-white/10 pb-1 text-rose-300">
                                            <span>IVA Retenido (-1%):</span>
                                            <span>-<Money value={header.iva_retenido} /></span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-end justify-between pt-1 border-t border-white/20">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
                                        Total Pagado
                                    </span>
                                    <span className="text-2xl font-black tracking-tight text-white">
                                        <Money value={header.total_pagar || header.monto_total || 0} />
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 5. Origen: COMPRA A PROVEEDOR */}
                {!isLoading && data && originType === 'purchase' && (
                    <div className="space-y-4 animate-in fade-in duration-150">
                        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                                        <Truck size={18} />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">
                                            {header.tipo_documento_nombre || 'Comprobante de Compra'}
                                        </span>
                                        <h3 className="text-base font-black text-slate-900 leading-tight">
                                            {header.numero_documento || `Compra #${header.id}`}
                                        </h3>
                                    </div>
                                </div>
                                <div>
                                    <button
                                        type="button"
                                        onClick={() => handleDownloadPurchasePDF(header.id, header.numero_documento)}
                                        disabled={downloadingPDF}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200 transition-colors cursor-pointer"
                                        title="Descargar Comprobante PDF"
                                    >
                                        <Download size={13} />
                                        <span>{downloadingPDF ? 'Descargando...' : 'Descargar PDF'}</span>
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                                <div>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Proveedor</span>
                                    <span className="font-bold text-slate-800 block mt-0.5">
                                        {header.provider_nombre || 'Proveedor Desconocido'}
                                    </span>
                                    {header.provider_nrc && <span className="text-[10px] text-slate-500 font-mono block">NRC: {header.provider_nrc}</span>}
                                    {header.provider_nit && <span className="text-[10px] text-slate-500 font-mono block">NIT: {header.provider_nit}</span>}
                                </div>

                                <div>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Fecha de Compra</span>
                                    <span className="font-bold text-slate-800 block mt-0.5">
                                        {formatDate(header.fecha)}
                                    </span>
                                    <span className="text-[10px] text-slate-500 block mt-0.5">
                                        Condición: {header.condicion_operacion_nombre || (String(header.condicion_operacion_id) === '2' ? 'Crédito' : 'Contado')}
                                    </span>
                                    {header.dias_credito > 0 && (
                                        <span className="text-[10px] text-amber-600 font-bold block">
                                            {header.dias_credito} días (Vence: {formatDate(header.fecha_vencimiento)})
                                        </span>
                                    )}
                                </div>

                                <div>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Sucursal / Estado</span>
                                    <span className="font-bold text-slate-800 block mt-0.5">
                                        {header.branch_nombre || 'Sucursal Principal'}
                                    </span>
                                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                                        header.status === 'ANULADO' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'
                                    }`}>
                                        {header.status || 'APLICADO'}
                                    </span>
                                </div>

                                {header.numero_control && (
                                    <div>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Número de Control</span>
                                        <span className="font-mono font-bold text-slate-700 block mt-0.5">{header.numero_control}</span>
                                    </div>
                                )}

                                {header.sello_recepcion && (
                                    <div className="col-span-1 sm:col-span-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                                        <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest block">
                                            Sello de Recepción MH
                                        </span>
                                        <span className="font-mono text-xs font-bold text-slate-700 break-all block mt-0.5">
                                            {header.sello_recepcion}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Tabla de Productos Comprados */}
                        <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
                            <div className="bg-slate-50/70 px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase text-slate-600 tracking-wider">
                                    Productos de la Compra ({items.length})
                                </span>
                                <span className="text-[10px] text-slate-400 font-bold">
                                    Fila resaltada corresponde al Kárdex
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50/40 text-[9px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                        <tr>
                                            <th className="px-3.5 py-2">Código</th>
                                            <th className="px-3.5 py-2">Descripción</th>
                                            <th className="px-3.5 py-2 text-right">Cantidad</th>
                                            <th className="px-3.5 py-2 text-right">Costo Unit.</th>
                                            <th className="px-3.5 py-2 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {items.map((it, idx) => {
                                            const isMatching = mov && String(it.product_id) === String(mov.product_id);
                                            const cant = parseFloat(it.cantidad || 0);
                                            const cost = parseFloat(it.precio_unitario || it.costo || 0);
                                            const tot = parseFloat(it.total || (cant * cost));

                                            return (
                                                <tr 
                                                    key={it.id || idx}
                                                    className={`transition-colors ${
                                                        isMatching 
                                                            ? 'bg-amber-50/60 font-semibold hover:bg-amber-50' 
                                                            : 'hover:bg-slate-50/60'
                                                    }`}
                                                >
                                                    <td className="px-3.5 py-2 font-mono text-[11px] font-bold text-slate-600 whitespace-nowrap">
                                                        {it.codigo || '—'}
                                                    </td>
                                                    <td className="px-3.5 py-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-bold text-slate-800">{it.nombre || 'Producto'}</span>
                                                            {isMatching && (
                                                                <span className="px-1.5 py-0.5 bg-amber-200/70 text-amber-900 rounded text-[9px] font-black uppercase shrink-0">
                                                                    Actual
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-3.5 py-2 text-right font-black text-slate-900 whitespace-nowrap">
                                                        {cant} {it.unidad_medida || ''}
                                                    </td>
                                                    <td className="px-3.5 py-2 text-right text-slate-700 whitespace-nowrap">
                                                        <Money value={cost} />
                                                    </td>
                                                    <td className="px-3.5 py-2 text-right font-black text-slate-900 whitespace-nowrap">
                                                        <Money value={tot} />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Desglose de Totales de Compra */}
                        <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-xs">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] font-bold uppercase opacity-85 border-b border-white/10 pb-3 mb-3">
                                <div>
                                    <span className="text-[9px] text-slate-400 block">Gravada:</span>
                                    <span className="text-white text-xs"><Money value={header.total_gravada || 0} /></span>
                                </div>
                                <div>
                                    <span className="text-[9px] text-slate-400 block">IVA:</span>
                                    <span className="text-white text-xs"><Money value={header.iva || 0} /></span>
                                </div>
                                <div>
                                    <span className="text-[9px] text-slate-400 block">Exenta / No Sujeta:</span>
                                    <span className="text-white text-xs"><Money value={(parseFloat(header.total_exenta || 0) + parseFloat(header.total_nosujeta || 0))} /></span>
                                </div>
                                <div>
                                    <span className="text-[9px] text-slate-400 block">Retención / Percepción:</span>
                                    <span className="text-white text-xs"><Money value={(parseFloat(header.retencion || 0) + parseFloat(header.percepcion || 0))} /></span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                                    Monto Total de Compra
                                </span>
                                <span className="text-2xl font-black text-white">
                                    <Money value={header.monto_total || 0} />
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* 6. Origen: AJUSTE / INVENTARIO INICIAL */}
                {!isLoading && data && originType === 'adjustment' && (
                    <div className="space-y-4 animate-in fade-in duration-150">
                        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                                        <Layers size={18} />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black uppercase text-amber-600 tracking-wider">
                                            Ajuste #{header.numero || header.id}
                                        </span>
                                        <h3 className="text-base font-black text-slate-900 leading-tight">
                                            {header.motivo_name || 'Ajuste de Inventario'}
                                        </h3>
                                    </div>
                                </div>
                                <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase ${
                                    header.tipo === 'ENTRADA' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                }`}>
                                    {header.tipo || mov?.tipo_movimiento}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                <div>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Sucursal</span>
                                    <span className="font-bold text-slate-800 block mt-0.5">{header.branch_name || '—'}</span>
                                </div>
                                <div>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Fecha de Registro</span>
                                    <span className="font-bold text-slate-800 block mt-0.5">{formatDate(header.fecha)}</span>
                                </div>
                                <div>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Registrado Por</span>
                                    <span className="font-bold text-slate-800 block mt-0.5">{header.usuario_nombre || 'Sistema'}</span>
                                </div>
                            </div>

                            {header.observaciones && (
                                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 text-xs">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Observaciones</span>
                                    <p className="text-slate-700 italic">{header.observaciones}</p>
                                </div>
                            )}
                        </div>

                        {/* Items del Ajuste */}
                        <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
                            <div className="bg-slate-50/70 px-4 py-2 border-b border-slate-100">
                                <span className="text-[10px] font-black uppercase text-slate-600 tracking-wider">
                                    Productos del Ajuste ({items.length})
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50/40 text-[9px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                        <tr>
                                            <th className="px-3.5 py-2">Código</th>
                                            <th className="px-3.5 py-2">Producto</th>
                                            <th className="px-3.5 py-2 text-right">Cantidad</th>
                                            <th className="px-3.5 py-2 text-right">Costo Unit.</th>
                                            <th className="px-3.5 py-2 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {items.map((it, idx) => {
                                            const isMatching = mov && String(it.product_id) === String(mov.product_id);
                                            const cant = parseFloat(it.cantidad || 0);
                                            const cost = parseFloat(it.costo || 0);
                                            const tot = parseFloat(it.total || (cant * cost));

                                            return (
                                                <tr key={it.id || idx} className={isMatching ? 'bg-amber-50/60 font-semibold' : ''}>
                                                    <td className="px-3.5 py-2 font-mono text-[11px] font-bold text-slate-600">{it.codigo || '—'}</td>
                                                    <td className="px-3.5 py-2 font-bold text-slate-800">
                                                        {it.nombre || it.producto_nombre || 'Producto'}
                                                        {isMatching && <span className="ml-1.5 px-1.5 py-0.5 bg-amber-200/70 text-amber-900 rounded text-[9px] font-black uppercase">Actual</span>}
                                                    </td>
                                                    <td className="px-3.5 py-2 text-right font-black text-slate-900">{cant}</td>
                                                    <td className="px-3.5 py-2 text-right text-slate-700"><Money value={cost} /></td>
                                                    <td className="px-3.5 py-2 text-right font-black text-indigo-700"><Money value={tot} /></td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* 7. Origen: TRASLADO ENTRE SUCURSALES */}
                {!isLoading && data && originType === 'transfer' && (
                    <div className="space-y-4 animate-in fade-in duration-150">
                        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2 bg-cyan-50 text-cyan-700 rounded-xl">
                                        <Building size={18} />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black uppercase text-cyan-700 tracking-wider">
                                            Traslado TR-{String(header.id).padStart(6, '0')}
                                        </span>
                                        <h3 className="text-base font-black text-slate-900 leading-tight">
                                            {header.origen_nombre} ➔ {header.destino_nombre}
                                        </h3>
                                    </div>
                                </div>
                                <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase bg-cyan-100 text-cyan-800">
                                    {header.status || 'COMPLETADO'}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                <div>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Sucursal Origen</span>
                                    <span className="font-bold text-slate-800 block mt-0.5">{header.origen_nombre}</span>
                                </div>
                                <div>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Sucursal Destino</span>
                                    <span className="font-bold text-indigo-600 block mt-0.5">{header.destino_nombre}</span>
                                </div>
                                <div>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Registrado Por</span>
                                    <span className="font-bold text-slate-800 block mt-0.5">{header.usuario_nombre || 'Sistema'}</span>
                                </div>
                            </div>

                            {header.observaciones && (
                                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 text-xs">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Observaciones</span>
                                    <p className="text-slate-700 italic">{header.observaciones}</p>
                                </div>
                            )}
                        </div>

                        {/* Items del Traslado */}
                        <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
                            <div className="bg-slate-50/70 px-4 py-2 border-b border-slate-100">
                                <span className="text-[10px] font-black uppercase text-slate-600 tracking-wider">
                                    Productos Trasladados ({items.length})
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50/40 text-[9px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                        <tr>
                                            <th className="px-3.5 py-2">Código</th>
                                            <th className="px-3.5 py-2">Producto</th>
                                            <th className="px-3.5 py-2 text-right">Cantidad</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {items.map((it, idx) => {
                                            const isMatching = mov && String(it.product_id) === String(mov.product_id);
                                            return (
                                                <tr key={it.id || idx} className={isMatching ? 'bg-amber-50/60 font-semibold' : ''}>
                                                    <td className="px-3.5 py-2 font-mono text-[11px] font-bold text-slate-600">{it.codigo || '—'}</td>
                                                    <td className="px-3.5 py-2 font-bold text-slate-800">
                                                        {it.nombre || it.producto_nombre || 'Producto'}
                                                        {isMatching && <span className="ml-1.5 px-1.5 py-0.5 bg-amber-200/70 text-amber-900 rounded text-[9px] font-black uppercase">Actual</span>}
                                                    </td>
                                                    <td className="px-3.5 py-2 text-right font-black text-indigo-700">{it.cantidad}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* 8. Fallback Genérico / Registro Directo */}
                {!isLoading && data && originType === 'generic' && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center space-y-3">
                        <div className="w-10 h-10 bg-slate-200/70 text-slate-600 rounded-full flex items-center justify-center mx-auto">
                            <Info size={20} />
                        </div>
                        <div>
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                Información General del Movimiento
                            </h4>
                            <p className="text-xs text-slate-600 max-w-md mx-auto mt-1">
                                {data.message || 'Este registro fue generado de manera directa o el comprobante original fue purgado del historial.'}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default KardexOriginModal;
