import {
    Search,
    Send,
    RefreshCw,
    Users,
    CheckCircle2,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    CheckSquare,
    Square,
    Loader2
} from 'lucide-react';
import Modal from '../ui/Modal';

const PurchaseCheckProvidersModal = ({
    isOpen,
    onClose,
    branches = [],
    providerBranchId,
    setProviderBranchId,
    providerBranchConfig,
    onVerifyRrs,
    rrsVerifyFetching,
    isVerified,
    rrsVerifyData,
    rawProvidersList = [],
    providerFilterTab,
    setProviderFilterTab,
    setProvidersPage,
    selectedProviderIds = [],
    onSendSelected,
    onSendMissing,
    onSendAll,
    syncProvidersMutationPending,
    providerSearch,
    setProviderSearch,
    paginatedProviders = [],
    fallbackProvidersLoading,
    toggleSelectAllVisible,
    toggleSelectProvider,
    handleSendOne,
    singleSyncingId,
    filteredProvidersList = [],
    modalPageSize = 10,
    providersPage = 1,
    modalTotalPages = 1
}) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Proveedores — Cheques de Contado"
            maxWidth="max-w-5xl"
        >
            <div className="space-y-4">
                {/* Barra superior de sucursal y botón de verificación */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-500 uppercase">Sucursal:</span>
                        <select
                            value={providerBranchId}
                            onChange={(e) => {
                                setProviderBranchId(e.target.value);
                                setProvidersPage(1);
                            }}
                            className="w-full sm:w-auto px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-tight outline-none focus:ring-2 focus:ring-indigo-500/20"
                        >
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.nombre}</option>
                            ))}
                        </select>
                        {providerBranchConfig?.config?.rrs_id_empresa ? (
                            <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-100 uppercase tracking-tight">
                                ID Empresa RRS: {providerBranchConfig.config.rrs_id_empresa}
                            </span>
                        ) : (
                            <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg border border-amber-200">
                                Sin configurar en RRS
                            </span>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={onVerifyRrs}
                        disabled={rrsVerifyFetching || !providerBranchConfig?.config?.rrs_id_empresa}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-indigo-600/20 active:scale-95"
                        title="Verificar cuáles proveedores existen y cuáles faltan en el sistema RRS"
                    >
                        {rrsVerifyFetching ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <RefreshCw size={15} />
                        )}
                        <span>{rrsVerifyFetching ? 'Verificando en RRS...' : 'Verificar en RRS'}</span>
                    </button>
                </div>

                {/* Aviso de falta de configuración en RRS */}
                {!providerBranchConfig?.config?.rrs_id_empresa && (
                    <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-medium">
                        <AlertCircle size={17} className="shrink-0 text-amber-600 mt-0.5" />
                        <div>
                            <p className="font-bold">Sucursal sin ID Empresa RRS configurado</p>
                            <p className="text-[11px] text-amber-700">Para contrastar y sincronizar con RRS, abre la opción de <strong>Configuración RRS</strong> (ícono de engranaje) y asigna el ID Empresa de esta sucursal.</p>
                        </div>
                    </div>
                )}

                {/* Tarjetas de Métricas tras verificar */}
                {isVerified && rrsVerifyData && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Proveedores</p>
                                <p className="text-xl font-black text-slate-800">{rrsVerifyData.total}</p>
                            </div>
                            <Users size={22} className="text-slate-400" />
                        </div>
                        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Existen en RRS</p>
                                <p className="text-xl font-black text-emerald-700">{rrsVerifyData.matched}</p>
                            </div>
                            <CheckCircle2 size={22} className="text-emerald-500" />
                        </div>
                        <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">No existen en RRS</p>
                                <p className="text-xl font-black text-rose-700">{rrsVerifyData.not_matched}</p>
                            </div>
                            <AlertCircle size={22} className="text-rose-500" />
                        </div>
                    </div>
                )}

                {/* Filtros, buscador y botones de acción */}
                <div className="space-y-2.5">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                        {/* Tabs de filtro */}
                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 overflow-x-auto">
                            <button
                                type="button"
                                onClick={() => { setProviderFilterTab('all'); setProvidersPage(1); }}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${providerFilterTab === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                Todos ({rawProvidersList.length})
                            </button>
                            {isVerified && rrsVerifyData && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => { setProviderFilterTab('not_in_rrs'); setProvidersPage(1); }}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${providerFilterTab === 'not_in_rrs' ? 'bg-rose-600 text-white shadow-sm' : 'text-rose-600 hover:bg-rose-50'}`}
                                    >
                                        <span>Faltan en RRS</span>
                                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${providerFilterTab === 'not_in_rrs' ? 'bg-rose-700 text-white' : 'bg-rose-100 text-rose-700'}`}>
                                            {rrsVerifyData.not_matched}
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setProviderFilterTab('in_rrs'); setProvidersPage(1); }}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${providerFilterTab === 'in_rrs' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-600 hover:bg-emerald-50'}`}
                                    >
                                        <span>En RRS</span>
                                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${providerFilterTab === 'in_rrs' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                                            {rrsVerifyData.matched}
                                        </span>
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Botones de envío masivo */}
                        <div className="flex flex-wrap items-center gap-2">
                            {selectedProviderIds.length > 0 && (
                                <button
                                    type="button"
                                    onClick={onSendSelected}
                                    disabled={syncProvidersMutationPending || !providerBranchConfig?.config?.rrs_id_empresa}
                                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50"
                                    title="Enviar proveedores seleccionados a RRS"
                                >
                                    {syncProvidersMutationPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                                    <span>Enviar seleccionados ({selectedProviderIds.length})</span>
                                </button>
                            )}

                            {isVerified && rrsVerifyData?.not_matched > 0 && (
                                <button
                                    type="button"
                                    onClick={onSendMissing}
                                    disabled={syncProvidersMutationPending || !providerBranchConfig?.config?.rrs_id_empresa}
                                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50"
                                    title="Enviar únicamente los proveedores que no existen en RRS"
                                >
                                    {syncProvidersMutationPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                                    <span>Enviar Faltantes ({rrsVerifyData.not_matched})</span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={onSendAll}
                                disabled={syncProvidersMutationPending || !providerBranchConfig?.config?.rrs_id_empresa}
                                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50"
                                title="Sincronizar todos los proveedores a RRS"
                            >
                                {syncProvidersMutationPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                                <span>Enviar Todos a RRS</span>
                            </button>
                        </div>
                    </div>

                    {/* Buscador de proveedores */}
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                        <input
                            type="text"
                            placeholder="Buscar proveedor por nombre, comercial, NIT o NRC..."
                            value={providerSearch}
                            onChange={(e) => { setProviderSearch(e.target.value); setProvidersPage(1); }}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all shadow-sm"
                        />
                    </div>
                </div>

                {/* Tabla de proveedores (con vista en tarjetas para móvil) */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                    {/* Tarjetas en Móvil (md:hidden) */}
                    <div className="md:hidden divide-y divide-slate-100">
                        {fallbackProvidersLoading && !isVerified ? (
                            <div className="text-center py-8 text-slate-400 text-xs">
                                <Loader2 size={20} className="animate-spin mx-auto mb-2 text-indigo-500" />
                                Cargando proveedores...
                            </div>
                        ) : paginatedProviders.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 text-xs">
                                No se encontraron proveedores coincidentes.
                            </div>
                        ) : (
                            <div className="p-3 space-y-3">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                    <button
                                        type="button"
                                        onClick={toggleSelectAllVisible}
                                        className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-indigo-600 transition-colors"
                                    >
                                        {paginatedProviders.length > 0 && paginatedProviders.every(p => selectedProviderIds.includes(p.id)) ? (
                                            <CheckSquare size={16} className="text-indigo-600" />
                                        ) : (
                                            <Square size={16} />
                                        )}
                                        <span>Seleccionar visibles</span>
                                    </button>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                                        {selectedProviderIds.length} seleccionados
                                    </span>
                                </div>
                                {paginatedProviders.map((p) => {
                                    const isSelected = selectedProviderIds.includes(p.id);
                                    const isThisSyncing = singleSyncingId === p.id;
                                    return (
                                        <div
                                            key={p.id}
                                            className={`p-3 rounded-xl border transition-all ${
                                                isSelected
                                                    ? 'bg-indigo-50/40 border-indigo-200 shadow-sm'
                                                    : 'bg-slate-50/60 border-slate-200'
                                            }`}
                                        >
                                            <div className="flex items-start gap-2.5">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelectProvider(p.id)}
                                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer mt-1"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-bold text-slate-800 text-xs uppercase leading-snug">
                                                        {p.nombre}
                                                    </div>
                                                    {p.nombre_comercial && p.nombre_comercial !== p.nombre && (
                                                        <div className="text-[10px] text-slate-400 uppercase truncate mt-0.5">
                                                            {p.nombre_comercial}
                                                        </div>
                                                    )}
                                                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100 text-[10px]">
                                                        <div>
                                                            <span className="text-slate-400 block font-bold">NRC</span>
                                                            <span className="font-mono text-slate-700 font-bold">{p.nrc || '—'}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-slate-400 block font-bold">NIT</span>
                                                            <span className="font-mono text-slate-700">{p.nit || '—'}</span>
                                                        </div>
                                                    </div>
                                                    {(p.telefono || p.correo) && (
                                                        <div className="mt-1 text-[10px] text-slate-500 truncate">
                                                            {p.telefono} {p.correo ? `• ${p.correo}` : ''}
                                                        </div>
                                                    )}
                                                    <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-slate-100">
                                                        <div>
                                                            {!isVerified ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500">
                                                                    Sin verificar
                                                                </span>
                                                            ) : p.exists_in_rrs ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                    <CheckCircle2 size={11} /> Existe en RRS
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                                    <AlertCircle size={11} /> No existe en RRS
                                                                </span>
                                                            )}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSendOne(p.id)}
                                                            disabled={syncProvidersMutationPending || !providerBranchConfig?.config?.rrs_id_empresa}
                                                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40 ${
                                                                isVerified && !p.exists_in_rrs
                                                                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm'
                                                                    : 'bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 shadow-sm'
                                                            }`}
                                                        >
                                                            {isThisSyncing ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                                                            <span>{isThisSyncing ? 'Enviando...' : (isVerified && !p.exists_in_rrs ? 'Enviar a RRS' : 'Enviar')}</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Tabla convencional en Desktop (hidden md:block) */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                                    <th className="w-10 px-4 py-2.5 text-center">
                                        <button
                                            type="button"
                                            onClick={toggleSelectAllVisible}
                                            className="text-slate-400 hover:text-indigo-600 transition-colors"
                                            title="Seleccionar / Deseleccionar visibles"
                                        >
                                            {paginatedProviders.length > 0 && paginatedProviders.every(p => selectedProviderIds.includes(p.id)) ? (
                                                <CheckSquare size={16} className="text-indigo-600" />
                                            ) : (
                                                <Square size={16} />
                                            )}
                                        </button>
                                    </th>
                                    <th className="px-4 py-2.5">Proveedor</th>
                                    <th className="px-4 py-2.5">NRC / NIT</th>
                                    <th className="px-4 py-2.5">Contacto</th>
                                    <th className="px-4 py-2.5">Estado en RRS</th>
                                    <th className="px-4 py-2.5 text-right">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-[12px]">
                                {fallbackProvidersLoading && !isVerified ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-8 text-slate-400 text-xs">
                                            <Loader2 size={20} className="animate-spin mx-auto mb-2 text-indigo-500" />
                                            Cargando proveedores...
                                        </td>
                                    </tr>
                                ) : paginatedProviders.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-8 text-slate-400 text-xs">
                                            No se encontraron proveedores coincidentes.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedProviders.map((p) => {
                                        const isSelected = selectedProviderIds.includes(p.id);
                                        const isThisSyncing = singleSyncingId === p.id;
                                        return (
                                            <tr
                                                key={p.id}
                                                className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-indigo-50/30' : ''}`}
                                            >
                                                <td className="px-4 py-2.5 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleSelectProvider(p.id)}
                                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                    />
                                                </td>
                                                <td className="px-4 py-2.5 max-w-[240px]">
                                                    <div className="font-bold text-slate-800 text-[11px] uppercase truncate" title={p.nombre}>
                                                        {p.nombre}
                                                    </div>
                                                    {p.nombre_comercial && p.nombre_comercial !== p.nombre && (
                                                        <div className="text-[10px] text-slate-400 uppercase truncate" title={p.nombre_comercial}>
                                                            {p.nombre_comercial}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2.5 whitespace-nowrap">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-[10px] font-mono text-slate-600 font-bold">
                                                            NRC: {p.nrc || '—'}
                                                        </span>
                                                        <span className="text-[9px] font-mono text-slate-400">
                                                            NIT: {p.nit || '—'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2.5 text-[10px] text-slate-500 whitespace-nowrap">
                                                    <div>{p.telefono || '—'}</div>
                                                    {p.correo && <div className="text-slate-400 truncate max-w-[140px]" title={p.correo}>{p.correo}</div>}
                                                </td>
                                                <td className="px-4 py-2.5 whitespace-nowrap">
                                                    {!isVerified ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500">
                                                            Sin verificar
                                                        </span>
                                                    ) : p.exists_in_rrs ? (
                                                        <div className="flex flex-col">
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                <CheckCircle2 size={11} /> Existe en RRS
                                                            </span>
                                                            {p.rrs_codigo && (
                                                                <span className="text-[8px] font-mono text-slate-400 mt-0.5">
                                                                    Cód: {p.rrs_codigo}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                            <AlertCircle size={11} /> No existe en RRS
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSendOne(p.id)}
                                                        disabled={syncProvidersMutationPending || !providerBranchConfig?.config?.rrs_id_empresa}
                                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all disabled:opacity-40 ${
                                                            isVerified && !p.exists_in_rrs
                                                                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm'
                                                                : 'bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200'
                                                        }`}
                                                        title={isVerified && !p.exists_in_rrs ? 'Crear este proveedor en RRS' : 'Enviar / actualizar proveedor en RRS'}
                                                    >
                                                        {isThisSyncing ? (
                                                            <Loader2 size={12} className="animate-spin" />
                                                        ) : (
                                                            <Send size={11} />
                                                        )}
                                                        <span>
                                                            {isThisSyncing
                                                                ? 'Enviando...'
                                                                : (isVerified && !p.exists_in_rrs ? 'Enviar a RRS' : 'Enviar')}
                                                        </span>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Paginación de la tabla de proveedores */}
                    {filteredProvidersList.length > modalPageSize && (
                        <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 text-[11px] text-slate-500 font-medium gap-2">
                            <span>
                                Mostrando {((providersPage - 1) * modalPageSize) + 1} a {Math.min(providersPage * modalPageSize, filteredProvidersList.length)} de {filteredProvidersList.length} proveedores
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => setProvidersPage(p => Math.max(p - 1, 1))}
                                    disabled={providersPage <= 1}
                                    className="p-1 rounded-lg hover:bg-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="px-2 font-bold text-slate-700">
                                    {providersPage} / {modalTotalPages}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setProvidersPage(p => Math.min(p + 1, modalTotalPages))}
                                    disabled={providersPage >= modalTotalPages}
                                    className="p-1 rounded-lg hover:bg-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Pie del modal */}
                <div className="flex justify-end pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors text-xs uppercase tracking-wider text-center"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default PurchaseCheckProvidersModal;