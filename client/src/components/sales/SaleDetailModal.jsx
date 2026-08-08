import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import Modal from '../ui/Modal';
import Money from '../ui/Money';
import { FileText, User, Tag, MapPin, ShoppingCart, CreditCard, Banknote, Code, Info, Terminal } from 'lucide-react';

const SaleDetailModal = ({ saleId, isOpen, onClose, initialView = 'detalle' }) => {
    const [view, setView] = useState(initialView);

    useEffect(() => {
        if (isOpen) setView(initialView);
    }, [initialView, saleId, isOpen]);

    const { data: saleDetail, isLoading: isLoadingDetail } = useQuery({
        queryKey: ['sale-detail', saleId],
        queryFn: async () => (await axios.get(`/api/sales/${saleId}`)).data,
        enabled: !!saleId && isOpen
    });

    const handleClose = () => {
        setView('detalle');
        onClose();
    };

    return (
        <>
            <Modal
                isOpen={isOpen && view === 'detalle'}
                onClose={handleClose}
                title="Detalle de Venta"
                maxWidth="max-w-4xl"
            >
                {isLoadingDetail ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                        <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Cargando Detalle...</p>
                    </div>
                ) : saleDetail ? (
                    <div className="space-y-8">
                        {/* Cabecera del Documento */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 text-slate-900">
                                    <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><FileText size={20} /></div>
                                    <div>
                                        <h4 className="text-sm font-black uppercase tracking-wider text-slate-400">Información del Documento</h4>
                                        <p className="text-lg font-black">{saleDetail.tipo_documento_name}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Nro. Control</span>
                                        <span className="font-mono font-black text-indigo-600">{saleDetail.numero_control || 'N/A'}</span>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Fecha Emisión</span>
                                        <span className="font-black text-slate-700">{new Date(saleDetail.fecha_emision).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                {saleDetail.codigo_generacion && (
                                    <div className="bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100">
                                        <span className="block text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Código de Generación (DTE)</span>
                                        <span className="font-mono text-xs font-black text-indigo-700 break-all">{saleDetail.codigo_generacion}</span>
                                    </div>
                                )}
                                <div className="flex flex-wrap gap-2">
                                    {saleDetail.json_original && (
                                        <button
                                            type="button"
                                            onClick={() => setView('json')}
                                            className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all text-[10px] font-black uppercase tracking-widest"
                                        >
                                            <Code size={14} /> Ver JSON DTE
                                        </button>
                                    )}
                                    {saleDetail.respuesta_hacienda && (
                                        <button
                                            type="button"
                                            onClick={() => setView('respuesta')}
                                            className="flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-all text-[10px] font-black uppercase tracking-widest"
                                        >
                                            <Terminal size={14} /> Respuesta MH
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-3 text-slate-900">
                                    <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600"><User size={20} /></div>
                                    <div>
                                        <h4 className="text-sm font-black uppercase tracking-wider text-slate-400">Información del Cliente</h4>
                                        <p className="text-lg font-black">{saleDetail.customer_name || 'Consumidor Final'}</p>
                                    </div>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 grid grid-cols-1 gap-2 mb-4">
                                    {saleDetail.customer_nit && (
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                            <Tag size={14} className="text-slate-300" />
                                            <span>NIT: {saleDetail.customer_nit}</span>
                                        </div>
                                    )}
                                    {saleDetail.customer_address && (
                                        <div className="flex items-start gap-2 text-xs font-bold text-slate-500">
                                            <MapPin size={14} className="text-slate-300 mt-0.5" />
                                            <span className="flex-1">{saleDetail.customer_address}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Sucursal / Terminal</span>
                                        <span className="block font-black text-slate-700 text-[10px] uppercase leading-tight line-clamp-1">{saleDetail.branch_name || 'Matriz'}</span>
                                        <span className="block font-bold text-indigo-400 text-[9px] uppercase tracking-tighter mt-0.5">{saleDetail.pos_name || 'Principal'}</span>
                                    </div>

                                    <div className={`p-3 rounded-2xl border ${
                                        saleDetail.condicion_operacion == 1 
                                            ? 'bg-emerald-50 border-emerald-100' 
                                            : 'bg-amber-50 border-amber-100'
                                    }`}>
                                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Condición</span>
                                        <span className={`font-black text-sm ${
                                            saleDetail.condicion_operacion == 1 ? 'text-emerald-700' : 'text-amber-700'
                                        }`}>
                                            {saleDetail.condicion_operacion == 1 ? 'Contado' : 'Crédito'}
                                        </span>
                                    </div>

                                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Estado de Venta</span>
                                        <span className="font-black text-slate-700 capitalize text-sm">{saleDetail.estado}</span>
                                    </div>

                                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Vendedor / Cajero</span>
                                        <span className="font-black text-slate-700 uppercase text-[11px] leading-tight line-clamp-2">{saleDetail.seller_name || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Listado de Ítems */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-slate-900 font-black uppercase text-xs tracking-widest border-b border-slate-100 pb-4">
                                <ShoppingCart size={18} className="text-indigo-600" />
                                <span>Detalle de Ítems</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50">
                                            <th className="py-3 px-2">Descripción</th>
                                            <th className="py-3 px-2 text-center">Cant.</th>
                                            <th className="py-3 px-2 text-right">Precio U.</th>
                                            <th className="py-3 px-2 text-right">Desc.</th>
                                            <th className="py-3 px-2 text-right">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {saleDetail.items?.map((item, idx) => (
                                            <tr key={idx} className="text-xs">
                                                <td className="py-3 px-2 font-bold text-slate-700">{item.descripcion}</td>
                                                <td className="py-3 px-2 text-center font-black text-slate-900">{item.cantidad}</td>
                                                <td className="py-3 px-2 text-right font-medium text-slate-600"><Money value={item.precio_unitario} /></td>
                                                <td className="py-3 px-2 text-right font-medium text-rose-500">-<Money value={item.monto_descuento || 0} /></td>
                                                <td className="py-3 px-2 text-right font-black text-slate-900">
                                                    <Money value={((item.cantidad * item.precio_unitario) - (item.monto_descuento || 0))} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Totales y Pagos */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-100">
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-widest">
                                    <CreditCard size={18} className="text-indigo-600" />
                                    <span>Formas de Pago</span>
                                </div>
                                <div className="space-y-2">
                                    {saleDetail.payments?.map((pay, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl text-xs">
                                            <div className="flex items-center gap-2 font-bold text-slate-600">
                                                <Banknote size={14} className="text-emerald-500" />
                                                {pay.metodo_pago === '01' ? 'Efectivo' : 'Tarjeta/Transferencia'}
                                            </div>
                                            <span className="font-black text-slate-900"><Money value={pay.monto} /></span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl space-y-4">
                                <div className="space-y-2 opacity-80 text-[10px] font-bold uppercase tracking-wider">
                                    <div className="flex justify-between border-b border-white/10 pb-1"><span>Gravada</span><span><Money value={saleDetail.total_gravado} /></span></div>
                                    <div className="flex justify-between border-b border-white/10 pb-1"><span>IVA</span><span><Money value={saleDetail.total_iva} /></span></div>
                                    {parseFloat(saleDetail.fovial) > 0 && <div className="flex justify-between border-b border-white/10 pb-1"><span>FOVIAL</span><span><Money value={saleDetail.fovial} /></span></div>}
                                    {parseFloat(saleDetail.cotrans) > 0 && <div className="flex justify-between border-b border-white/10 pb-1"><span>COTRANS</span><span><Money value={saleDetail.cotrans} /></span></div>}
                                    {parseFloat(saleDetail.total_exento) > 0 && <div className="flex justify-between border-b border-white/10 pb-1"><span>Exenta</span><span><Money value={saleDetail.total_exento} /></span></div>}
                                    <div className="flex justify-between border-b border-white/10 pb-1 text-rose-300"><span>Retención</span><span>-<Money value={saleDetail.iva_retenido || 0} /></span></div>
                                </div>
                                <div className="flex items-end justify-between">
                                    <span className="text-[10px] font-black uppercase text-indigo-400">Total Pagado</span>
                                    <span className="text-4xl font-black tracking-tighter"><Money value={saleDetail.total_pagar} /></span>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}
            </Modal>

            {/* Modal de Respuesta Hacienda */}
            <Modal
                isOpen={isOpen && view === 'respuesta'}
                onClose={handleClose}
                title="Respuesta Técnica de Hacienda"
                maxWidth="max-w-xl"
            >
                {isLoadingDetail ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                    </div>
                ) : saleDetail?.respuesta_hacienda ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-800 rounded-2xl border border-amber-100 text-xs">
                            <Info size={18} className="shrink-0" />
                            <p>Esta es la respuesta JSON literal recibida desde los servidores del Ministerio de Hacienda (MH).</p>
                        </div>
                        <div className="bg-slate-900 p-4 rounded-3xl overflow-auto max-h-[400px]">
                            <pre className="text-indigo-300 font-mono text-xs leading-relaxed">
                                {JSON.stringify(saleDetail.respuesta_hacienda, null, 2)}
                            </pre>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12 text-slate-400 font-bold uppercase tracking-widest text-xs">Sin respuesta técnica registrada</div>
                )}
            </Modal>

            {/* Modal de JSON Original */}
            <Modal
                isOpen={isOpen && view === 'json'}
                onClose={handleClose}
                title="Inspección Técnica DTE (JSON Original)"
                maxWidth="max-w-4xl"
            >
                {isLoadingDetail ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                    </div>
                ) : saleDetail?.json_original ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 p-3 bg-slate-100 text-slate-600 rounded-2xl border border-slate-200 text-[10px] font-black uppercase tracking-widest">
                            <Code size={18} /> JSON Literal del DTE (Representación Técnica)
                        </div>
                        <div className="bg-slate-950 p-6 rounded-3xl overflow-auto max-h-[70vh] border border-slate-800 shadow-2xl">
                            <pre className="text-emerald-400 font-mono text-xs leading-relaxed">
                                {JSON.stringify(saleDetail.json_original, null, 2)}
                            </pre>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12 text-slate-400 font-bold uppercase tracking-widest text-xs">No hay datos de DTE disponibles para este registro</div>
                )}
            </Modal>
        </>
    );
};

export default SaleDetailModal;
