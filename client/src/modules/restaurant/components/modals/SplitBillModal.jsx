import { useState } from 'react';
import Modal from '../../../../components/ui/Modal';
import { Split, Printer } from 'lucide-react';
import { useAuth } from '../../../../context/AuthContext';
import SplitBillOrderTab from './SplitBillOrderTab';
import SplitBillPrintTab from './SplitBillPrintTab';

export default function SplitBillModal({ isOpen, onClose, order, onSuccess }) {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('split'); // 'split' o 'print'
    const [selectedItemIds, setSelectedItemIds] = useState([]);
    const [splitName, setSplitName] = useState('');

    if (!isOpen || !order) return null;

    const items = Array.isArray(order.items) ? order.items.filter(i => i.status !== 'cancelado') : [];
    const tipPercentage = Number(order.tip_percentage || 10);
    const totalWithTip = Number(order.total_with_tip || 0);
    const subtotal = Number(order.subtotal || 0);

    // Agrupación por asiento / comensal
    const seatsMap = {};
    items.forEach(item => {
        const seat = item.seat_number || 1;
        if (!seatsMap[seat]) seatsMap[seat] = [];
        seatsMap[seat].push(item);
    });

    const handleClose = () => {
        setSelectedItemIds([]);
        setSplitName('');
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={`Dividir Cuenta • ${order.order_type === 'mesa' ? order.table_number : 'Para Llevar'}`}
            maxWidth="max-w-2xl"
        >
            <div className="space-y-4">
                {/* Selector de Pestaña Principal (Opción B vs Opción A) */}
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                    <button
                        type="button"
                        onClick={() => setActiveTab('split')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                            activeTab === 'split' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <Split size={15} />
                        <span>Separar en 2 Cuentas</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('print')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                            activeTab === 'print' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <Printer size={15} />
                        <span>Imprimir Pre-cuentas</span>
                    </button>
                </div>

                {activeTab === 'split' ? (
                    <SplitBillOrderTab
                        order={order}
                        items={items}
                        seatsMap={seatsMap}
                        tipPercentage={tipPercentage}
                        selectedItemIds={selectedItemIds}
                        setSelectedItemIds={setSelectedItemIds}
                        splitName={splitName}
                        setSplitName={setSplitName}
                        onClose={handleClose}
                        onSuccess={onSuccess}
                    />
                ) : (
                    <SplitBillPrintTab
                        order={order}
                        seatsMap={seatsMap}
                        tipPercentage={tipPercentage}
                        totalWithTip={totalWithTip}
                        subtotal={subtotal}
                        user={user}
                        onClose={handleClose}
                    />
                )}
            </div>
        </Modal>
    );
}
