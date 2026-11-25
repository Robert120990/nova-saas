import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Globe, Truck, FileText } from 'lucide-react';
import { unwrapList } from '../../../../utils/apiUtils';

const inputClass = 'w-full text-[13px] font-medium px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none';
const labelClass = 'block text-[11px] font-bold text-slate-500 uppercase mb-1';

const RECINTOS_FISCALES = [
    { code: '00', label: '00 - No Aplica / Aduana Interior' },
    { code: '01', label: '01 - Aduana Terrestre San Bartolo' },
    { code: '02', label: '02 - Aduana Marítima Acajutla' },
    { code: '03', label: '03 - Aduana Aérea Monseñor Óscar A. Romero' },
    { code: '04', label: '04 - Aduana Terrestre Las Chinamas' },
    { code: '05', label: '05 - Aduana Terrestre La Hachadura' },
    { code: '06', label: '06 - Aduana Santa Ana' },
    { code: '07', label: '07 - Aduana San Cristóbal' },
    { code: '08', label: '08 - Aduana Anguiatú' },
    { code: '09', label: '09 - Aduana El Poy' },
    { code: '10', label: '10 - Aduana El Amatillo' },
    { code: '11', label: '11 - Aduana La Unión / Cutuco' },
    { code: '12', label: '12 - Aduana Ilopango' },
    { code: '36', label: '36 - Zona Franca / Parque Industrial' }
];

export default function CorrectionExportacionTab({
    dteType,
    exportacion,
    remision,
    observaciones,
    syncCustomerCountry,
    onChangeExportacion,
    onChangeRemision,
    onChangeObservaciones,
    onChangeSyncCustomerCountry
}) {
    const isFex = String(dteType) === '11';
    const isNr = String(dteType) === '04';

    const { data: countries = [] } = useQuery({
        queryKey: ['catalogs', 'cat_020_pais'],
        queryFn: async () => unwrapList(await axios.get('/api/catalogs/cat_020_pais')),
        enabled: isFex
    });

    const isoCountries = useMemo(
        () => (Array.isArray(countries) ? countries : []).filter(c => String(c.code || '').trim().length === 2),
        [countries]
    );

    const isServiceExport = Number(exportacion?.export_item_type) === 2;

    return (
        <div className="space-y-4">
            {isFex && (
                <div className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-indigo-900">
                        <Globe size={15} className="text-indigo-600" />
                        <span>Campos Aduaneros y Exportación (FEX - 11)</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>Tipo de Ítem Exportación (CAT-011) *</label>
                            <select
                                value={String(exportacion?.export_item_type || 1)}
                                onChange={(e) => {
                                    const nextType = Number(e.target.value);
                                    onChangeExportacion({
                                        ...exportacion,
                                        export_item_type: nextType,
                                        fiscal_enclosure: nextType === 2 ? '' : (exportacion?.fiscal_enclosure || '00'),
                                        export_regime: nextType === 2 ? '' : (exportacion?.export_regime || 'EX-1')
                                    });
                                }}
                                className={inputClass}
                            >
                                <option value="1">1 - Bienes</option>
                                <option value="2">2 - Servicios (sin recinto/régimen)</option>
                                <option value="3">3 - Bienes y Servicios</option>
                            </select>
                        </div>

                        <div>
                            <label className={labelClass}>País Destino (CAT-020 ISO) *</label>
                            <select
                                value={exportacion?.dest_country_code || ''}
                                onChange={(e) => onChangeExportacion({ ...exportacion, dest_country_code: e.target.value })}
                                className={inputClass}
                            >
                                <option value="">-- Seleccionar País --</option>
                                {isoCountries.map(p => (
                                    <option key={p.code} value={p.code}>{p.code} - {p.description}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className={labelClass}>Recinto Fiscal (CAT-027)</label>
                            <select
                                value={exportacion?.fiscal_enclosure || ''}
                                disabled={isServiceExport}
                                onChange={(e) => onChangeExportacion({ ...exportacion, fiscal_enclosure: e.target.value })}
                                className={`${inputClass} disabled:bg-slate-100 disabled:text-slate-400`}
                            >
                                <option value="">-- Seleccione Recinto --</option>
                                {RECINTOS_FISCALES.map(r => (
                                    <option key={r.code} value={r.code}>{r.label}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className={labelClass}>Régimen de Exportación (CAT-033)</label>
                            <select
                                value={exportacion?.export_regime || ''}
                                disabled={isServiceExport}
                                onChange={(e) => onChangeExportacion({ ...exportacion, export_regime: e.target.value })}
                                className={`${inputClass} disabled:bg-slate-100 disabled:text-slate-400`}
                            >
                                <option value="">-- Seleccione Régimen --</option>
                                <option value="EX-1">EX-1 - Exportación Definitiva</option>
                                <option value="EX-2">EX-2 - Exportación Temporal</option>
                                <option value="EX-3">EX-3 - Reexportación</option>
                                <option value="TA-1">TA-1 - Traslado / Zona Franca</option>
                            </select>
                        </div>
                    </div>

                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-900 cursor-pointer pt-1">
                        <input
                            type="checkbox"
                            checked={syncCustomerCountry}
                            onChange={(e) => onChangeSyncCustomerCountry(e.target.checked)}
                            className="rounded border-indigo-300 text-indigo-600"
                        />
                        <span>Actualizar también el País ISO en la ficha del cliente</span>
                    </label>
                </div>
            )}

            {isNr && (
                <div className="p-4 bg-sky-50/50 border border-sky-200 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-sky-900">
                        <Truck size={15} className="text-sky-600" />
                        <span>Datos de Nota de Remisión (04)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className={labelClass}>Título de Remisión</label>
                            <select
                                value={remision?.remission_type || '02'}
                                onChange={(e) => onChangeRemision({ ...remision, remission_type: e.target.value })}
                                className={inputClass}
                            >
                                <option value="01">01 - Depósito</option>
                                <option value="02">02 - Propiedad / Traslado</option>
                                <option value="03">03 - Consignación</option>
                                <option value="04">04 - Traslado</option>
                                <option value="05">05 - Otros</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Transportista / Motorista</label>
                            <input
                                type="text"
                                value={remision?.transporter_name || ''}
                                onChange={(e) => onChangeRemision({ ...remision, transporter_name: e.target.value })}
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Placa Vehículo</label>
                            <input
                                type="text"
                                value={remision?.vehicle_plate || ''}
                                onChange={(e) => onChangeRemision({ ...remision, vehicle_plate: e.target.value.toUpperCase() })}
                                className={`${inputClass} font-mono`}
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2">
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase">
                    <FileText size={13} className="text-slate-500" />
                    <span>Observaciones Generales del Documento</span>
                </label>
                <textarea
                    rows={3}
                    value={observaciones || ''}
                    onChange={(e) => onChangeObservaciones(e.target.value)}
                    placeholder="Notas o aclaraciones del documento..."
                    className={inputClass}
                />
            </div>
        </div>
    );
}
