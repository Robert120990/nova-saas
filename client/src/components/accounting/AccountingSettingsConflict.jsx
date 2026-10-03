import { AlertTriangle } from 'lucide-react';

const GENERAL_LABELS = {
    resultado_ejercicio_id: 'Resultado del Ejercicio', contador_nombre: 'Nombre del contador',
    contador_dui: 'DUI del contador', auditor_nombre: 'Nombre del auditor', auditor_dui: 'DUI del auditor'
};

const AccountingSettingsConflict = ({ conflict, draft, accounts, onDiscard, onKeep }) => {
    if (!conflict) return null;
    const valueLabel = (key, value) => {
        if (value === null || value === undefined || value === '') return 'Sin asignar';
        if (key === 'resultado_ejercicio_id' || !GENERAL_LABELS[key]) {
            const account = (Array.isArray(accounts) ? accounts : []).find(item => String(item.id) === String(value));
            if (account) return `${account.code} — ${account.name}`;
        }
        return String(value);
    };
    return (
        <div className="border border-amber-300 bg-amber-50 rounded-2xl p-4 space-y-3">
            <p className="text-sm font-bold text-amber-900 flex items-start gap-2"><AlertTriangle size={18} className="shrink-0" />Otro usuario cambió estos ajustes. Tus cambios siguen pendientes.</p>
            <div className="space-y-2">
                {(Array.isArray(conflict.items) ? conflict.items : []).map(item => (
                    <div key={item.key} className="bg-white rounded-xl border border-amber-200 p-3 text-xs break-words space-y-1">
                        <p className="font-bold">{GENERAL_LABELS[item.key] || item.key}</p>
                        <p>Guardado: {valueLabel(item.key, item.current)}</p>
                        <p>Tus cambios: {Object.hasOwn(draft, item.key) ? valueLabel(item.key, draft[item.key]) : 'Eliminar este ajuste'}</p>
                    </div>
                ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
                <button type="button" onClick={onDiscard} className="border border-amber-400 text-amber-900 rounded-xl px-4 py-2 text-xs font-bold">Descartar mis cambios y cargar guardados</button>
                <button type="button" onClick={onKeep} className="bg-amber-600 text-white rounded-xl px-4 py-2 text-xs font-bold">Revisé los cambios, conservar mi versión</button>
            </div>
            <p className="text-xs text-amber-800">Conservar tu versión permite volver a guardar y reemplazar estos valores.</p>
        </div>
    );
};

export default AccountingSettingsConflict;
