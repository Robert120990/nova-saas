import { Users, Plus, Copy, Trash2 } from 'lucide-react';
import { calculateAgeFromBirthDate } from './contratoConstants';

const labelCls = "text-[11px] font-bold text-slate-500 uppercase";
const inputCls = "w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-[12.5px] font-medium uppercase";

const ContratoDependientesSection = ({ dependientes = [], trabajadorDireccion = '', onChange }) => {
    const rows = Array.isArray(dependientes) ? dependientes : [];

    const handleRowChange = (index, field, value) => {
        const next = rows.map((row, idx) => {
            if (idx !== index) return row;
            if (field === 'fecha_nacimiento') {
                return {
                    ...row,
                    fecha_nacimiento: value,
                    edad: calculateAgeFromBirthDate(value)
                };
            }
            return { ...row, [field]: value };
        });
        onChange(next);
    };

    const handleCopyDireccion = (index) => {
        if (!trabajadorDireccion) return;
        handleRowChange(index, 'direccion', trabajadorDireccion);
    };

    const handleClearOrRemoveRow = (index) => {
        if (rows.length > 4) {
            onChange(rows.filter((_, idx) => idx !== index));
        } else {
            const next = rows.map((row, idx) => (
                idx === index ? { nombre: '', apellido: '', fecha_nacimiento: '', edad: '', direccion: '' } : row
            ));
            onChange(next);
        }
    };

    const handleAddRow = () => {
        onChange([...rows, { nombre: '', apellido: '', fecha_nacimiento: '', edad: '', direccion: '' }]);
    };

    return (
        <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                <div className="flex items-center gap-2">
                    <Users size={15} className="text-indigo-600" />
                    <div>
                        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                            G) Personas que Dependan Económicamente del Trabajador
                        </h4>
                        <p className="text-[11px] text-slate-500 font-medium">
                            La edad se calcula automáticamente a partir de la fecha de nacimiento para el documento impreso.
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={handleAddRow}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-xl text-xs font-bold transition-all self-start sm:self-auto"
                >
                    <Plus size={14} /> Agregar Fila
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] border-collapse">
                    <thead>
                        <tr className="text-left border-b border-slate-200/80">
                            <th className="py-1.5 px-2 w-8 text-[11px] font-bold text-slate-500">#</th>
                            <th className={`py-1.5 px-2 w-1/4 ${labelCls}`}>Nombre :</th>
                            <th className={`py-1.5 px-2 w-1/4 ${labelCls}`}>Apellido :</th>
                            <th className={`py-1.5 px-2 w-40 ${labelCls}`}>Fec. Nacimiento :</th>
                            <th className={`py-1.5 px-2 w-16 text-center ${labelCls}`}>Edad</th>
                            <th className={`py-1.5 px-2 ${labelCls}`}>Dirección :</th>
                            <th className="py-1.5 px-1 w-16"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/50">
                        {rows.map((dep, idx) => {
                            const age = calculateAgeFromBirthDate(dep.fecha_nacimiento) || dep.edad || '';
                            return (
                                <tr key={idx} className="group">
                                    <td className="py-2 px-2 text-xs font-extrabold text-slate-600">
                                        {idx + 1}.
                                    </td>
                                    <td className="py-1.5 px-1.5">
                                        <input
                                            type="text"
                                            value={dep.nombre || ''}
                                            onChange={(e) => handleRowChange(idx, 'nombre', e.target.value)}
                                            placeholder={idx === 0 ? 'EJ. MIRIAN CRISTINA' : ''}
                                            className={inputCls}
                                        />
                                    </td>
                                    <td className="py-1.5 px-1.5">
                                        <input
                                            type="text"
                                            value={dep.apellido || ''}
                                            onChange={(e) => handleRowChange(idx, 'apellido', e.target.value)}
                                            placeholder={idx === 0 ? 'EJ. HERNANDEZ' : ''}
                                            className={inputCls}
                                        />
                                    </td>
                                    <td className="py-1.5 px-1.5">
                                        <input
                                            type="date"
                                            value={dep.fecha_nacimiento || ''}
                                            onChange={(e) => handleRowChange(idx, 'fecha_nacimiento', e.target.value)}
                                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-[12.5px] font-medium"
                                        />
                                    </td>
                                    <td className="py-1.5 px-1.5 text-center">
                                        <span className="inline-flex items-center justify-center min-w-[36px] px-2 py-1 rounded-lg bg-slate-100 text-slate-700 font-mono text-xs font-bold">
                                            {age !== '' ? `${age}` : '—'}
                                        </span>
                                    </td>
                                    <td className="py-1.5 px-1.5">
                                        <input
                                            type="text"
                                            value={dep.direccion || ''}
                                            onChange={(e) => handleRowChange(idx, 'direccion', e.target.value)}
                                            placeholder={idx === 0 ? 'EJ. ATIQUIZAYA, CANTON EL ROBLE' : ''}
                                            className={inputCls}
                                        />
                                    </td>
                                    <td className="py-1.5 px-1 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            {trabajadorDireccion && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyDireccion(idx)}
                                                    title="Copiar dirección del trabajador"
                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                >
                                                    <Copy size={13} />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => handleClearOrRemoveRow(idx)}
                                                title="Limpiar fila"
                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ContratoDependientesSection;

