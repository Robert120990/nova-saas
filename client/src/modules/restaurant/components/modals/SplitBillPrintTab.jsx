import { useState } from 'react';
import { Users, Split, Printer } from 'lucide-react';
import Money from '../../../../components/ui/Money';
import { formatDate, formatTime } from '../../../../utils/dateUtils';
import { printThermalTickets } from '../../utils/printTicket';

export default function SplitBillPrintTab({
    order,
    seatsMap = {},
    tipPercentage = 10,
    totalWithTip = 0,
    subtotal = 0,
    user,
    onClose
}) {
    const [printMode, setPrintMode] = useState('seats'); // 'seats' o 'equal'
    const [splitCount, setSplitCount] = useState(2);

    const handlePrintEqual = () => {
        const equalTotal = splitCount > 0 ? (totalWithTip / splitCount) : 0;
        const equalSubtotal = splitCount > 0 ? (subtotal / splitCount) : 0;
        const equalTip = equalTotal - equalSubtotal;

        const tickets = Array.from({ length: splitCount }, (_, idx) => ({
            companyName: user?.company_name || 'RESTAURANTE',
            tableName: order.table_number || order.customer_name || 'Para Llevar',
            orderId: order.id,
            title: `Parte ${idx + 1} de ${splitCount} (Partes Iguales)`,
            waiterName: order.waiter_name || user?.nombre || 'Staff',
            dateStr: formatDate(order.opened_at || new Date()),
            timeStr: formatTime(order.opened_at || new Date()),
            subtotal: equalSubtotal,
            tipPercentage,
            tipAmount: equalTip,
            total: equalTotal,
            items: []
        }));
        printThermalTickets(tickets);
    };

    const handlePrintSeats = (targetSeat = null) => {
        const seatsToPrint = targetSeat ? { [targetSeat]: seatsMap[targetSeat] } : seatsMap;
        const tickets = Object.entries(seatsToPrint).map(([seat, seatItems]) => {
            const seatSub = seatItems.reduce((acc, i) => acc + (Number(i.quantity) * Number(i.unit_price)), 0);
            const seatTip = Number(((seatSub * tipPercentage) / 100).toFixed(2));
            return {
                companyName: user?.company_name || 'RESTAURANTE',
                tableName: order.table_number || order.customer_name || 'Para Llevar',
                orderId: order.id,
                title: `Comensal #${seat}`,
                waiterName: order.waiter_name || user?.nombre || 'Staff',
                dateStr: formatDate(order.opened_at || new Date()),
                timeStr: formatTime(order.opened_at || new Date()),
                subtotal: seatSub,
                tipPercentage,
                tipAmount: seatTip,
                total: seatSub + seatTip,
                items: seatItems
            };
        });
        printThermalTickets(tickets);
    };

    return (
        <div className="space-y-3.5">
            <div className="grid grid-cols-2 gap-2 bg-slate-100/70 p-1 rounded-xl border border-slate-200">
                <button
                    type="button"
                    onClick={() => setPrintMode('seats')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        printMode === 'seats' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500'
                    }`}
                >
                    <Users size={13} />
                    <span>Por Comensal</span>
                </button>
                <button
                    type="button"
                    onClick={() => setPrintMode('equal')}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        printMode === 'equal' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500'
                    }`}
                >
                    <Split size={13} />
                    <span>Partes Iguales</span>
                </button>
            </div>

            {printMode === 'seats' ? (
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {Object.keys(seatsMap).length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-4">No hay partidas activas</p>
                    ) : (
                        Object.entries(seatsMap).map(([seat, seatItems]) => {
                            const seatSub = seatItems.reduce((acc, i) => acc + (Number(i.quantity) * Number(i.unit_price)), 0);
                            const seatTip = Number(((seatSub * tipPercentage) / 100).toFixed(2));
                            return (
                                <div key={seat} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1.5">
                                    <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                                        <span className="font-extrabold text-slate-900">
                                            Comensal #{seat} ({seatItems.length} {seatItems.length === 1 ? 'ítem' : 'ítems'})
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="font-black text-indigo-700">
                                                <Money value={seatSub + seatTip} />
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handlePrintSeats(seat)}
                                                className="p-1 text-slate-500 hover:text-indigo-600 rounded"
                                                title="Imprimir solo este comensal"
                                            >
                                                <Printer size={14} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-0.5">
                                        {seatItems.map((si, idx) => (
                                            <div key={idx} className="flex justify-between text-slate-600 text-[11px]">
                                                <span>{si.quantity}x {si.product_name}</span>
                                                <span className="font-medium"><Money value={Number(si.quantity) * Number(si.unit_price)} /></span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            ) : (
                <div className="space-y-3 py-1">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
                        <label className="text-xs font-bold text-slate-700 block">
                            ¿Entre cuántas personas dividir la cuenta?
                        </label>
                        <div className="flex items-center gap-2">
                            {[2, 3, 4, 5, 6].map(num => (
                                <button
                                    key={num}
                                    type="button"
                                    onClick={() => setSplitCount(num)}
                                    className={`flex-1 py-1.5 rounded-xl text-xs font-extrabold border transition-all ${
                                        splitCount === num
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    {num}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-center space-y-0.5">
                        <span className="text-xs font-bold text-indigo-900 block">
                            Monto a pagar por persona ({splitCount} partes iguales)
                        </span>
                        <div className="text-2xl font-black text-indigo-700">
                            <Money value={splitCount > 0 ? (totalWithTip / splitCount) : 0} />
                        </div>
                        <p className="text-[11px] text-indigo-500 font-medium">
                            (Consumo: <Money value={splitCount > 0 ? (subtotal / splitCount) : 0} /> + Propina sugerida incluida)
                        </p>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between pt-2">
                <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
                >
                    Cerrar
                </button>
                <button
                    type="button"
                    onClick={printMode === 'seats' ? () => handlePrintSeats() : handlePrintEqual}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-indigo-200"
                >
                    <Printer size={15} />
                    <span>
                        {printMode === 'seats' ? 'Imprimir Todos los Comensales' : `Imprimir ${splitCount} Tickets Iguales`}
                    </span>
                </button>
            </div>
        </div>
    );
}
