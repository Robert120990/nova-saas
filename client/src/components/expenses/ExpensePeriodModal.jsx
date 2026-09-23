import Modal from '../ui/Modal';

export default function ExpensePeriodModal({
    isOpen,
    onClose,
    year,
    month,
    onYearChange,
    onMonthChange,
    onSubmit,
    isSubmitting = false,
    months = [],
    years = []
}) {
    if (!isOpen) return null;

    const labelCls = "text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block";
    const inputCls = "w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all";

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Configurar Período de Compras Activo"
            maxWidth="max-w-md"
        >
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    onSubmit();
                }}
                className="space-y-4 text-slate-800"
            >
                <p className="text-xs text-slate-600">
                    El período activo determina el mes y año en el cual se computan y declaran las compras y gastos tributarios de la empresa en curso.
                </p>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={labelCls}>Mes Activo *</label>
                        <select
                            value={month}
                            onChange={(e) => onMonthChange(parseInt(e.target.value, 10))}
                            className={inputCls}
                        >
                            {months.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={labelCls}>Año Activo *</label>
                        <select
                            value={year}
                            onChange={(e) => onYearChange(parseInt(e.target.value, 10))}
                            className={inputCls}
                        >
                            {years.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all"
                    >
                        {isSubmitting ? 'Guardando...' : 'Guardar Período Activo'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
