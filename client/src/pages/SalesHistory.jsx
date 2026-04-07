import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import Table from '../components/ui/Table';
import Pagination from '../components/ui/Pagination';
import Modal from '../components/ui/Modal';
import { Search, FileText, Eye, Printer, Trash2, Calendar, User, Tag, ShoppingCart, CreditCard, Banknote, MapPin, Mail, Phone, Calculator } from 'lucide-react';

const SalesHistory = () => {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [selectedSaleId, setSelectedSaleId] = useState(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const limit = 10;

    const { data: salesData = { data: [], totalItems: 0, totalPages: 0 }, isLoading } = useQuery({
        queryKey: ['sales-history', search, page],
        queryFn: async () => (await axios.get('/api/sales', { params: { search, page, limit } })).data
    });

    const { data: saleDetail, isLoading: isLoadingDetail } = useQuery({
        queryKey: ['sale-detail', selectedSaleId],
        queryFn: async () => (await axios.get(`/api/sales/${selectedSaleId}`)).data,
        enabled: !!selectedSaleId
    });

    const handleViewSale = (id) => {
        setSelectedSaleId(id);
        setIsViewModalOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight text-Spanish">Historial de Ventas</h2>
                    <p className="text-slate-500 font-medium text-Spanish">Consulta y gestión de documentos emitidos</p>
                </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                <div className="relative max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar por nro. control o cliente..."
                        className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <Table 
                    headers={['Fecha', 'Documento', 'Cliente', 'Condición', 'Estado', 'Total', 'Acciones']}
                    data={salesData.data}
                    isLoading={isLoading}
                    renderRow={(sale) => (
                        <tr key={sale.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 text-sm">
                            <td className="px-6 py-4 font-medium text-slate-600">
                                {new Date(sale.fecha_emision).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-900">{sale.tipo_documento_name}</span>
                                    <span className="text-[10px] font-mono font-bold text-indigo-500">{sale.numero_control || 'SIN CONTROL'}</span>
                                </div>
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-700">{sale.customer_name || 'Consumidor Final'}</td>
                            <td className="px-6 py-4">
                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                    sale.condicion_operacion == 1
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-amber-50 text-amber-700'
                                }`}>
                                    {sale.condicion_operacion == 1 ? 'Contado' : 'Crédito'}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-wider">
                                    {sale.estado}
                                </span>
                            </td>
                            <td className="px-6 py-4 font-black text-slate-900">
                                ${parseFloat(sale.total_pagar).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <button 
                                        onClick={() => handleViewSale(sale.id)}
                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                        title="Ver Detalle"
                                    >
                                        <Eye size={18} />
                                    </button>
                                    <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                                        <Printer size={18} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    )}
                />
                <Pagination 
                    currentPage={page}
                    totalPages={salesData.totalPages}
                    totalItems={salesData.totalItems}
                    onPageChange={setPage}
                    itemsOnPage={salesData.data.length}
                    isLoading={isLoading}
                />
            </div>

            {/* Modal de Detalle */}
            <Modal
                isOpen={isViewModalOpen}
                onClose={() => setIsViewModalOpen(false)}
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
                                    <div className={`p-3 rounded-2xl border ${
                                        saleDetail.condicion_operacion == 1 
                                            ? 'bg-emerald-50 border-emerald-100' 
                                            : 'bg-amber-50 border-amber-100'
                                    }`}>
                                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Condición</span>
                                        <span className={`font-black text-sm ${
                                            saleDetail.condicion_operacion == 1 ? 'text-emerald-700' : 'text-amber-700'
                                        }`}>
                                            {saleDetail.condicion_operacion == 1 ? '✓ Contado' : '⏱ Crédito'}
                                        </span>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Estado</span>
                                        <span className="font-black text-slate-700 capitalize">{saleDetail.estado}</span>
                                    </div>
                                </div>
                                {saleDetail.codigo_generacion && (
                                    <div className="bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100">
                                        <span className="block text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Código de Generación (DTE)</span>
                                        <span className="font-mono text-xs font-black text-indigo-700 break-all">{saleDetail.codigo_generacion}</span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-3 text-slate-900">
                                    <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600"><User size={20} /></div>
                                    <div>
                                        <h4 className="text-sm font-black uppercase tracking-wider text-slate-400">Información del Cliente</h4>
                                        <p className="text-lg font-black">{saleDetail.customer_name || 'Consumidor Final'}</p>
                                    </div>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 grid grid-cols-1 gap-2">
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
                                                <td className="py-3 px-2 text-right font-medium text-slate-600">${parseFloat(item.precio_unitario).toFixed(2)}</td>
                                                <td className="py-3 px-2 text-right font-medium text-rose-500">-${parseFloat(item.monto_descuento || 0).toFixed(2)}</td>
                                                <td className="py-3 px-2 text-right font-black text-slate-900">
                                                    ${((item.cantidad * item.precio_unitario) - (item.monto_descuento || 0)).toFixed(2)}
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
                                            <span className="font-black text-slate-900">${parseFloat(pay.monto).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl space-y-4">
                                <div className="space-y-2 opacity-80 text-[10px] font-bold uppercase tracking-wider">
                                    <div className="flex justify-between border-b border-white/10 pb-1"><span>Gravada</span><span>${parseFloat(saleDetail.total_gravado).toFixed(2)}</span></div>
                                    <div className="flex justify-between border-b border-white/10 pb-1"><span>IVA</span><span>${parseFloat(saleDetail.total_iva).toFixed(2)}</span></div>
                                    {parseFloat(saleDetail.fovial) > 0 && <div className="flex justify-between border-b border-white/10 pb-1"><span>FOVIAL</span><span>${parseFloat(saleDetail.fovial).toFixed(2)}</span></div>}
                                    {parseFloat(saleDetail.cotrans) > 0 && <div className="flex justify-between border-b border-white/10 pb-1"><span>COTRANS</span><span>${parseFloat(saleDetail.cotrans).toFixed(2)}</span></div>}
                                    {parseFloat(saleDetail.total_exento) > 0 && <div className="flex justify-between border-b border-white/10 pb-1"><span>Exenta</span><span>${parseFloat(saleDetail.total_exento).toFixed(2)}</span></div>}
                                    <div className="flex justify-between border-b border-white/10 pb-1 text-rose-300"><span>Retención</span><span>-${parseFloat(saleDetail.iva_retenido || 0).toFixed(2)}</span></div>
                                </div>
                                <div className="flex items-end justify-between">
                                    <span className="text-[10px] font-black uppercase text-indigo-400">Total Pagado</span>
                                    <span className="text-4xl font-black tracking-tighter">${parseFloat(saleDetail.total_pagar).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}
            </Modal>
        </div>
    );
};

export default SalesHistory;
