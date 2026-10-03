import Modal from '../../ui/Modal';
import Money from '../../ui/Money';
import { unwrapList } from '../../../utils/apiUtils';

export default function PlanillaConflictModal({ open, onClose, onSave, current, details, busy }) {
    if (!open || !current) return null;
    const saved = unwrapList(current.detalles);
    const draft = unwrapList(details);
    const closed = current.totales?.estado === 'pagada';
    const accountKeys = [...new Set([...draft, ...saved].map(d => String(d.cuenta_id ?? d.codigo)))];
    return <Modal isOpen={open} onClose={onClose} title="Revisar cambios de otra sesión" maxWidth="max-w-3xl">
        <p className="text-sm text-slate-600 mb-4">Esta planilla cambió desde que la abrió. Revise los datos guardados antes de decidir qué valores conservar. Su edición permanece en pantalla.</p>
        {!current.planilla_id && <p className="mb-4 text-sm text-amber-800">El empleado fue retirado de este período. Guardar su edición volverá a agregarlo a la planilla.</p>}
        {closed && <p className="mb-4 text-sm text-amber-800">Esta planilla fue cerrada. Puede cargar los datos guardados para consultarlos.</p>}
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 text-left"><th className="p-2">Cuenta</th><th className="p-2">Su edición</th><th className="p-2">Guardado</th></tr></thead>
                <tbody>{(Array.isArray(accountKeys) ? accountKeys : []).map(key => {
                    const local = draft.find(d => String(d.cuenta_id ?? d.codigo) === key);
                    const remote = saved.find(d => String(d.cuenta_id ?? d.codigo) === key);
                    return <tr key={key} className="border-t border-slate-100">
                        <td className="p-2">{local?.descripcion || remote?.descripcion}</td>
                        <td className="p-2"><Money value={local?.valor_ingresado} /></td>
                        <td className="p-2"><Money value={remote?.valor_ingresado} /></td>
                    </tr>;
                })}</tbody>
            </table>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap justify-end gap-2 mt-5">
            <button type="button" disabled={busy} onClick={onClose} className="px-3 py-2 rounded-xl border text-sm">Seguir revisando</button>
            <button type="button" disabled={busy} onClick={() => onSave('server')} className="px-3 py-2 rounded-xl bg-slate-100 text-sm font-semibold">{current.planilla_id ? 'Usar datos guardados' : 'Descartar este borrador'}</button>
            <button type="button" disabled={busy || closed} onClick={() => onSave('local')} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50">Guardar mi edición revisada</button>
        </div>
    </Modal>;
}
