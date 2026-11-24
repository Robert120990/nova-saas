import { useState, useMemo } from 'react';
import { Search, Layers, Receipt, MapPin, PackageCheck, RefreshCw, ArrowDownCircle } from 'lucide-react';
import { LOT_STATUS_STYLES, formatLbs, lbsToKg } from '../constants';
import { formatDate } from '../../../../utils/dateUtils';

export default function ActiveLotsTarimasTab({ lots = [], isLoading, onOpenWriteOff }) {
    const [search, setSearch] = useState('');
    const [onlyAvailable, setOnlyAvailable] = useState(true);
    const [locationFilter, setLocationFilter] = useState('all');

    const filteredLots = useMemo(() => {
        const list = Array.isArray(lots) ? lots : [];
        const q = search.trim().toLowerCase();

        return list.filter((lot) => {
            if (['anulado', 'cancelado'].includes(String(lot.status || '').toLowerCase())) return false;
            if (onlyAvailable && (lot.is_depleted || parseFloat(lot.stock_lbs || 0) <= 0.01)) return false;
            if (locationFilter !== 'all') {
                const loc = String(lot.storage_location || 'abajo').toLowerCase();
                if (loc !== locationFilter) return false;
            }
            if (!q) return true;
            const matchMeta =
                String(lot.provider_lot || '').toLowerCase().includes(q) ||
                String(lot.provider_name || '').toLowerCase().includes(q) ||
                String(lot.egg_type || '').toLowerCase().includes(q);
            const matchTarima = Array.isArray(lot.tarimas_available) && lot.tarimas_available.some((t) =>
                String(t.barcode || '').toLowerCase().includes(q) ||
                (Array.isArray(t.writeoff_refs) && t.writeoff_refs.some((r) => String(r.invoice_number || '').toLowerCase().includes(q)))
            );
            return matchMeta || matchTarima;
        });
    }, [lots, search, onlyAvailable, locationFilter]);

    return (
        <div className="space-y-4">
            {/* Barra de filtros */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-xs flex flex-col md:flex-row gap-3 md:items-center justify-between">
                <div className="relative flex-1 min-w-0">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar por lote proveedor, granja, código tarima o N° factura..."
                        className="w-full pl-10 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <select
                        value={locationFilter}
                        onChange={(e) => setLocationFilter(e.target.value)}
                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-400"
                    >
                        <option value="all">Todas las ubicaciones</option>
                        <option value="abajo">Bodega Abajo</option>
                        <option value="arriba">Bodega Arriba</option>
                    </select>
                    <label className="inline-flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={onlyAvailable}
                            onChange={(e) => setOnlyAvailable(e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        Solo con tarimas disponibles
                    </label>
                </div>
            </div>

            {/* Leyenda visual */}
            <div className="flex items-center gap-3 flex-wrap px-1 text-[11px] font-semibold text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Disponible (clic para dar de baja)
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Saldo Parcial
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-violet-500" /> Baja por Factura / No Prod.
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-300" /> Usada en Producción
                </span>
            </div>

            {/* Lista de Lotes */}
            {isLoading ? (
                <div className="py-16 bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <RefreshCw size={24} className="animate-spin text-indigo-600" />
                    <span className="text-xs font-semibold">Cargando lotes y tarimas...</span>
                </div>
            ) : filteredLots.length === 0 ? (
                <div className="py-16 bg-white rounded-2xl border border-slate-200 text-center space-y-2 px-4">
                    <PackageCheck size={32} className="mx-auto text-slate-300" />
                    <p className="text-sm font-bold text-slate-700">No se encontraron lotes de huevo</p>
                    <p className="text-xs text-slate-400">
                        Ajuste la búsqueda o desactive el filtro de disponibles para ver lotes agotados.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredLots.map((lot) => {
                        const tarimas = Array.isArray(lot.tarimas_available) ? lot.tarimas_available : [];
                        const availCount = tarimas.filter((t) => !t.is_depleted).length;
                        const statusInfo = LOT_STATUS_STYLES[lot.status] || {
                            label: lot.status || 'Activo',
                            cls: 'bg-slate-100 text-slate-700 border-slate-200'
                        };

                        return (
                            <div
                                key={lot.id}
                                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden"
                            >
                                {/* Cabecera del Lote */}
                                <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                    <div className="space-y-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm sm:text-base font-black text-slate-900">
                                                {lot.provider_lot || `Lote #${lot.id}`}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusInfo.cls}`}>
                                                {statusInfo.label}
                                            </span>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 capitalize">
                                                {lot.egg_type} {lot.egg_color ? `· ${lot.egg_color}` : ''} {lot.egg_size ? `· ${lot.egg_size}` : ''}
                                            </span>
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 capitalize">
                                                <MapPin size={10} /> {lot.storage_location || 'abajo'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 font-medium">
                                            <strong className="text-slate-700">{lot.provider_name || 'Proveedor'}</strong> &bull; Recepción:{' '}
                                            {formatDate(lot.fecha || lot.created_at)} &bull; Inicial: {lot.initial_boxes || 0} cajas ({formatLbs(lot.weight_lbs)} lbs)
                                        </p>
                                    </div>

                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
                                        <div className="flex items-center gap-2 flex-wrap text-xs">
                                            <div className="px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200">
                                                <span className="text-[10px] font-bold text-emerald-700 uppercase block leading-none">
                                                    Disponible
                                                </span>
                                                <span className="font-black text-emerald-900">
                                                    {availCount}/{tarimas.length} tar. · {lot.stock_boxes ?? lot.total_boxes} cjs · {formatLbs(lot.stock_lbs)} lbs
                                                </span>
                                                <span className="text-[10px] text-emerald-700 block">
                                                    ({lbsToKg(lot.stock_lbs)} Kg)
                                                </span>
                                            </div>
                                            {(lot.writeoff_boxes || 0) > 0 && (
                                                <div className="px-2.5 py-1.5 rounded-xl bg-violet-50 border border-violet-200">
                                                    <span className="text-[10px] font-bold text-violet-700 uppercase block leading-none">
                                                        Baja No Prod.
                                                    </span>
                                                    <span className="font-black text-violet-900">
                                                        {lot.writeoff_boxes} cjs · {formatLbs(lot.writeoff_lbs)} lbs
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            disabled={availCount === 0}
                                            onClick={() => onOpenWriteOff(lot, null)}
                                            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-bold shadow-xs transition-all inline-flex items-center justify-center gap-1.5 shrink-0"
                                        >
                                            <Receipt size={14} />
                                            Vincular Factura / Baja
                                        </button>
                                    </div>
                                </div>

                                {/* Grilla de Tarimas del Lote */}
                                <div className="p-3.5 sm:p-4">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-2">
                                        {tarimas.map((t) => {
                                            const hasWriteOff = (t.writeoff_boxes || 0) > 0;
                                            const hasProd = (t.prod_boxes || 0) > 0;
                                            const isPartial = !t.is_depleted && (hasWriteOff || hasProd);
                                            const firstRef = Array.isArray(t.writeoff_refs) && t.writeoff_refs[0];

                                            let cardClass = 'bg-emerald-50/70 border-emerald-200 hover:border-indigo-400 hover:bg-indigo-50/60 cursor-pointer';
                                            let badgeText = 'Disponible';
                                            let badgeCls = 'text-emerald-700';

                                            if (t.is_depleted && hasWriteOff) {
                                                cardClass = 'bg-violet-50/70 border-violet-200 opacity-90 cursor-default';
                                                badgeText = firstRef?.invoice_number
                                                    ? `Fact. ...${String(firstRef.invoice_number).slice(-6)}`
                                                    : 'Baja No Prod.';
                                                badgeCls = 'text-violet-700';
                                            } else if (t.is_depleted) {
                                                cardClass = 'bg-slate-50 border-slate-200 opacity-65 cursor-default';
                                                badgeText = 'En Producción';
                                                badgeCls = 'text-slate-500';
                                            } else if (isPartial) {
                                                cardClass = 'bg-amber-50/80 border-amber-300 hover:border-indigo-400 cursor-pointer';
                                                badgeText = 'Parcial';
                                                badgeCls = 'text-amber-700';
                                            }

                                            return (
                                                <button
                                                    key={t.tarima_number}
                                                    type="button"
                                                    disabled={t.is_depleted}
                                                    onClick={() => !t.is_depleted && onOpenWriteOff(lot, t.tarima_number)}
                                                    title={
                                                        t.is_depleted
                                                            ? `${t.barcode} · Agotada (${badgeText})`
                                                            : `Clic para dar de baja ${t.barcode} (${t.available_boxes} cjs / ${formatLbs(t.available_lbs)} lbs)`
                                                    }
                                                    className={`text-left p-2.5 rounded-xl border transition-all ${cardClass}`}
                                                >
                                                    <div className="flex items-center justify-between gap-1">
                                                        <span className="text-xs font-black text-slate-900 inline-flex items-center gap-1">
                                                            <Layers size={11} className={badgeCls} />
                                                            #{String(t.tarima_number).padStart(2, '0')}
                                                        </span>
                                                        {!t.is_depleted && (
                                                            <ArrowDownCircle size={12} className="text-indigo-500 shrink-0" />
                                                        )}
                                                    </div>
                                                    <div className="mt-1 text-[11px] font-bold text-slate-800">
                                                        {t.is_depleted
                                                            ? `${t.original_boxes} cjs`
                                                            : `${t.available_boxes}/${t.original_boxes} cjs`}
                                                    </div>
                                                    <div className="text-[10px] font-medium text-slate-500">
                                                        {formatLbs(t.is_depleted ? t.original_lbs : t.available_lbs)} lbs
                                                    </div>
                                                    <div className={`mt-1 text-[9.5px] font-extrabold truncate ${badgeCls}`}>
                                                        {badgeText}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
