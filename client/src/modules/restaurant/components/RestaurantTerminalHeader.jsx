import { ArrowLeft, Wallet } from 'lucide-react';

export default function RestaurantTerminalHeader({
    activeTab,
    selectedTable,
    currentOrder,
    user,
    isConnected,
    onBackToTables,
    onViewTables,
    onOpenShiftSummary
}) {
    return (
        <div className="flex items-center justify-between bg-white p-3.5 rounded-3xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2.5">
                {activeTab === 'order' && (
                    <button
                        type="button"
                        onClick={onBackToTables}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                        title="Volver a Mesas"
                    >
                        <ArrowLeft size={16} />
                    </button>
                )}
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-base font-black text-slate-900 leading-tight">
                            {activeTab === 'order'
                                ? (selectedTable?.table_number || selectedTable?.customer_name || 'Comanda')
                                : 'Toma de Comandas'}
                        </h1>
                        <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 flex-wrap">
                        {activeTab === 'order' ? (
                            currentOrder ? (
                                <>
                                    <span>Comanda #{currentOrder.id}</span>
                                    {currentOrder.customer_name && <span>• {currentOrder.customer_name}</span>}
                                    <span>•</span>
                                    <span className="font-bold text-indigo-700">Mesero: {currentOrder.waiter_name || user?.nombre || 'Staff'}</span>
                                </>
                            ) : (
                                <span>Nueva comanda • Atiende: {user?.nombre || 'Mesero'}</span>
                            )
                        ) : 'Terminal móvil de mesero'}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={onOpenShiftSummary}
                    className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold hover:bg-emerald-100 flex items-center gap-1.5 transition-colors shadow-2xs"
                    title="Ver ventas y propinas de mi turno"
                >
                    <Wallet size={14} className="text-emerald-600" />
                    <span>Mi Turno</span>
                </button>

                {activeTab === 'order' && (
                    <button
                        type="button"
                        onClick={onViewTables}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
                    >
                        Ver Mesas
                    </button>
                )}
            </div>
        </div>
    );
}
