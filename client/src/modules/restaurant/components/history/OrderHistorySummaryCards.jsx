import { Receipt, CheckCircle2, DollarSign, HeartHandshake } from 'lucide-react';
import Money from '../../../../components/ui/Money';

export default function OrderHistorySummaryCards({ orders = [] }) {
    const totalCount = orders.length;
    const billedOrders = orders.filter(o => o.status === 'facturada');
    const billedCount = billedOrders.length;

    const totalBilled = billedOrders.reduce((acc, o) => {
        const val = Number(o.total_with_tip || o.subtotal || 0);
        return acc + (isNaN(val) ? 0 : val);
    }, 0);

    const totalTips = billedOrders.reduce((acc, o) => {
        const val = Number(o.tip_amount || 0);
        return acc + (isNaN(val) ? 0 : val);
    }, 0);

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Receipt size={18} />
                </div>
                <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Total Comandas</span>
                    <span className="text-base font-black text-slate-900">{totalCount}</span>
                </div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={18} />
                </div>
                <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Facturadas</span>
                    <span className="text-base font-black text-slate-900">{billedCount}</span>
                </div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <DollarSign size={18} />
                </div>
                <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Monto Total Facturado</span>
                    <span className="text-base font-black text-emerald-600">
                        <Money value={totalBilled} />
                    </span>
                </div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                    <HeartHandshake size={18} />
                </div>
                <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Propinas Recaudadas</span>
                    <span className="text-base font-black text-indigo-600">
                        <Money value={totalTips} />
                    </span>
                </div>
            </div>
        </div>
    );
}
