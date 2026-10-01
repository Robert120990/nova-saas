import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Settings, X, Save, Sun, BatteryCharging, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function EnergyConfigModal({ open, onClose, onSaved, companyId }) {
    const { user } = useAuth();
    const activeCompanyId = companyId || user?.company_id || 9;
    const companyHeaders = { 'x-company-id': String(activeCompanyId) };
    const [formData, setFormData] = useState({
        growatt_url: 'https://server.growatt.com/',
        growatt_username: 'Raul_Sosa',
        growatt_password: '',
        growatt_enabled: true,
        growatt_plant_id: '2410077',
        plant_name: 'Andelsa',
        gess_url: 'http://gess.net.cn/SolarWeb/',
        gess_username: 'proyectos',
        gess_password: '',
        gess_plant_id: 218,
        gess_enabled: true,
        sync_interval_hours: 4,
        peak_start_time: '18:00',
        peak_end_time: '22:00',
        peak_kwh_rate: 0.22,
        offpeak_kwh_rate: 0.14,
        solar_kwh_value: 0.17
    });

    const [saving, setSaving] = useState(false);
    const [hasGrowattPass, setHasGrowattPass] = useState(false);
    const [hasGessPass, setHasGessPass] = useState(false);

    useEffect(() => {
        if (!open) return;
        axios.get('/api/energy/config', { headers: companyHeaders })
            .then(res => {
                if (res.data?.data) {
                    const d = res.data.data;
                    setHasGrowattPass(!!d.has_growatt_password);
                    setHasGessPass(!!d.has_gess_password);
                    setFormData({
                        growatt_url: d.growatt_url || 'https://server.growatt.com/',
                        growatt_username: d.growatt_username || 'Raul_Sosa',
                        growatt_password: '',
                        growatt_enabled: d.growatt_enabled === 1 || d.growatt_enabled === true,
                        growatt_plant_id: d.growatt_plant_id || (Number(activeCompanyId) === 1 ? '2604519' : '2410077'),
                        plant_name: d.plant_name || (Number(activeCompanyId) === 1 ? 'Puma San Martín II' : 'Andelsa'),
                        gess_url: d.gess_url || 'http://gess.net.cn/SolarWeb/',
                        gess_username: d.gess_username || 'proyectos',
                        gess_password: '',
                        gess_plant_id: d.gess_plant_id || 218,
                        gess_enabled: d.gess_enabled === 1 || d.gess_enabled === true,
                        sync_interval_hours: d.sync_interval_hours || 4,
                        peak_start_time: d.peak_start_time?.slice(0, 5) || '18:00',
                        peak_end_time: d.peak_end_time?.slice(0, 5) || '22:00',
                        peak_kwh_rate: parseFloat(d.peak_kwh_rate) || 0.22,
                        offpeak_kwh_rate: parseFloat(d.offpeak_kwh_rate) || 0.14,
                        solar_kwh_value: parseFloat(d.solar_kwh_value) || 0.17
                    });
                }
            })
            .catch(err => {
                toast.error('Error al cargar configuración: ' + (err.response?.data?.message || err.message));
            });
    }, [open, activeCompanyId]);

    if (!open) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await axios.put('/api/energy/config', formData, { headers: companyHeaders });
            toast.success('Configuración energética guardada con éxito');
            if (onSaved) onSaved();
            onClose();
        } catch (err) {
            toast.error('Error al guardar configuración: ' + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                            <Settings className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                Configuración del Sistema Energético
                            </h3>
                            <p className="text-xs text-slate-500">
                                Conexión con portales Growatt (inversores) y GESS (baterías)
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-5 space-y-6">
                    {/* Sección 1: Growatt (Inversores) */}
                    <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-500/5 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                                <Sun className="w-4 h-4 text-amber-500" />
                                Inversores Solares (Growatt)
                            </span>
                            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-600 dark:text-slate-300">
                                <input 
                                    type="checkbox"
                                    checked={formData.growatt_enabled}
                                    onChange={(e) => setFormData({ ...formData, growatt_enabled: e.target.checked })}
                                    className="rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                                />
                                Habilitado
                            </label>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase">Planta Growatt Asignada</label>
                                <select 
                                    value={formData.growatt_plant_id}
                                    onChange={(e) => {
                                        const pid = e.target.value;
                                        setFormData({
                                            ...formData,
                                            growatt_plant_id: pid,
                                            plant_name: pid === '2410077' ? 'Andelsa' : (pid === '2604519' ? 'Puma San Martín II' : formData.plant_name)
                                        });
                                    }}
                                    className="mt-1 w-full text-[13px] font-medium p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                >
                                    <option value="2410077">2410077 - Andelsa (~200 kWp)</option>
                                    <option value="2604519">2604519 - Puma San Martín II (~140 kWp)</option>
                                </select>
                            </div>
                            <div className="sm:col-span-2">
                                <label className="text-[11px] font-bold text-slate-500 uppercase">Nombre Descriptivo de la Planta</label>
                                <input 
                                    type="text"
                                    value={formData.plant_name}
                                    onChange={(e) => setFormData({ ...formData, plant_name: e.target.value })}
                                    className="mt-1 w-full text-[13px] font-medium p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                    placeholder="Ej. Andelsa o Puma San Martín II"
                                />
                            </div>
                            <div className="sm:col-span-3">
                                <label className="text-[11px] font-bold text-slate-500 uppercase">URL del Servidor</label>
                                <input 
                                    type="text"
                                    value={formData.growatt_url}
                                    onChange={(e) => setFormData({ ...formData, growatt_url: e.target.value })}
                                    className="mt-1 w-full text-[13px] font-medium p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase">Usuario</label>
                                <input 
                                    type="text"
                                    value={formData.growatt_username}
                                    onChange={(e) => setFormData({ ...formData, growatt_username: e.target.value })}
                                    className="mt-1 w-full text-[13px] font-medium p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center justify-between">
                                    <span>Contraseña</span>
                                    {hasGrowattPass && (
                                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 lowercase first-letter:uppercase">
                                            ✓ Cifrada en BD
                                        </span>
                                    )}
                                </label>
                                <input 
                                    type="password"
                                    value={formData.growatt_password}
                                    placeholder={hasGrowattPass ? '•••••••• (En blanco para conservar)' : 'Ingresa la contraseña'}
                                    onChange={(e) => setFormData({ ...formData, growatt_password: e.target.value })}
                                    className="mt-1 w-full text-[13px] font-medium p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Sección 2: GESS SolarWeb (Banco de Baterías) */}
                    <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/40 bg-indigo-500/5 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide flex items-center gap-1.5">
                                <BatteryCharging className="w-4 h-4 text-indigo-500" />
                                Banco Baterías & EMS (GESS SolarWeb)
                            </span>
                            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-600 dark:text-slate-300">
                                <input 
                                    type="checkbox"
                                    checked={formData.gess_enabled}
                                    onChange={(e) => setFormData({ ...formData, gess_enabled: e.target.checked })}
                                    className="rounded border-slate-300 text-indigo-500 focus:ring-indigo-400"
                                />
                                Habilitado
                            </label>
                        </div>

                        {!formData.gess_enabled && (
                            <div className="p-2.5 rounded-lg bg-indigo-100/70 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-[11px] text-indigo-800 dark:text-indigo-300 font-medium">
                                💡 <strong>Modo Solo Solar (Sin Baterías):</strong> Esta localidad inyecta energía fotovoltaica directamente a la planta/red sin banco de baterías BESS. Las métricas y ahorros se calculan al 100% sobre la generación solar.
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="sm:col-span-2">
                                <label className="text-[11px] font-bold text-slate-500 uppercase">URL del Portal</label>
                                <input 
                                    type="text"
                                    value={formData.gess_url}
                                    onChange={(e) => setFormData({ ...formData, gess_url: e.target.value })}
                                    className="mt-1 w-full text-[13px] font-medium p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase">ID Planta GESS</label>
                                <input 
                                    type="number"
                                    value={formData.gess_plant_id}
                                    onChange={(e) => setFormData({ ...formData, gess_plant_id: e.target.value })}
                                    className="mt-1 w-full text-[13px] font-medium p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase">Usuario</label>
                                <input 
                                    type="text"
                                    value={formData.gess_username}
                                    onChange={(e) => setFormData({ ...formData, gess_username: e.target.value })}
                                    className="mt-1 w-full text-[13px] font-medium p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center justify-between">
                                    <span>Contraseña</span>
                                    {hasGessPass && (
                                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 lowercase first-letter:uppercase">
                                            ✓ Cifrada en BD
                                        </span>
                                    )}
                                </label>
                                <input 
                                    type="password"
                                    value={formData.gess_password}
                                    placeholder={hasGessPass ? '•••••••• (En blanco para conservar)' : 'Ingresa la contraseña'}
                                    onChange={(e) => setFormData({ ...formData, gess_password: e.target.value })}
                                    className="mt-1 w-full text-[13px] font-medium p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Sección 3: Frecuencia de Sincronización y Tarifas */}
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-slate-500" />
                            Frecuencia de Lecturas & Tarifas de Energía
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase">Auto-Sincronización</label>
                                <select 
                                    value={formData.sync_interval_hours}
                                    onChange={(e) => setFormData({ ...formData, sync_interval_hours: parseInt(e.target.value, 10) })}
                                    className="mt-1 w-full text-[13px] font-medium p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                >
                                    <option value={1}>Cada 1 hora</option>
                                    <option value={2}>Cada 2 horas</option>
                                    <option value={4}>Cada 4 horas (Recomendado)</option>
                                    <option value={6}>Cada 6 horas</option>
                                    <option value={8}>Cada 8 horas</option>
                                    <option value={12}>Cada 12 horas</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase">Inicio Hora Pico</label>
                                <input type="time" value={formData.peak_start_time} onChange={(e) => setFormData({ ...formData, peak_start_time: e.target.value })} className="mt-1 w-full text-[13px] font-medium p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase">Fin Hora Pico</label>
                                <input type="time" value={formData.peak_end_time} onChange={(e) => setFormData({ ...formData, peak_end_time: e.target.value })} className="mt-1 w-full text-[13px] font-medium p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase">Tarifa Red Pico ($/kWh)</label>
                                <input type="number" step="0.001" value={formData.peak_kwh_rate} onChange={(e) => setFormData({ ...formData, peak_kwh_rate: parseFloat(e.target.value) })} className="mt-1 w-full text-[13px] font-medium p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase">Tarifa Red Valle ($/kWh)</label>
                                <input type="number" step="0.001" value={formData.offpeak_kwh_rate} onChange={(e) => setFormData({ ...formData, offpeak_kwh_rate: parseFloat(e.target.value) })} className="mt-1 w-full text-[13px] font-medium p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase">Valor Energía Solar ($/kWh)</label>
                                <input type="number" step="0.001" value={formData.solar_kwh_value} onChange={(e) => setFormData({ ...formData, solar_kwh_value: parseFloat(e.target.value) })} className="mt-1 w-full text-[13px] font-medium p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" />
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Guardando...' : 'Guardar Configuración'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
