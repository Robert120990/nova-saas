

import {
    Settings,
    Plus,
    Trash2,
    Tag
} from 'lucide-react';


export default function ConfigLotPrefixesTab({ model }) {
    const { activeTab, providerLotConfigs, loading, handleOpenLotConfigModal, handleDeleteLotConfig } = model;

    return (<>{activeTab === 'lot-prefixes' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                <Tag className="h-4 w-4 text-indigo-600" />
                                Parametrización de Prefijos de Lote por Proveedor
                            </h2>
                            <p className="text-xs text-slate-500 mt-1">
                                Configure el prefijo y formato con el que cada proveedor identifica sus lotes de huevo en granja. Al recibir materia prima, el sistema sugerirá el lote automáticamente basándose en este prefijo y en el historial previo.
                            </p>
                        </div>
                        <button
                            onClick={() => handleOpenLotConfigModal()}
                            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 shrink-0"
                        >
                            <Plus size={15} />
                            Asignar Prefijo a Proveedor
                        </button>
                    </div>

                    <div className="h-px bg-slate-100" />

                    {loading ? (
                        <div className="text-center text-slate-400 text-xs py-8 animate-pulse font-medium">Cargando parametrización de proveedores...</div>
                    ) : providerLotConfigs.length === 0 ? (
                        <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                            <Tag size={24} className="mx-auto text-slate-400" />
                            <p className="text-xs font-bold text-slate-700">No hay prefijos de lote configurados.</p>
                            <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                                Cree una regla para asociar proveedores (ej: Don Héctor, Granja Candy, Avícola Salvadoreña) con sus códigos de lote correspondientes.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                                        <th className="px-4 py-3">Proveedor</th>
                                        <th className="px-4 py-3">Prefijo Configurado</th>
                                        <th className="px-4 py-3">Taras Base (Por Tarima)</th>
                                        <th className="px-4 py-3">Empaque Habitual</th>
                                        <th className="px-4 py-3">Último Lote Registrado</th>
                                        <th className="px-4 py-3">Formato de Sufijo</th>
                                        <th className="px-4 py-3">Notas / Identificación Granja</th>
                                        <th className="px-4 py-3 text-center w-24">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                    {(Array.isArray(providerLotConfigs) ? providerLotConfigs : []).map(item => {
                                        const baseB = item.base_boxes_per_tarima || 24;
                                        const tarimaTare = parseFloat(item.tare_tarima_lbs !== undefined ? item.tare_tarima_lbs : 0);
                                        const sepTare = parseFloat(item.tare_separador_lbs !== undefined ? item.tare_separador_lbs : 48);
                                        const boxTare = parseFloat(item.tare_caja_lbs !== undefined ? item.tare_caja_lbs : 30);
                                        const hasBox = item.default_has_caja !== undefined ? Boolean(item.default_has_caja) : true;
                                        const totalTare = tarimaTare + sepTare + (hasBox ? boxTare : 0);

                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50/75 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-900 text-xs">{item.provider_name || 'Proveedor sin nombre'}</span>
                                                        {item.provider_nrc && (
                                                            <span className="text-[10px] text-slate-400 font-medium">NRC: {item.provider_nrc}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-bold text-xs">
                                                        {item.lot_prefix}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col gap-0.5 text-[11px]">
                                                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                                            <span className="font-black text-indigo-700">{totalTare.toFixed(1)} lb</span>
                                                            <span className="text-[10px] text-slate-400">({baseB} cjs)</span>
                                                        </div>
                                                        {tarimaTare > 0 && (
                                                            <div className="text-[10px] text-slate-500">
                                                                Tarima: <span className="font-semibold text-slate-700">{tarimaTare.toFixed(1)} lb</span>
                                                            </div>
                                                        )}
                                                        <div className="text-[10px] text-slate-500">
                                                            Sep: <span className="font-semibold text-slate-700">{sepTare.toFixed(1)} lb</span> ({ (sepTare / baseB).toFixed(2) }/cj)
                                                        </div>
                                                        <div className="text-[10px] text-slate-500">
                                                            Caja: <span className="font-semibold text-slate-700">{boxTare.toFixed(1)} lb</span> ({ (boxTare / baseB).toFixed(2) }/cj)
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        hasBox
                                                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                    }`}>
                                                        {hasBox ? 'Con Cajas / Jabas' : 'A Granel (Solo Separador)'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {item.last_used_lot ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-800 font-mono text-[11px] font-semibold">
                                                            {item.last_used_lot}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 italic text-[11px]">Sin lotes previos</span>
                                                    )}
                                                </td>
                                            <td className="px-4 py-3 capitalize">
                                                <span className="text-slate-600 font-medium text-[11px]">
                                                    {(item.suffix_format === 'correlativo' || item.format_pattern === 'correlativo') && 'Correlativo numérico (-01, -02)'}
                                                    {(item.suffix_format === 'fecha-juliana' || item.format_pattern === 'fecha-juliana') && 'Fecha Juliana (J-DDD)'}
                                                    {(item.suffix_format === 'secuencial' || item.format_pattern === 'secuencial') && 'Secuencial continuo'}
                                                    {!item.suffix_format && !item.format_pattern && 'Correlativo estándar'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 text-[11px]">
                                                {item.notes || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button
                                                        onClick={() => handleOpenLotConfigModal(item)}
                                                        className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-100 shadow-xs"
                                                        title="Editar parametrización"
                                                    >
                                                        <Settings size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteLotConfig(item.id)}
                                                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors border border-rose-100 shadow-xs"
                                                        title="Eliminar regla"
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
                    )}
                </div>
            )}</>);
}
