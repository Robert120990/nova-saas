import Modal from '../../../../components/ui/Modal';
import { Printer } from 'lucide-react';
import Money from '../../../../components/ui/Money';
import { formatDate, formatTime } from '../../../../utils/dateUtils';
import { useAuth } from '../../../../context/AuthContext';

export default function RestaurantPreAccountModal({ isOpen, onClose, order }) {
    const { user } = useAuth();

    if (!isOpen || !order) return null;

    const items = Array.isArray(order.items) ? order.items.filter(i => i.status !== 'cancelado') : [];
    const subtotal = Number(order.subtotal || 0);
    const orderDiscount = Number(order.discount_amount || 0);
    const itemsDiscount = items.reduce((acc, i) => acc + Number(i.discount_amount || 0), 0);
    const totalDiscount = orderDiscount + itemsDiscount;
    const netSubtotal = Math.max(0, subtotal - totalDiscount);
    const tipPercentage = Number(order.tip_percentage || 10);
    const tipAmount = Number(order.tip_amount || ((netSubtotal * tipPercentage) / 100).toFixed(2));
    const totalWithTip = Number(order.total_with_tip || (netSubtotal + tipAmount).toFixed(2));

    const handlePrint = () => {
        window.print();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Pre-cuenta / Estado de Mesa"
            maxWidth="max-w-sm"
        >
            <div className="space-y-4">
                {/* Formato de Ticket Térmico 58mm */}
                <div id="thermal-preaccount-ticket" className="bg-slate-50 border border-slate-300 p-4 rounded-xl font-mono text-xs text-slate-800 space-y-3 shadow-inner">
                    <div className="text-center pb-2 border-b border-dashed border-slate-300 space-y-0.5">
                        <h4 className="font-extrabold text-sm uppercase">{user?.company_name || 'RESTAURANTE'}</h4>
                        <p className="text-[10px] text-slate-500 font-bold uppercase">*** PRE-CUENTA ***</p>
                        <p className="text-[10px] text-slate-400">NO VÁLIDO COMO DOCUMENTO TRIBUTARIO</p>
                    </div>

                    <div className="text-[11px] space-y-0.5 pb-2 border-b border-dashed border-slate-300">
                        <div className="flex justify-between">
                            <span className="font-bold">MESA:</span>
                            <span className="font-black text-sm">{order.table_number || order.customer_name || 'Para Llevar'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Comanda: #{order.id}</span>
                            <span>Mesero: {order.waiter_name || 'Staff'}</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400">
                            <span>{formatDate(order.opened_at || new Date())}</span>
                            <span>{formatTime(order.opened_at || new Date())}</span>
                        </div>
                    </div>

                    {/* Partidas */}
                    <div className="space-y-1 py-1 border-b border-dashed border-slate-300">
                        {items.map((item, idx) => (
                            <div key={idx} className="space-y-0.5 text-[11px]">
                                <div className="flex justify-between items-start">
                                    <span className="flex-1 pr-2 leading-tight">
                                        {item.quantity}x {item.product_name}
                                    </span>
                                    <span className="font-bold shrink-0">
                                        <Money value={Number(item.quantity) * Number(item.unit_price)} />
                                    </span>
                                </div>
                                {Number(item.discount_amount || 0) > 0 && (
                                    <div className="flex justify-between text-[10px] text-rose-600 font-bold pl-3">
                                        <span>Descuento {item.discount_type === 'courtesy' ? '(Cortesía)' : ''}:</span>
                                        <span>-<Money value={Number(item.discount_amount)} /></span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Totales, Descuento y Propina */}
                    <div className="space-y-1 pt-1 text-[11px]">
                        <div className="flex justify-between">
                            <span>SUBTOTAL CONSUMO:</span>
                            <span className="font-bold"><Money value={subtotal} /></span>
                        </div>
                        {totalDiscount > 0 && (
                            <div className="flex justify-between text-rose-600 font-bold">
                                <span>DESCUENTO / CORTESÍA:</span>
                                <span>-<Money value={totalDiscount} /></span>
                            </div>
                        )}
                        {totalDiscount > 0 && (
                            <div className="flex justify-between font-bold">
                                <span>SUBTOTAL NETO:</span>
                                <span><Money value={netSubtotal} /></span>
                            </div>
                        )}
                        <div className="flex justify-between text-indigo-700 font-bold">
                            <span>PROPINA SUGERIDA ({tipPercentage}%):</span>
                            <span><Money value={tipAmount} /></span>
                        </div>
                        <div className="flex justify-between font-black text-sm pt-1.5 border-t border-slate-800 text-slate-900">
                            <span>TOTAL SUGERIDO:</span>
                            <span><Money value={totalWithTip} /></span>
                        </div>
                    </div>

                    <div className="text-center pt-2 text-[9px] text-slate-400 leading-tight">
                        La propina es voluntaria y puede ser modificada a su entera discreción. ¡Muchas gracias por su preferencia!
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold"
                    >
                        Cerrar
                    </button>
                    <button
                        type="button"
                        onClick={handlePrint}
                        className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-200"
                    >
                        <Printer size={15} />
                        <span>Imprimir Pre-cuenta (58mm)</span>
                    </button>
                </div>
            </div>
        </Modal>
    );
}
