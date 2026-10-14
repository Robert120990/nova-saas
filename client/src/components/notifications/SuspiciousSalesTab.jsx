import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { ShieldAlert, Save, GitBranch } from 'lucide-react';
import { toast } from 'sonner';

export default function SuspiciousSalesTab({ branches = [] }) {
  const queryClient = useQueryClient();
  const [selectedBranchId, setSelectedBranchId] = useState('');

  useEffect(() => {
    if (branches.length > 0 && !selectedBranchId) {
      setSelectedBranchId(String(branches[0].id));
    }
  }, [branches, selectedBranchId]);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['sale-suspicious-settings', selectedBranchId],
    queryFn: async () => (await axios.get(`/api/notifications/sale-suspicious-settings?branch_id=${selectedBranchId}`)).data,
    enabled: !!selectedBranchId
  });

  const [form, setForm] = useState({
    enabled: false,
    monto_maximo: 500,
    descuento_maximo_porcentaje: 20,
    montos_redondos: false,
    horas_inicio: '22:00',
    horas_fin: '06:00',
    anulaciones_maximas: 3,
    ventana_anulaciones_min: 15
  });

  useEffect(() => {
    if (settings) {
      setForm({
        enabled: Boolean(settings.enabled),
        monto_maximo: settings.monto_maximo ?? 500,
        descuento_maximo_porcentaje: settings.descuento_maximo_porcentaje ?? 20,
        montos_redondos: Boolean(settings.montos_redondos),
        horas_inicio: settings.horas_inicio ? String(settings.horas_inicio).slice(0, 5) : '22:00',
        horas_fin: settings.horas_fin ? String(settings.horas_fin).slice(0, 5) : '06:00',
        anulaciones_maximas: settings.anulaciones_maximas ?? 3,
        ventana_anulaciones_min: settings.ventana_anulaciones_min ?? 15
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (payload) => axios.put('/api/notifications/sale-suspicious-settings', { ...payload, branch_id: selectedBranchId }),
    onSuccess: () => {
      queryClient.invalidateQueries(['sale-suspicious-settings', selectedBranchId]);
      toast.success('Configuración de ventas sospechosas guardada');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar configuración')
  });

  const updateField = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 rounded-2xl text-rose-600 border border-rose-100">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Monitoreo de Ventas Sospechosas</h3>
            <p className="text-xs text-slate-500">
              Detección de patrones anómalos y notificación proactiva vía Telegram por sucursal.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-slate-400" />
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {branches.map((b) => (
              <option key={b.id} value={String(b.id)}>
                📍 {b.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-xs text-slate-400">Cargando configuración...</div>
      ) : (
        <div className="space-y-6">
          <div className="p-4 rounded-xl border border-rose-100 bg-rose-50/40 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 block">Detección Automática Activa</span>
              <span className="text-[11px] text-slate-500">
                El sistema evaluará cada venta contra estas reglas y notificará a Telegram.
              </span>
            </div>
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => updateField('enabled', e.target.checked)}
              className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase block">
                Monto Máximo de Alerta ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.monto_maximo}
                onChange={(e) => updateField('monto_maximo', e.target.value)}
                className="w-full text-xs font-semibold border border-slate-200 rounded-lg p-2"
              />
              <span className="text-[10px] text-slate-400">Ventas que superen este valor dispararán alerta.</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase block">
                Descuento Máximo (%)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={form.descuento_maximo_porcentaje}
                onChange={(e) => updateField('descuento_maximo_porcentaje', e.target.value)}
                className="w-full text-xs font-semibold border border-slate-200 rounded-lg p-2"
              />
              <span className="text-[10px] text-slate-400">Porcentaje de descuento sospechoso.</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase block">
                Montos Redondos
              </label>
              <label className="flex items-center gap-2 pt-1 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.montos_redondos}
                  onChange={(e) => updateField('montos_redondos', e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                />
                Alertar montos múltiplos de $100
              </label>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase block">
                Horario No Operativo - Desde
              </label>
              <input
                type="time"
                value={form.horas_inicio}
                onChange={(e) => updateField('horas_inicio', e.target.value)}
                className="w-full text-xs font-semibold border border-slate-200 rounded-lg p-2"
              />
            </div>

            <div className="p-4 rounded-xl border border-slate-200 space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase block">
                Horario No Operativo - Hasta
              </label>
              <input
                type="time"
                value={form.horas_fin}
                onChange={(e) => updateField('horas_fin', e.target.value)}
                className="w-full text-xs font-semibold border border-slate-200 rounded-lg p-2"
              />
            </div>

            <div className="p-4 rounded-xl border border-slate-200 space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase block">
                Anulaciones Máximas en Ventana
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={form.anulaciones_maximas}
                  onChange={(e) => updateField('anulaciones_maximas', e.target.value)}
                  placeholder="Cant"
                  className="w-1/2 text-xs font-semibold border border-slate-200 rounded-lg p-2"
                />
                <input
                  type="number"
                  min="1"
                  value={form.ventana_anulaciones_min}
                  onChange={(e) => updateField('ventana_anulaciones_min', e.target.value)}
                  placeholder="Minutos"
                  className="w-1/2 text-xs font-semibold border border-slate-200 rounded-lg p-2"
                />
              </div>
              <span className="text-[10px] text-slate-400">Ej: 3 anulaciones en 15 minutos.</span>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              onClick={() => saveMutation.mutate(form)}
              disabled={saveMutation.isPending}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-200 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? 'Guardando...' : 'Guardar Configuración'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
