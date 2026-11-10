import { Building2 } from 'lucide-react';

const cls = "w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-[13px] font-medium";
const subLbl = "text-[10px] font-bold text-slate-500 uppercase mb-1 block";

const RhPatronoConfigSection = ({ patrono, onChange }) => {
    const handleField = (key, value) => {
        onChange((prev) => ({ ...prev, [key]: value }));
    };

    return (
        <div className="pt-2 border-t border-slate-50">
            <div className="flex items-center gap-2 mb-1">
                <Building2 size={16} className="text-indigo-600" />
                <label className="block text-[11px] font-bold text-slate-500 uppercase ml-0.5">
                    Datos del Patrono / Contratante Patronal
                </label>
            </div>
            <p className="text-xs text-slate-400 mb-3">
                Generales del patrono o representante legal para contratos individuales de trabajo y documentos laborales de esta empresa. Si se deja vacío el nombre, se tomará la razón social de la empresa.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                    <label className={subLbl}>Nombre del Patrono / Representante Legal</label>
                    <input
                        type="text"
                        value={patrono.patrono_nombre}
                        onChange={(e) => handleField('patrono_nombre', e.target.value)}
                        placeholder="Ej. Nombre completo del patrono o representante"
                        className={cls}
                    />
                </div>

                <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                    <div>
                        <label className={subLbl}>Edad</label>
                        <input
                            type="number"
                            min="18"
                            max="120"
                            value={patrono.patrono_edad}
                            onChange={(e) => handleField('patrono_edad', e.target.value)}
                            placeholder="Ej. 45"
                            className={cls}
                        />
                    </div>
                    <div>
                        <label className={subLbl}>Sexo</label>
                        <select
                            value={patrono.patrono_sexo}
                            onChange={(e) => handleField('patrono_sexo', e.target.value)}
                            className={cls}
                        >
                            <option value="">Seleccionar...</option>
                            <option value="MASCULINO">MASCULINO</option>
                            <option value="FEMENINO">FEMENINO</option>
                        </select>
                    </div>
                    <div>
                        <label className={subLbl}>Estado Civil</label>
                        <input
                            type="text"
                            value={patrono.patrono_estado_civil}
                            onChange={(e) => handleField('patrono_estado_civil', e.target.value)}
                            placeholder="CASADO / SOLTERO..."
                            className={cls}
                        />
                    </div>
                </div>

                <div>
                    <label className={subLbl}>Profesión u Oficio</label>
                    <input
                        type="text"
                        value={patrono.patrono_profesion}
                        onChange={(e) => handleField('patrono_profesion', e.target.value)}
                        placeholder="Ej. COMERCIANTE / LICENCIADO..."
                        className={cls}
                    />
                </div>

                <div>
                    <label className={subLbl}>Nacionalidad</label>
                    <input
                        type="text"
                        value={patrono.patrono_nacionalidad}
                        onChange={(e) => handleField('patrono_nacionalidad', e.target.value)}
                        placeholder="SALVADOREÑA"
                        className={cls}
                    />
                </div>

                <div className="sm:col-span-2">
                    <label className={subLbl}>Dirección del Patrono</label>
                    <input
                        type="text"
                        value={patrono.patrono_direccion}
                        onChange={(e) => handleField('patrono_direccion', e.target.value)}
                        placeholder="Dirección completa del domicilio patronal"
                        className={cls}
                    />
                </div>

                <div>
                    <label className={subLbl}>DUI No.</label>
                    <input
                        type="text"
                        value={patrono.patrono_dui}
                        onChange={(e) => handleField('patrono_dui', e.target.value)}
                        placeholder="00000000-0"
                        className={cls}
                    />
                </div>

                <div>
                    <label className={subLbl}>DUI Extendido en</label>
                    <input
                        type="text"
                        value={patrono.patrono_dui_extendido}
                        onChange={(e) => handleField('patrono_dui_extendido', e.target.value)}
                        placeholder="Ej. SAN SALVADOR"
                        className={cls}
                    />
                </div>

                <div className="sm:col-span-2">
                    <label className={subLbl}>NIT del Patrono / Empresa</label>
                    <input
                        type="text"
                        value={patrono.patrono_nit}
                        onChange={(e) => handleField('patrono_nit', e.target.value)}
                        placeholder="0000-000000-000-0 (si se deja vacío usa el NIT de la empresa)"
                        className={cls}
                    />
                </div>
            </div>
        </div>
    );
};

export default RhPatronoConfigSection;

