import { Package, DollarSign, TrendingUp, Layers, Users, Egg } from 'lucide-react';
import Money from '../../ui/Money';

export default function EggSalesKpiCards({ totalLbs, totalAmount, avgPrice, isProduct, summary, items }) {
    const shellEggs = summary?.shellEggs;
    const hasShellEggs = shellEggs && (shellEggs.totalAmount > 0 || shellEggs.totalBoxes > 0 || shellEggs.totalUnits > 0);

    return (
        <div className={`grid grid-cols-2 ${hasShellEggs ? 'sm:grid-cols-3 lg:grid-cols-5' : 'md:grid-cols-4'} gap-3`}>
            {/* 1. Libras Ovoproductos */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                        {hasShellEggs ? 'Lbs Ovoproductos' : 'Total Libras'}
                    </span>
                    <div className="text-lg sm:text-xl font-bold text-slate-800 mt-0.5">
                        {Number(totalLbs).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                        <span className="text-xs font-normal text-slate-500 ml-1">Lb</span>
                    </div>
                </div>
                <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                    <Package className="w-5 h-5" />
                </div>
            </div>

            {/* 2. Total Huevo en Cáscara (Separado de Libras) */}
            {hasShellEggs && (
                <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
                            Huevo en Cáscara
                        </span>
                        <div className="text-lg sm:text-xl font-bold text-amber-900 mt-0.5">
                            <Money value={shellEggs.totalAmount} />
                        </div>
                        <span className="text-[10px] font-semibold text-amber-600 block mt-0.5 truncate max-w-[130px]" title={shellEggs.displayQuantity}>
                            {shellEggs.displayQuantity}
                        </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
                        <Egg className="w-5 h-5" />
                    </div>
                </div>
            )}

            {/* 3. Total Facturado */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                        Total Facturado
                    </span>
                    <div className="text-lg sm:text-xl font-bold text-emerald-700 mt-0.5">
                        <Money value={totalAmount} />
                    </div>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
                    <DollarSign className="w-5 h-5" />
                </div>
            </div>

            {/* 4. Precio Promedio Ovoproductos */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                        {hasShellEggs ? 'Prom. Ovop. ($/Lb)' : 'Precio Promedio'}
                    </span>
                    <div className="text-lg sm:text-xl font-bold text-amber-600 mt-0.5">
                        <Money value={avgPrice} />
                        <span className="text-xs font-normal text-slate-500 ml-1">/Lb</span>
                    </div>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
                    <TrendingUp className="w-5 h-5" />
                </div>
            </div>

            {/* 5. Clientes / Categorías */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                        {isProduct ? 'Categorías' : 'Clientes'}
                    </span>
                    <div className="text-lg sm:text-xl font-bold text-slate-800 mt-0.5">
                        {isProduct ? (summary?.totalProducts || items.length) : (summary?.totalCustomers || items.length)}
                    </div>
                </div>
                <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
                    {isProduct ? <Layers className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                </div>
            </div>
        </div>
    );
}
