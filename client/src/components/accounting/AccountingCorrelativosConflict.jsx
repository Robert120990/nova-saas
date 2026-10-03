const names = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export default function AccountingCorrelativosConflict({ conflict, edits, onResolve, busy }) {
    if (!conflict) return null;
    return <div role="alert" className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3 text-sm text-amber-900">
        <p className="font-bold">Los correlativos cambiaron en otra sesión. Sus cambios pendientes se conservan.</p>
        {(Array.isArray(conflict.months) ? conflict.months : []).map(item => <p key={item.month}>
            {names[item.month - 1]}: guardado <b>{item.current ?? 'Auto'}</b>; su edición <b>{edits[item.month]}</b>.
        </p>)}
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => onResolve(false)} className="rounded-xl bg-white border px-3 py-2">Descartar mi edición y cargar guardados</button>
            <button type="button" disabled={busy} onClick={() => onResolve(true)} className="rounded-xl bg-amber-700 text-white px-3 py-2">Revisé los cambios, conservar mi edición</button>
        </div>
        <p className="text-xs">Conservar su edición permite volver a guardar los valores revisados.</p>
    </div>;
}
