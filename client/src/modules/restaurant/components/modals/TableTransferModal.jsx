import { useState } from 'react';
import Modal from '../../../../components/ui/Modal';
import { ArrowRightLeft, Merge } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

export default function TableTransferModal({
    isOpen,
    onClose,
    currentTable,
    tables = [],
    onSuccess
}) {
    const [mode, setMode] = useState('transfer'); // 'transfer' o 'merge'
    const [targetTableId, setTargetTableId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen || !currentTable) return null;

    const availableTables = tables.filter(t => t.id !== currentTable.id && t.status === 'disponible');
    const occupiedTables = tables.filter(t => t.id !== currentTable.id && t.status !== 'disponible');

    const handleAction = async (e) => {
        e.preventDefault();
        if (!targetTableId) {
            toast.error('Selecciona una mesa de destino');
            return;
        }

        setIsSubmitting(true);
        try {
            if (mode === 'transfer') {
                await axios.post('/api/restaurant/tables/transfer', {
                    source_table_id: currentTable.id,
                    target_table_id: Number(targetTableId)
                });
                toast.success('Comanda transferida a la nueva mesa');
            } else {
                await axios.post('/api/restaurant/tables/merge', {
                    main_table_id: Number(targetTableId),
                    secondary_table_id: currentTable.id
                });
                toast.success('Mesas unidas exitosamente');
            }
            onSuccess?.();
            onClose();
        } catch (err) {
            console.error('Error in transfer/merge:', err);
            toast.error(err.response?.data?.message || 'Error al procesar la acción');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Gestión de Mesa: ${currentTable.table_number}`}
            maxWidth="max-w-md"
        >
            <form onSubmit={handleAction} className="space-y-4">
                {/* Selector de Modo */}
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                    <button
                        type="button"
                        onClick={() => { setMode('transfer'); setTargetTableId(''); }}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            mode === 'transfer' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500'
                        }`}
                    >
                        <ArrowRightLeft size={14} />
                        <span>Cambiar Mesa</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => { setMode('merge'); setTargetTableId(''); }}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            mode === 'merge' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500'
                        }`}
                    >
                        <Merge size={14} />
                        <span>Unir Mesas</span>
                    </button>
                </div>

                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                        {mode === 'transfer' ? 'Seleccionar Mesa Libre de Destino' : 'Seleccionar Mesa Ocupada a Unir'}
                    </label>
                    <select
                        required
                        value={targetTableId}
                        onChange={(e) => setTargetTableId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                    >
                        <option value="">Seleccionar mesa...</option>
                        {mode === 'transfer' ? (
                            (Array.isArray(availableTables) ? availableTables : []).map(t => (
                                <option key={t.id} value={t.id}>{t.table_number} ({t.area_name || 'Salón'}) - Cap: {t.capacity}</option>
                            ))
                        ) : (
                            (Array.isArray(occupiedTables) ? occupiedTables : []).map(t => (
                                <option key={t.id} value={t.id}>{t.table_number} ({t.area_name || 'Salón'}) - Ocupada</option>
                            ))
                        )}
                    </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting || !targetTableId}
                        className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-200 disabled:opacity-50"
                    >
                        {isSubmitting ? 'Procesando...' : mode === 'transfer' ? 'Transferir Comanda' : 'Confirmar Unión'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
