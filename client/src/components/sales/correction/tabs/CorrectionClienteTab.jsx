import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { AlertTriangle, Building2 } from 'lucide-react';
import { unwrapList } from '../../../../utils/apiUtils';
import { validateDocumentNumber, formatDocumentNumber, formatNRC } from '../../../../utils/svfeValidators';

const inputClass = 'w-full text-[13px] font-medium px-3 py-2 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none';
const labelClass = 'block text-[11px] font-bold text-slate-500 uppercase mb-1';

export default function CorrectionClienteTab({
    dteType, customer, onChangeCustomer, customerBranch,
    syncBranchAddress, onChangeSyncBranch, clienteNombreFallback, onChangeClienteNombreFallback
}) {
    const [actFilter, setActFilter] = useState('');

    const { data: departments = [] } = useQuery({
        queryKey: ['catalogs', 'departments'],
        queryFn: async () => unwrapList(await axios.get('/api/catalogs/departments'))
    });
    const { data: municipalities = [] } = useQuery({
        queryKey: ['catalogs', 'municipalities', customer?.departamento || ''],
        queryFn: async () => unwrapList(await axios.get(`/api/catalogs/municipalities?dep_code=${customer?.departamento}`)),
        enabled: Boolean(customer?.departamento)
    });
    const { data: allDistricts = [] } = useQuery({
        queryKey: ['catalogs', 'districts', customer?.departamento || ''],
        queryFn: async () => unwrapList(await axios.get(`/api/catalogs/districts?dep_code=${customer?.departamento}`)),
        enabled: Boolean(customer?.departamento)
    });
    const { data: activities = [] } = useQuery({
        queryKey: ['catalogs', 'actividades'],
        queryFn: async () => unwrapList(await axios.get('/api/catalogs/actividades'))
    });
    const { data: countries = [] } = useQuery({
        queryKey: ['catalogs', 'cat_020_pais'],
        queryFn: async () => unwrapList(await axios.get('/api/catalogs/cat_020_pais'))
    });

    const filteredDistricts = useMemo(() => {
        const list = Array.isArray(allDistricts) ? allDistricts : [];
        if (!customer?.municipio) return list;
        const byMuni = list.filter(d => String(d.muni_code) === String(customer.municipio));
        return byMuni.length > 0 ? byMuni : list;
    }, [allDistricts, customer?.municipio]);

    const filteredActivities = useMemo(() => {
        const list = Array.isArray(activities) ? activities : [];
        const q = actFilter.trim().toLowerCase();
        if (!q) return list.slice(0, 250);
        return list.filter(a => String(a.code).includes(q) || String(a.description || '').toLowerCase().includes(q)).slice(0, 150);
    }, [activities, actFilter]);

    const isoCountries = useMemo(
        () => (Array.isArray(countries) ? countries : []).filter(c => String(c.code || '').trim().length === 2),
        [countries]
    );

    if (!customer) {
        return (
            <div className="space-y-4">
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 flex items-start gap-2.5">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
                    <div>
                        <p className="font-bold">Venta sin ficha de cliente vinculada (Consumidor Final)</p>
                        <p>Puede ajustar el nombre mostrado en el documento. Si requiere asignar un contribuyente nuevo, use &quot;Corregir Cliente&quot;.</p>
                    </div>
                </div>
                <div>
                    <label className={labelClass}>Nombre del Receptor en Venta</label>
                    <input type="text" value={clienteNombreFallback || ''} onChange={(e) => onChangeClienteNombreFallback(e.target.value)} placeholder="Consumidor Final" className={inputClass} />
                </div>
            </div>
        );
    }

    const updateField = (patch) => onChangeCustomer({ ...customer, ...patch });
    const nitCheck = customer.nit ? validateDocumentNumber(customer.nit, 'NIT') : null;
    const missingDistrito = !['11', '14'].includes(String(dteType)) && !customer.distrito;
    const missingCcfNit = String(dteType) === '03' && (!customer.nit || !nitCheck?.isValid);

    return (
        <div className="space-y-4">
            {(missingDistrito || missingCcfNit) && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-start gap-2">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-600" />
                    <div className="space-y-0.5">
                        {missingDistrito && <p className="font-bold">Falta seleccionar el Distrito (requerido por Hacienda en dirección del receptor).</p>}
                        {missingCcfNit && <p className="font-bold">Para CCF (03) se requiere NIT válido ({nitCheck?.error || 'requerido'}) y NRC vigente.</p>}
                    </div>
                </div>
            )}

            {customerBranch && (
                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-indigo-900">
                        <Building2 size={15} className="text-indigo-600 shrink-0" />
                        <span>Sucursal de cliente asignada: <strong>{customerBranch.nombre}</strong></span>
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-800 cursor-pointer">
                        <input type="checkbox" checked={syncBranchAddress} onChange={(e) => onChangeSyncBranch(e.target.checked)} className="rounded border-indigo-300 text-indigo-600" />
                        <span>Sincronizar dirección/distrito con sucursal</span>
                    </label>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                    <label className={labelClass}>Nombre o Razón Social *</label>
                    <input type="text" value={customer.nombre || ''} onChange={(e) => updateField({ nombre: e.target.value })} className={inputClass} />
                </div>
                <div>
                    <label className={labelClass}>Nombre Comercial</label>
                    <input type="text" value={customer.nombre_comercial || ''} onChange={(e) => updateField({ nombre_comercial: e.target.value })} className={inputClass} />
                </div>
                <div>
                    <label className={labelClass}>Tipo Documento</label>
                    <select
                        value={customer.tipo_documento || 'DUI'}
                        onChange={(e) => updateField({ tipo_documento: e.target.value, numero_documento: formatDocumentNumber(customer.numero_documento || '', e.target.value) })}
                        className={inputClass}
                    >
                        <option value="DUI">DUI (13)</option>
                        <option value="NIT">NIT (36)</option>
                        <option value="Pasaporte">Pasaporte (03)</option>
                        <option value="Carnet Resident">Carnet Residente (02)</option>
                        <option value="Otro">Otro Extranjero (37)</option>
                    </select>
                </div>
                <div>
                    <label className={labelClass}>N° Documento (DUI / Otro)</label>
                    <input
                        type="text"
                        value={customer.numero_documento || ''}
                        onChange={(e) => {
                            const formatted = formatDocumentNumber(e.target.value, customer.tipo_documento);
                            updateField({ numero_documento: formatted, ...(customer.tipo_documento === 'NIT' ? { nit: formatted } : {}) });
                        }}
                        className={`${inputClass} font-mono`}
                    />
                </div>
                <div>
                    <label className={labelClass}>NIT Contribuyente</label>
                    <input type="text" value={customer.nit || ''} onChange={(e) => updateField({ nit: formatDocumentNumber(e.target.value, 'NIT') })} placeholder="0000-000000-000-0" className={`${inputClass} font-mono`} />
                </div>
                <div>
                    <label className={labelClass}>NRC</label>
                    <input type="text" value={customer.nrc || ''} onChange={(e) => updateField({ nrc: formatNRC(e.target.value) })} placeholder="000000-0" className={`${inputClass} font-mono`} />
                </div>
                <div>
                    <label className={labelClass}>Tipo Persona (CAT-029)</label>
                    <select value={String(customer.tipo_persona || '1')} onChange={(e) => updateField({ tipo_persona: e.target.value })} className={inputClass}>
                        <option value="1">1 - Persona Natural</option>
                        <option value="2">2 - Persona Jurídica</option>
                    </select>
                </div>
                <div>
                    <label className={labelClass}>Condición Fiscal</label>
                    <select
                        value={customer.condicion_fiscal || 'otro'}
                        onChange={(e) => updateField({ condicion_fiscal: e.target.value, exento_iva: e.target.value === 'exento IVA' ? true : customer.exento_iva })}
                        className={inputClass}
                    >
                        <option value="otro">Contribuyente / General</option>
                        <option value="gran contribuyente">Gran Contribuyente</option>
                        <option value="exento IVA">Exento IVA</option>
                        <option value="extranjero">Extranjero / Exportación</option>
                    </select>
                </div>

                <div className="sm:col-span-2 lg:col-span-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Actividad Económica (CAT-019)</label>
                        <input type="text" value={actFilter} onChange={(e) => setActFilter(e.target.value)} placeholder="Filtrar giro o código..." className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 outline-none focus:border-indigo-400 w-full sm:w-64" />
                    </div>
                    <select value={customer.codigo_actividad || ''} onChange={(e) => updateField({ codigo_actividad: e.target.value })} className={inputClass}>
                        <option value="">-- Seleccionar Actividad Económica --</option>
                        {customer.codigo_actividad && !filteredActivities.some(a => a.code === customer.codigo_actividad) && (
                            <option value={customer.codigo_actividad}>{customer.codigo_actividad} - {customer.actividad_economica || 'Actual'}</option>
                        )}
                        {filteredActivities.map(a => <option key={a.code} value={a.code}>{a.code} - {a.description}</option>)}
                    </select>
                </div>

                <div>
                    <label className={labelClass}>Departamento (CAT-012)</label>
                    <select value={customer.departamento || ''} onChange={(e) => updateField({ departamento: e.target.value, municipio: '', distrito: '' })} className={inputClass}>
                        <option value="">-- Seleccione --</option>
                        {(Array.isArray(departments) ? departments : []).map(d => <option key={d.code} value={d.code}>{d.code} - {d.description}</option>)}
                    </select>
                </div>
                <div>
                    <label className={labelClass}>Municipio (CAT-013)</label>
                    <select value={customer.municipio || ''} onChange={(e) => updateField({ municipio: e.target.value, distrito: '' })} className={inputClass}>
                        <option value="">-- Seleccione --</option>
                        {(Array.isArray(municipalities) ? municipalities : []).map(m => <option key={m.code} value={m.code}>{m.code} - {m.description}</option>)}
                    </select>
                </div>
                <div>
                    <label className={labelClass}>Distrito (CAT-008) *</label>
                    <select
                        value={customer.distrito || ''}
                        onChange={(e) => {
                            const selected = filteredDistricts.find(d => String(d.code) === String(e.target.value));
                            updateField({ distrito: e.target.value, ...(selected?.muni_code ? { municipio: selected.muni_code } : {}) });
                        }}
                        className={`${inputClass} ${missingDistrito ? 'border-rose-400 bg-rose-50/40' : ''}`}
                    >
                        <option value="">-- Seleccionar Distrito --</option>
                        {filteredDistricts.map(d => <option key={`${d.muni_code}-${d.code}`} value={d.code}>{d.code} - {d.description}</option>)}
                    </select>
                </div>
                <div className="sm:col-span-2">
                    <label className={labelClass}>Dirección Complemento</label>
                    <input type="text" value={customer.direccion || ''} onChange={(e) => updateField({ direccion: e.target.value })} className={inputClass} />
                </div>
                <div>
                    <label className={labelClass}>País (CAT-020 ISO)</label>
                    <select value={customer.pais || 'SV'} onChange={(e) => updateField({ pais: e.target.value })} className={inputClass}>
                        <option value="">-- Seleccione País --</option>
                        {isoCountries.map(p => <option key={p.code} value={p.code}>{p.code} - {p.description}</option>)}
                    </select>
                </div>
                <div>
                    <label className={labelClass}>Teléfono</label>
                    <input type="text" value={customer.telefono || ''} onChange={(e) => updateField({ telefono: e.target.value })} className={inputClass} />
                </div>
                <div>
                    <label className={labelClass}>Correo Electrónico</label>
                    <input type="email" value={customer.correo || ''} onChange={(e) => updateField({ correo: e.target.value })} className={inputClass} />
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-2 sm:col-span-2 lg:col-span-3">
                    {[['exento_iva', 'Exento IVA'], ['aplica_fovial', 'Aplica FOVIAL'], ['aplica_cotrans', 'Aplica COTRANS']].map(([k, lbl]) => (
                        <label key={k} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                            <input type="checkbox" checked={k === 'exento_iva' ? Boolean(customer[k]) : customer[k] !== false} onChange={(e) => updateField({ [k]: e.target.checked })} className="rounded border-slate-300 text-indigo-600" />
                            <span>{lbl}</span>
                        </label>
                    ))}
                </div>
            </div>
        </div>
    );
}
