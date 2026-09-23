import { useNavigate } from 'react-router-dom';
import { Users, Handshake, Plus, CheckCircle2, Clock, AlertTriangle, Calendar, History, Edit2, Trash2 } from 'lucide-react';
import Money from '../../ui/Money';

export default function EggCosteoClientsTab({
    calculationResult,
    validityFilter,
    setValidityFilter,
    setAgreementModal,
    handleOpenAgreementHistory,
    handleDeleteAgreement
}) {
    const navigate = useNavigate();

    return (
                <div className="space-y-4">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                                <Users className="w-4 h-4 text-indigo-600" />
                                <span>Acuerdos Comerciales & Semáforo de Margen por Cliente</span>
                            </h2>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                                Compara precios pactados contra el costo actual de absorción para evaluar la rentabilidad y vigencia de cada contrato.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => navigate('/crm/acuerdos')}
                                className="px-3.5 py-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 border border-slate-200 transition-all"
                            >
                                <Handshake className="w-4 h-4 text-indigo-600" />
                                <span>Módulo CRM Acuerdos</span>
                            </button>
                            <button
                                onClick={() => setAgreementModal({ open: true, data: {} })}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Nuevo Acuerdo de Precio</span>
                            </button>
                        </div>
                    </div>

                    {/* Filtros de Vigencia */}
                    <div className="flex flex-wrap items-center gap-1.5 bg-white p-2.5 rounded-xl border border-slate-200 text-xs shadow-sm">
                        <span className="text-[11px] font-bold text-slate-500 uppercase mr-1">Filtrar por Vigencia:</span>
                        {[
                            { id: 'todos', label: 'Todos los Acuerdos' },
                            { id: 'vigente', label: 'Vigentes' },
                            { id: 'por_vencer', label: 'Por Vencer (≤30 días)' },
                            { id: 'vencido', label: 'Vencidos' },
                            { id: 'programado', label: 'Programados' }
                        ].map(f => (
                            <button
                                key={f.id}
                                type="button"
                                onClick={() => setValidityFilter(f.id)}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${validityFilter === f.id
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70'
                                    }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                                        <th className="py-3 px-4">Cliente</th>
                                        <th className="py-3 px-3">Producto / Presentación</th>
                                        <th className="py-3 px-3">Vigencia del Acuerdo</th>
                                        <th className="py-3 px-3 text-right">Precio Pactado</th>
                                        <th className="py-3 px-3 text-right">Costo + Flete</th>
                                        <th className="py-3 px-3 text-right">Margen $/Lb</th>
                                        <th className="py-3 px-3 text-center">Semáforo</th>
                                        <th className="py-3 px-3 text-right">Volumen Mes</th>
                                        <th className="py-3 px-3 text-right">Utilidad Bruta</th>
                                        <th className="py-3 px-4 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                                    {(calculationResult?.clients_comparison || [])
                                        .filter(client => {
                                            if (validityFilter === 'todos') return true;
                                            return client.validity_status === validityFilter;
                                        })
                                        .map((client) => {
                                            const badgeClass =
                                                client.status === 'green'
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                    : client.status === 'yellow'
                                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                        : 'bg-rose-50 text-rose-700 border border-rose-200';

                                            return (
                                                <tr key={client.id} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="py-3 px-4 font-bold text-slate-900">
                                                        {client.customer_name}
                                                    </td>
                                                    <td className="py-3 px-3">
                                                        <span className="block text-slate-800">{client.product_type}</span>
                                                        <span className="text-[10px] text-slate-500">{client.presentation}</span>
                                                    </td>
                                                    <td className="py-3 px-3">
                                                        <div className="space-y-1">
                                                            {client.validity_status === 'vigente' && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                                    Vigente
                                                                </span>
                                                            )}
                                                            {client.validity_status === 'por_vencer' && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                                    <Clock className="w-3 h-3 text-amber-600" />
                                                                    Vence en {client.days_remaining}d
                                                                </span>
                                                            )}
                                                            {client.validity_status === 'vencido' && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                                                                    Vencido
                                                                </span>
                                                            )}
                                                            {client.validity_status === 'programado' && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                                    <Calendar className="w-3 h-3 text-indigo-600" />
                                                                    Programado
                                                                </span>
                                                            )}
                                                            {!client.validity_status && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                                    Indefinido
                                                                </span>
                                                            )}
                                                            <div className="text-[10px] text-slate-400 font-mono">
                                                                {client.valid_from ? new Date(client.valid_from).toLocaleDateString() : 'Sin inicio'}
                                                                {' → '}
                                                                {client.valid_to ? new Date(client.valid_to).toLocaleDateString() : 'Permanente'}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-3 text-right font-black text-slate-900">
                                                        <Money value={client.agreed_price} />
                                                    </td>
                                                    <td className="py-3 px-3 text-right text-slate-600 font-medium">
                                                        <Money value={client.effective_cost} />
                                                    </td>
                                                    <td className="py-3 px-3 text-right font-bold text-emerald-600">
                                                        <Money value={client.margin_per_lb} />
                                                    </td>
                                                    <td className="py-3 px-3 text-center">
                                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badgeClass}`}>
                                                            {client.margin_pct ? client.margin_pct.toFixed(1) : 0}%
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-3 text-right text-slate-600 font-medium">
                                                        {(client.monthly_volume_lbs || 0).toLocaleString()} Lbs
                                                    </td>
                                                    <td className="py-3 px-3 text-right font-black text-indigo-700">
                                                        <Money value={client.monthly_profit} />
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                onClick={() => handleOpenAgreementHistory(client)}
                                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-bold"
                                                                title="Ver Historial de Precios y Revisiones"
                                                            >
                                                                <History className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => setAgreementModal({ open: true, data: client })}
                                                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors font-bold"
                                                                title="Editar Acuerdo"
                                                            >
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteAgreement(client.id)}
                                                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors font-bold"
                                                                title="Eliminar Acuerdo"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
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
                </div>
    );
}
