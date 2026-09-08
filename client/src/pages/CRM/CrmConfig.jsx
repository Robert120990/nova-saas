import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
    Save,
    ArrowLeft,
    Percent,
    Truck,
    Clock,
    AlertTriangle,
    Mail,
    FileText,
    Shield,
    Scale
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function CrmConfig() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [form, setForm] = useState({
        default_target_margin_pct: '22.00',
        default_payment_terms_days: '30',
        default_freight_per_lb: '0.0000',
        min_monthly_volume_lbs: '5000.00',
        contract_alert_days: '15',
        auto_apply_agreements_in_pos: true,
        require_supervisor_override: true,
        grace_period_days: '5',
        default_terms_conditions: '',
        notification_email: ''
    });

    const { data: crmSettings, isLoading } = useQuery({
        queryKey: ['crm-settings', user?.company_id],
        queryFn: async () => {
            const res = await axios.get('/api/crm/settings');
            return res.data;
        }
    });

    useEffect(() => {
        if (crmSettings) {
            setForm({
                default_target_margin_pct: crmSettings.default_target_margin_pct !== undefined ? String(crmSettings.default_target_margin_pct) : '22.00',
                default_payment_terms_days: crmSettings.default_payment_terms_days !== undefined ? String(crmSettings.default_payment_terms_days) : '30',
                default_freight_per_lb: crmSettings.default_freight_per_lb !== undefined ? String(crmSettings.default_freight_per_lb) : '0.0000',
                min_monthly_volume_lbs: crmSettings.min_monthly_volume_lbs !== undefined ? String(crmSettings.min_monthly_volume_lbs) : '5000.00',
                contract_alert_days: crmSettings.contract_alert_days !== undefined ? String(crmSettings.contract_alert_days) : '15',
                auto_apply_agreements_in_pos: Boolean(crmSettings.auto_apply_agreements_in_pos),
                require_supervisor_override: Boolean(crmSettings.require_supervisor_override),
                grace_period_days: crmSettings.grace_period_days !== undefined ? String(crmSettings.grace_period_days) : '5',
                default_terms_conditions: crmSettings.default_terms_conditions || '',
                notification_email: crmSettings.notification_email || ''
            });
        }
    }, [crmSettings]);

    const saveMutation = useMutation({
        mutationFn: async (payload) => {
            const res = await axios.post('/api/crm/settings', payload);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['crm-settings']);
            queryClient.invalidateQueries(['crm-customer-agreements']);
            toast.success('Configuración comercial guardada correctamente.');
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al guardar la configuración.');
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        saveMutation.mutate({
            ...form,
            default_target_margin_pct: parseFloat(form.default_target_margin_pct) || 0,
            default_payment_terms_days: parseInt(form.default_payment_terms_days, 10) || 0,
            default_freight_per_lb: parseFloat(form.default_freight_per_lb) || 0,
            min_monthly_volume_lbs: parseFloat(form.min_monthly_volume_lbs) || 0,
            contract_alert_days: parseInt(form.contract_alert_days, 10) || 0,
            grace_period_days: parseInt(form.grace_period_days, 10) || 0,
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px] text-slate-400">
                <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm font-medium">Cargando configuración comercial...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-sm">
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => navigate('/crm/acuerdos')}
                        className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700/60 transition-colors"
                        title="Regresar a Acuerdos Comerciales"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold text-white tracking-tight">
                                Configuración Comercial de CRM
                            </h1>
                            <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-[10px] font-bold rounded-full border border-indigo-500/20 uppercase tracking-wide">
                                Políticas y Precios
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Establezca los parámetros financieros, márgenes de utilidad y reglas de pacto de precios con clientes.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/crm/acuerdos')}
                        className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
                    >
                        Ver Acuerdos
                    </button>
                    <button
                        type="submit"
                        form="crm-config-form"
                        disabled={saveMutation.isPending}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
                    >
                        <Save size={15} />
                        {saveMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </div>

            <form id="crm-config-form" onSubmit={handleSubmit} className="space-y-6">
                {/* 1. Parámetros de Rentabilidad y Precios */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-5">
                    <div className="flex items-center gap-3 pb-4 border-b border-slate-800/80">
                        <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                            <Percent size={18} />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-white tracking-wide uppercase">
                                Parámetros de Margen y Rentabilidad Objetivo
                            </h2>
                            <p className="text-[11px] text-slate-400">
                                Valores de referencia para el simulador financiero de cotizaciones y nuevos acuerdos comerciales.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Margen objetivo */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Percent size={13} className="text-indigo-400" />
                                Margen Objetivo Predeterminado (%)
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="100"
                                    value={form.default_target_margin_pct}
                                    onChange={(e) => setForm({ ...form, default_target_margin_pct: e.target.value })}
                                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                                    placeholder="22.00"
                                    required
                                />
                                <span className="absolute right-3.5 top-2.5 text-xs text-slate-500 font-semibold">%</span>
                            </div>
                            <p className="text-[10px] text-slate-500">
                                Margen de utilidad base sugerido al simular acuerdos con nuevos clientes.
                            </p>
                        </div>

                        {/* Flete estándar */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Truck size={13} className="text-indigo-400" />
                                Flete Estándar por Libra ($/Lb)
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.0001"
                                    min="0"
                                    value={form.default_freight_per_lb}
                                    onChange={(e) => setForm({ ...form, default_freight_per_lb: e.target.value })}
                                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                                    placeholder="0.0000"
                                    required
                                />
                                <span className="absolute right-3.5 top-2.5 text-xs text-slate-500 font-semibold">$/Lb</span>
                            </div>
                            <p className="text-[10px] text-slate-500">
                                Costo logístico medio por libra para entregas locales o distribución.
                            </p>
                        </div>

                        {/* Volumen mensual mínimo */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Scale size={13} className="text-indigo-400" />
                                Volumen Mínimo para Acuerdo (Lbs)
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="1"
                                    min="0"
                                    value={form.min_monthly_volume_lbs}
                                    onChange={(e) => setForm({ ...form, min_monthly_volume_lbs: e.target.value })}
                                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                                    placeholder="5000"
                                    required
                                />
                                <span className="absolute right-3.5 top-2.5 text-xs text-slate-500 font-semibold">Lbs</span>
                            </div>
                            <p className="text-[10px] text-slate-500">
                                Cantidad mínima mensual sugerida para otorgar precios industriales preferenciales.
                            </p>
                        </div>
                    </div>
                </div>

                {/* 2. Políticas de Crédito y Alertas de Contratos */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-5">
                    <div className="flex items-center gap-3 pb-4 border-b border-slate-800/80">
                        <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                            <Clock size={18} />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-white tracking-wide uppercase">
                                Políticas de Plazos y Alertas de Vencimiento
                            </h2>
                            <p className="text-[11px] text-slate-400">
                                Automatice la vigilancia de contratos comerciales y términos de crédito otorgados.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Días de crédito */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                Plazo de Crédito Estándar (Días)
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="1"
                                    min="0"
                                    max="180"
                                    value={form.default_payment_terms_days}
                                    onChange={(e) => setForm({ ...form, default_payment_terms_days: e.target.value })}
                                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                                    placeholder="30"
                                    required
                                />
                                <span className="absolute right-3.5 top-2.5 text-xs text-slate-500 font-semibold">Días</span>
                            </div>
                            <p className="text-[10px] text-slate-500">
                                Días de pago estándar propuestos por defecto en acuerdos comerciales.
                            </p>
                        </div>

                        {/* Alerta de vencimiento */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <AlertTriangle size={13} className="text-amber-400" />
                                Alerta Previa de Vencimiento (Días)
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="1"
                                    min="1"
                                    max="90"
                                    value={form.contract_alert_days}
                                    onChange={(e) => setForm({ ...form, contract_alert_days: e.target.value })}
                                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                                    placeholder="15"
                                    required
                                />
                                <span className="absolute right-3.5 top-2.5 text-xs text-slate-500 font-semibold">Días antes</span>
                            </div>
                            <p className="text-[10px] text-slate-500">
                                Anticipación con la que se marcan los acuerdos en advertencia para renegociación.
                            </p>
                        </div>

                        {/* Días de gracia */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                Periodo de Gracia Post-Vencimiento (Días)
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="1"
                                    min="0"
                                    max="30"
                                    value={form.grace_period_days}
                                    onChange={(e) => setForm({ ...form, grace_period_days: e.target.value })}
                                    className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                                    placeholder="5"
                                    required
                                />
                                <span className="absolute right-3.5 top-2.5 text-xs text-slate-500 font-semibold">Días</span>
                            </div>
                            <p className="text-[10px] text-slate-500">
                                Días adicionales en que el precio del acuerdo se sigue respetando mientras se renueva.
                            </p>
                        </div>
                    </div>
                </div>

                {/* 3. Integración Operativa con Facturación y POS */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-5">
                    <div className="flex items-center gap-3 pb-4 border-b border-slate-800/80">
                        <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
                            <Shield size={18} />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-white tracking-wide uppercase">
                                Integración con Facturación y Controles Operativos
                            </h2>
                            <p className="text-[11px] text-slate-400">
                                Defina el comportamiento de precios en caja y las salvaguardas de margen comercial.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Switch: Auto aplicar precios */}
                        <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-950/40 border border-slate-800/80">
                            <input
                                id="auto_apply_pos"
                                type="checkbox"
                                checked={form.auto_apply_agreements_in_pos}
                                onChange={(e) => setForm({ ...form, auto_apply_agreements_in_pos: e.target.checked })}
                                className="mt-1 w-4 h-4 text-indigo-600 bg-slate-900 border-slate-700 rounded focus:ring-indigo-500 focus:ring-2 cursor-pointer"
                            />
                            <label htmlFor="auto_apply_pos" className="cursor-pointer select-none">
                                <span className="text-xs font-bold text-white block">
                                    Aplicar Precios de Acuerdos Automáticamente en Facturación y POS
                                </span>
                                <span className="text-[11px] text-slate-400 mt-1 block">
                                    Al seleccionar un cliente con acuerdo vigente en el Punto de Venta, el precio unitario del producto se reemplaza automáticamente por el pactado en CRM.
                                </span>
                            </label>
                        </div>

                        {/* Switch: Supervisor Override */}
                        <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-950/40 border border-slate-800/80">
                            <input
                                id="require_supervisor"
                                type="checkbox"
                                checked={form.require_supervisor_override}
                                onChange={(e) => setForm({ ...form, require_supervisor_override: e.target.checked })}
                                className="mt-1 w-4 h-4 text-indigo-600 bg-slate-900 border-slate-700 rounded focus:ring-indigo-500 focus:ring-2 cursor-pointer"
                            />
                            <label htmlFor="require_supervisor" className="cursor-pointer select-none">
                                <span className="text-xs font-bold text-white block">
                                    Requerir Autorización para Precios Menores al Acuerdo
                                </span>
                                <span className="text-[11px] text-slate-400 mt-1 block">
                                    Si un cajero o vendedor intenta facturar un precio más bajo que el acordado en CRM, solicitará PIN de supervisión para autorizar el descuento extraordinario.
                                </span>
                            </label>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                        {/* Correo de alertas comerciales */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Mail size={13} className="text-indigo-400" />
                                Correo para Alertas y Notificaciones Comerciales
                            </label>
                            <input
                                type="email"
                                value={form.notification_email}
                                onChange={(e) => setForm({ ...form, notification_email: e.target.value })}
                                className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                                placeholder="ventas@empresa.com"
                            />
                            <p className="text-[10px] text-slate-500">
                                Dirección donde se remitirán los reportes periódicos de acuerdos por vencer.
                            </p>
                        </div>
                    </div>
                </div>

                {/* 4. Cláusulas y Términos Comerciales Predeterminados */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-5">
                    <div className="flex items-center gap-3 pb-4 border-b border-slate-800/80">
                        <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
                            <FileText size={18} />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-white tracking-wide uppercase">
                                Plantilla de Términos y Condiciones Comerciales
                            </h2>
                            <p className="text-[11px] text-slate-400">
                                Texto estándar que se imprimirá o anexará en las cartas de acuerdo de precios y cotizaciones formales.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <textarea
                            rows={5}
                            value={form.default_terms_conditions}
                            onChange={(e) => setForm({ ...form, default_terms_conditions: e.target.value })}
                            className="w-full bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors font-mono leading-relaxed"
                            placeholder="1. Los precios pactados aplican exclusivamente..."
                        />
                        <p className="text-[10px] text-slate-500">
                            Puede detallar cláusulas de pago, penalidades por cancelación anticipada o tolerancias de pesaje.
                        </p>
                    </div>
                </div>

                {/* Botón de guardado inferior */}
                <div className="flex justify-end gap-3 pt-2">
                    <button
                        type="button"
                        onClick={() => navigate('/crm/acuerdos')}
                        className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={saveMutation.isPending}
                        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/25 transition-all active:scale-95"
                    >
                        <Save size={15} />
                        {saveMutation.isPending ? 'Guardando Configuración...' : 'Guardar Configuración'}
                    </button>
                </div>
            </form>
        </div>
    );
}
