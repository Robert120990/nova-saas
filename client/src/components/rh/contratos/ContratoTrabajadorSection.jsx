import { User, Briefcase, Calendar } from 'lucide-react';
import {
    ESTADOS_CIVILES,
    SEXOS_OPCIONES,
    PLAZOS_CONTRATO,
    calculateAgeFromBirthDate
} from './contratoConstants';

const labelCls = "block text-[11px] font-bold text-slate-500 uppercase mb-1";
const inputCls = "w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-[13px] font-medium uppercase";

const ContratoTrabajadorSection = ({ form, onChange }) => {
    const handleField = (key, val) => {
        if (key === 'fecha_nacimiento') {
            const autoAge = calculateAgeFromBirthDate(val);
            onChange({
                ...form,
                fecha_nacimiento: val,
                edad: autoAge !== '' ? autoAge : form.edad
            });
            return;
        }
        onChange({ ...form, [key]: val });
    };

    const computedAge = calculateAgeFromBirthDate(form.fecha_nacimiento) || form.edad || '';

    return (
        <div className="space-y-4">
            {/* Block 1: Datos del Trabajador */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                    <div className="flex items-center gap-2">
                        <User size={15} className="text-indigo-600" />
                        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                            Datos del Trabajador
                        </h4>
                    </div>
                    {computedAge !== '' && (
                        <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                            Edad: {computedAge} años
                        </span>
                    )}
                </div>

                <div>
                    <label className={labelCls}>Nombre Completo *</label>
                    <input
                        type="text"
                        value={form.trabajador_nombre}
                        onChange={(e) => handleField('trabajador_nombre', e.target.value)}
                        placeholder="EJ. NELSON IVAN RIVERA HERNANDEZ"
                        className={inputCls}
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                        <label className={labelCls}>Fecha Nacimiento</label>
                        <input
                            type="date"
                            value={form.fecha_nacimiento}
                            onChange={(e) => handleField('fecha_nacimiento', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-[13px] font-medium"
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Sexo</label>
                        <select
                            value={form.sexo}
                            onChange={(e) => handleField('sexo', e.target.value)}
                            className={inputCls}
                        >
                            {SEXOS_OPCIONES.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Edad (años)</label>
                        <input
                            type="number"
                            min="14"
                            max="100"
                            value={form.edad}
                            onChange={(e) => handleField('edad', e.target.value)}
                            placeholder="Ej. 42"
                            className={inputCls}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className={labelCls}>Estado Civil</label>
                        <input
                            type="text"
                            list="contrato-estados-civiles"
                            value={form.estado_civil}
                            onChange={(e) => handleField('estado_civil', e.target.value)}
                            placeholder="EJ. SOLTERO"
                            className={inputCls}
                        />
                        <datalist id="contrato-estados-civiles">
                            {ESTADOS_CIVILES.map((ec) => (
                                <option key={ec} value={ec} />
                            ))}
                        </datalist>
                    </div>
                    <div>
                        <label className={labelCls}>Profesión u Oficio</label>
                        <input
                            type="text"
                            value={form.profesion_oficio}
                            onChange={(e) => handleField('profesion_oficio', e.target.value)}
                            placeholder="EJ. ESTUDIANTE"
                            className={inputCls}
                        />
                    </div>
                </div>

                <div>
                    <label className={labelCls}>Dirección de Residencia</label>
                    <input
                        type="text"
                        value={form.direccion}
                        onChange={(e) => handleField('direccion', e.target.value)}
                        placeholder="EJ. ATIQUIZAYA, CANTON EL ROBLE"
                        className={inputCls}
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                        <label className={labelCls}>Nacionalidad</label>
                        <input
                            type="text"
                            value={form.nacionalidad}
                            onChange={(e) => handleField('nacionalidad', e.target.value)}
                            placeholder="SALVADOREÑO"
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>DUI No.</label>
                        <input
                            type="text"
                            value={form.num_dui}
                            onChange={(e) => handleField('num_dui', e.target.value)}
                            placeholder="00000000-0"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-[13px] font-mono font-medium"
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Extendido en</label>
                        <input
                            type="text"
                            value={form.dui_extendido_en}
                            onChange={(e) => handleField('dui_extendido_en', e.target.value)}
                            placeholder="EJ. AHUACHAPAN"
                            className={inputCls}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className={labelCls}>NIT No.</label>
                        <input
                            type="text"
                            value={form.num_nit}
                            onChange={(e) => handleField('num_nit', e.target.value)}
                            placeholder="0000-000000-000-0"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-[13px] font-mono font-medium"
                        />
                    </div>
                    <div>
                        <label className={labelCls}>ISSS No.</label>
                        <input
                            type="text"
                            value={form.num_isss}
                            onChange={(e) => handleField('num_isss', e.target.value)}
                            placeholder="109840280"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-[13px] font-mono font-medium"
                        />
                    </div>
                </div>
            </div>

            {/* Block 2: Cargo Laboral y Lugar de Trabajo */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
                    <Briefcase size={15} className="text-indigo-600" />
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                        Cargo Laboral y Lugar de Trabajo
                    </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className={labelCls}>Cargo Laboral *</label>
                        <input
                            type="text"
                            value={form.cargo_laboral}
                            onChange={(e) => handleField('cargo_laboral', e.target.value)}
                            placeholder="EJ. AGENTE DE PISTA"
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Lugar de Trabajo *</label>
                        <input
                            type="text"
                            value={form.lugar_trabajo}
                            onChange={(e) => handleField('lugar_trabajo', e.target.value)}
                            placeholder="EJ. SHELL CHALCHUAPA"
                            className={inputCls}
                        />
                    </div>
                </div>

                <div>
                    <label className={labelCls}>Obligaciones</label>
                    <input
                        type="text"
                        value={form.obligaciones}
                        onChange={(e) => handleField('obligaciones', e.target.value)}
                        placeholder="EJ. ATENCION AL CLIENTE, ORDEN Y LIMPIEZA"
                        className={inputCls}
                    />
                </div>

                <div>
                    <label className={labelCls}>Jefe Inmediato</label>
                    <input
                        type="text"
                        value={form.jefe_inmediato}
                        onChange={(e) => handleField('jefe_inmediato', e.target.value)}
                        placeholder="NOMBRE DEL JEFE INMEDIATO"
                        className={inputCls}
                    />
                </div>
            </div>

            {/* Block 3: Plazo y Fechas del Contrato */}
            <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
                    <Calendar size={15} className="text-indigo-600" />
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                        Plazo y Celebración del Contrato
                    </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className={labelCls}>Plazo de Contrato</label>
                        <input
                            type="text"
                            list="contrato-plazos-list"
                            value={form.plazo_contrato}
                            onChange={(e) => handleField('plazo_contrato', e.target.value)}
                            placeholder="TIEMPO INDEFINIDO"
                            className={inputCls}
                        />
                        <datalist id="contrato-plazos-list">
                            {PLAZOS_CONTRATO.map((p) => (
                                <option key={p} value={p} />
                            ))}
                        </datalist>
                    </div>
                    <div>
                        <label className={labelCls}>Fecha Inicio Laboral *</label>
                        <input
                            type="date"
                            value={form.fecha_inicio}
                            onChange={(e) => handleField('fecha_inicio', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-[13px] font-medium"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className={labelCls}>Lugar de Creación</label>
                        <input
                            type="text"
                            value={form.lugar_creacion}
                            onChange={(e) => handleField('lugar_creacion', e.target.value)}
                            placeholder="SAN SALVADOR"
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Fecha Creación (Firma) *</label>
                        <input
                            type="date"
                            value={form.fecha_creacion}
                            onChange={(e) => handleField('fecha_creacion', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-[13px] font-medium"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContratoTrabajadorSection;

