import { useState, useEffect } from 'react';
import Modal from '../../../../components/ui/Modal';
import { ShoppingBag, Truck, User, Phone, MapPin, FileText } from 'lucide-react';
import { toast } from 'sonner';

export default function TakeoutOrderModal({ isOpen, onClose, orderType = 'para_llevar', onSubmit, onConfirm }) {
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (isOpen) {
            setCustomerName('');
            setCustomerPhone('');
            setDeliveryAddress('');
            setNotes('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const isDelivery = orderType === 'delivery';
    const title = isDelivery ? 'Nueva Orden para Delivery' : 'Nueva Orden Para Llevar';
    const Icon = isDelivery ? Truck : ShoppingBag;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!customerName.trim()) {
            toast.error('Por favor ingresa el nombre del cliente');
            return;
        }

        if (isDelivery && !deliveryAddress.trim()) {
            toast.error('Por favor ingresa la dirección de entrega');
            return;
        }

        const handleAction = onConfirm || onSubmit || (() => {});
        handleAction({
            customer_name: customerName.trim(),
            customer_phone: customerPhone.trim() || null,
            delivery_address: deliveryAddress.trim() || null,
            notes: notes.trim() || null,
            order_type: orderType
        });
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-indigo-900 text-xs">
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                        <Icon size={16} />
                    </div>
                    <div>
                        <span className="font-extrabold block">
                            {isDelivery ? 'Despacho a Domicilio' : 'Retiro en Barra / Mostrador'}
                        </span>
                        <span className="text-[11px] text-indigo-700/80">
                            {isDelivery ? 'Registra los datos para el repartidor y la comanda.' : 'Ingresa los datos para identificar el pedido al momento de entrega.'}
                        </span>
                    </div>
                </div>

                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                        Nombre del Cliente *
                    </label>
                    <div className="relative">
                        <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            required
                            autoFocus
                            placeholder="ej. María González"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>
                </div>

                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                        Teléfono de Contacto (Opcional)
                    </label>
                    <div className="relative">
                        <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="tel"
                            placeholder="ej. 7890-1234"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-800"
                        />
                    </div>
                </div>

                {isDelivery && (
                    <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                            Dirección de Entrega *
                        </label>
                        <div className="relative">
                            <MapPin size={15} className="absolute left-3 top-3 text-slate-400" />
                            <textarea
                                required
                                rows={2}
                                placeholder="ej. Col. Escalón, Calle El Mirador #123, frente al parque"
                                value={deliveryAddress}
                                onChange={(e) => setDeliveryAddress(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 resize-none"
                            />
                        </div>
                    </div>
                )}

                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                        Instrucciones o Notas Especiales
                    </label>
                    <div className="relative">
                        <FileText size={15} className="absolute left-3 top-2.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="ej. Tocar timbre portón blanco, cubiertos extra"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-800"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-200 transition-all flex items-center gap-1.5"
                    >
                        <Icon size={14} />
                        <span>Comenzar Pedido</span>
                    </button>
                </div>
            </form>
        </Modal>
    );
}
