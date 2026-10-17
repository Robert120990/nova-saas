import Modal from '../ui/Modal';

const PosFormModal = ({
    open,
    onClose,
    onSave,
    selectedPos,
    branches = [],
    isSubmitting = false,
}) => {
    if (!open) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);
        data.allow_discounts = formData.get('allow_discounts') ? 1 : 0;
        data.auto_print = formData.get('auto_print') ? 1 : 0;
        onSave(data);
    };

    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title={selectedPos ? 'Editar Punto de Venta' : 'Nuevo Punto de Venta'}
        >
            <form onSubmit={handleSubmit} className="space-y-5 p-1">
                <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                        Sucursal
                    </label>
                    <select
                        name="branch_id"
                        defaultValue={selectedPos?.branch_id || ''}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all appearance-none"
                        required
                    >
                        <option value="">Selecciona Sucursal</option>
                        {(Array.isArray(branches) ? branches : []).map((b) => (
                            <option key={b.id} value={b.id}>
                                {b.nombre} ({b.codigo})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                        Código POS
                    </label>
                    <input
                        name="codigo"
                        defaultValue={selectedPos?.codigo || ''}
                        placeholder="Ej: P001"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all font-mono"
                        required
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                        Nombre Terminal
                    </label>
                    <input
                        name="nombre"
                        defaultValue={selectedPos?.nombre || ''}
                        placeholder="Caja Principal / Terminal Móvil"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all"
                        required
                    />
                </div>

                <div className="border-t border-slate-100 pt-4">
                    <label className="text-[11px] font-bold uppercase text-slate-500 tracking-wider ml-1 block mb-3">
                        Políticas de Facturación
                    </label>
                    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                name="allow_discounts"
                                value="1"
                                defaultChecked={
                                    selectedPos
                                        ? Boolean(selectedPos.allow_discounts && Number(selectedPos.allow_discounts) !== 0)
                                        : false
                                }
                                id="allow_discounts"
                                className="w-4 h-4 mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <div>
                                <span className="text-xs font-bold text-slate-700 block">
                                    Habilitar Descuentos en esta Terminal
                                </span>
                                <span className="text-[11px] text-slate-500 block font-medium">
                                    Permite a los usuarios con permisos aplicar descuentos por ítem y globales en las ventas de este POS.
                                </span>
                            </div>
                        </label>
                    </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                    <label className="text-[11px] font-bold uppercase text-slate-500 tracking-wider ml-1 block mb-3">
                        Configuración de Impresión
                    </label>
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                name="auto_print"
                                value="1"
                                defaultChecked={Boolean(selectedPos?.auto_print)}
                                id="auto_print"
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600"
                            />
                            <label htmlFor="auto_print" className="text-xs font-bold text-slate-600">
                                Impresión directa (sin vista previa)
                            </label>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                                Nombre de Impresora
                            </label>
                            <input
                                name="printer_name"
                                defaultValue={selectedPos?.printer_name || ''}
                                placeholder="Ej: EPSON TM-T20II"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all"
                            />
                        </div>
                    </div>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-xl font-bold transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                    >
                        {selectedPos ? 'Actualizar' : 'Crear Terminal'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default PosFormModal;
