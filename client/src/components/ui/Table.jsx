import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

const LABEL_FIELD_MAP = {
    'codigo': ['codigo', 'code', 'codigo_barra', 'barcode', 'cod', 'correlativo', 'id'],
    'codigo / barras': ['codigo', 'barcode', 'codigo_barra', 'code'],
    'nombre': ['nombre', 'name', 'nombre_comercial', 'razon_social'],
    'nombre / razon social': ['nombre', 'nombre_comercial', 'razon_social', 'name'],
    'cliente': ['customer_name', 'cliente', 'nombre_cliente', 'cliente_nombre', 'nombre'],
    'proveedor': ['provider_name', 'proveedor', 'nombre_proveedor', 'proveedor_nombre', 'nombre'],
    'empleado': ['empleado', 'employee_name', 'nombre_empleado', 'nombre'],
    'vendedor': ['seller_name', 'vendedor', 'nombre_vendedor', 'nombre'],
    'usuario': ['usuario', 'username', 'user_name', 'nombre_usuario', 'nombre'],
    'responsable': ['responsable', 'responsible_name', 'usuario', 'nombre'],
    'fecha': ['fecha', 'date', 'fecha_emision', 'created_at', 'fh_procesamiento'],
    'fecha / hora': ['fecha', 'fh_procesamiento', 'created_at', 'date'],
    'hora': ['hora', 'hora_emision', 'time'],
    'vencimiento': ['vencimiento', 'fecha_vencimiento', 'due_date'],
    'vigencia desde': ['vigencia_desde', 'start_date', 'fecha_inicio'],
    'vigencia hasta': ['vigencia_hasta', 'end_date', 'fecha_fin'],
    'f. entrega': ['fecha_entrega', 'delivery_date'],
    'fecha entrega': ['fecha_entrega', 'delivery_date'],
    'total': ['total', 'total_pagar', 'monto_total', 'amount'],
    'monto': ['monto', 'total', 'amount', 'valor'],
    'precio': ['precio', 'price', 'precio_unitario', 'precio_final'],
    'precio final': ['precio_final', 'precio', 'price'],
    'costo': ['costo', 'cost', 'costo_unitario'],
    'saldo': ['saldo', 'balance'],
    'disponible': ['disponible', 'available'],
    'utilizado': ['utilizado', 'used'],
    'estado': ['estado', 'status', 'dte_status', 'state'],
    'estado mh': ['dte_status', 'estado', 'status'],
    'sucursal': ['branch_name', 'sucursal', 'branch', 'sucursal_nombre'],
    'categoria': ['categoria', 'category_name', 'categoria_nombre'],
    'tipo': ['tipo', 'type', 'tipo_documento', 'tipo_dte'],
    'documento': ['documento', 'numero_documento', 'num_doc', 'numero_control'],
    'no. doc': ['num_doc', 'documento', 'numero_documento', 'numero_control'],
    'n. quedan': ['num_quedan', 'correlativo', 'id'],
    'n. cheque': ['rrs_num_cheque', 'num_cheque', 'cheque'],
    'descripcion': ['descripcion', 'description', 'detalle'],
    'ubicacion': ['departamento', 'municipio', 'distrito', 'direccion'],
    'departamento': ['departamento', 'department_name', 'depto'],
    'cargo': ['cargo', 'position', 'nombre_cargo'],
    'items': ['items_count', 'total_items', 'items'],
    'id': ['id'],
    'no.': ['id', 'correlativo', 'numero', 'no'],
    'n°': ['id', 'correlativo', 'numero', 'no'],
    'dias': ['dias', 'days', 'dias_credito'],
    'nrc': ['nrc'],
    'nit': ['nit'],
    'dui': ['dui', 'numero_documento'],
};

const NON_SORTABLE_LABELS = new Set([
    'acciones',
    'accion',
    'opciones',
    'opcion',
    'actions',
    'action',
    '',
    '#',
    'seleccionar'
]);

const cleanHeaderStr = (str) => {
    return String(str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
};

const inferSortInfo = (headerLabel, sampleItem) => {
    const clean = cleanHeaderStr(headerLabel);
    const candidates = LABEL_FIELD_MAP[clean] || [];
    let matchedKey = null;

    if (sampleItem && typeof sampleItem === 'object') {
        for (const cand of candidates) {
            if (cand in sampleItem) {
                matchedKey = cand;
                break;
            }
        }
        if (!matchedKey) {
            const keyUnderscore = clean.replace(/[\s/.-]+/g, '_');
            if (keyUnderscore in sampleItem) {
                matchedKey = keyUnderscore;
            } else {
                const objKeys = Object.keys(sampleItem);
                const found = objKeys.find(k => cleanHeaderStr(k) === clean || cleanHeaderStr(k).includes(clean));
                if (found) matchedKey = found;
            }
        }
    }

    if (!matchedKey) {
        matchedKey = candidates[0] || clean.replace(/[^a-z0-9]+/g, '_') || 'col';
    }

    let type = 'string';
    if (
        clean.includes('fecha') ||
        clean.includes('vencimiento') ||
        clean.includes('vigencia') ||
        clean.includes('hora')
    ) {
        type = 'date';
    } else if (
        clean.includes('total') ||
        clean.includes('monto') ||
        clean.includes('precio') ||
        clean.includes('costo') ||
        clean.includes('saldo') ||
        clean.includes('disponible') ||
        clean.includes('utilizado') ||
        clean.includes('galones') ||
        clean.includes('dias') ||
        clean.includes('%') ||
        clean.includes('porcentaje') ||
        clean === 'id' ||
        clean === 'no.' ||
        clean === 'n°'
    ) {
        type = 'number';
    } else if (sampleItem && typeof sampleItem[matchedKey] === 'number') {
        type = 'number';
    }

    const defaultDir = type === 'date' ? 'desc' : 'asc';
    return { sortKey: matchedKey, sortType: type, defaultDir };
};

const sortItems = (items, sortKey, sortDir, sortType, customSortFn) => {
    if (!sortKey || !Array.isArray(items) || items.length === 0) return items;
    const mult = sortDir === 'asc' ? 1 : -1;

    return [...items].sort((a, b) => {
        if (typeof customSortFn === 'function') {
            return customSortFn(a, b, mult, sortDir);
        }

        const valA = a?.[sortKey];
        const valB = b?.[sortKey];

        const isNilA = valA === undefined || valA === null || valA === '';
        const isNilB = valB === undefined || valB === null || valB === '';
        if (isNilA && isNilB) return 0;
        if (isNilA) return 1;
        if (isNilB) return -1;

        if (sortType === 'number') {
            const numA = typeof valA === 'number' ? valA : parseFloat(String(valA).replace(/[^0-9.-]+/g, '')) || 0;
            const numB = typeof valB === 'number' ? valB : parseFloat(String(valB).replace(/[^0-9.-]+/g, '')) || 0;
            return (numA - numB) * mult;
        }

        if (sortType === 'date') {
            const timeA = new Date(valA).getTime();
            const timeB = new Date(valB).getTime();
            if (!isNaN(timeA) && !isNaN(timeB)) {
                return (timeA - timeB) * mult;
            }
            return String(valA).localeCompare(String(valB)) * mult;
        }

        return String(valA).localeCompare(String(valB), 'es', { numeric: true, sensitivity: 'base' }) * mult;
    });
};

const Table = ({
    headers = [],
    data = [],
    renderRow,
    renderCard,
    isLoading,
    className = '',
    tableClassName = '',
    noHorizontalScroll = false,
    compact = false,
    maxHeight,
    containerClassName = '',
    sortBy: controlledSortBy,
    sortDir: controlledSortDir,
    onSort,
    defaultSortBy = null,
    defaultSortDir = 'asc',
    sortable = true,
}) => {
    const isControlled = typeof onSort === 'function';

    const [internalSortBy, setInternalSortBy] = useState(defaultSortBy);
    const [internalSortDir, setInternalSortDir] = useState(defaultSortDir);
    const [internalSortType, setInternalSortType] = useState('string');
    const [internalCustomSortFn, setInternalCustomSortFn] = useState(null);

    const activeSortBy = isControlled ? controlledSortBy : internalSortBy;
    const activeSortDir = isControlled ? (controlledSortDir || 'asc') : internalSortDir;

    const safeData = useMemo(() => (Array.isArray(data) ? data : []), [data]);

    const sortedData = useMemo(() => {
        if (!sortable || isControlled || !internalSortBy) return safeData;
        return sortItems(safeData, internalSortBy, internalSortDir, internalSortType, internalCustomSortFn);
    }, [safeData, sortable, isControlled, internalSortBy, internalSortDir, internalSortType, internalCustomSortFn]);

    const renderHeaderContent = (h) => {
        if (React.isValidElement(h)) return h;

        const isObj = typeof h === 'object' && h !== null;
        const rawLabel = isObj ? h.label : h;

        if (React.isValidElement(rawLabel)) return rawLabel;

        const customCls = isObj ? (h.className || '') : '';
        const isExplicitlySortable = isObj && h.sortable === false ? false : true;

        if (typeof rawLabel !== 'string' || !sortable || !isExplicitlySortable) {
            return rawLabel;
        }

        const trimmed = rawLabel.trim();
        const clean = cleanHeaderStr(trimmed);

        if (NON_SORTABLE_LABELS.has(clean)) {
            return trimmed;
        }

        const sampleItem = safeData[0] || null;
        const inferred = inferSortInfo(trimmed, sampleItem);

        const sortKey = isObj && h.sortKey ? h.sortKey : inferred.sortKey;
        const sortType = isObj && (h.sortType || h.type) ? (h.sortType || h.type) : inferred.sortType;
        const defaultDir = isObj && h.defaultDir ? h.defaultDir : inferred.defaultDir;
        const customSortFn = isObj ? (h.sortFn || null) : null;

        const isActive = activeSortBy === sortKey || activeSortBy === clean || activeSortBy === trimmed;

        let badgeText = '';
        if (isActive) {
            if (sortType === 'number') {
                badgeText = activeSortDir === 'asc' ? 'Menor→Mayor' : 'Mayor→Menor';
            } else if (sortType === 'date') {
                badgeText = activeSortDir === 'asc' ? 'Antiguas' : 'Recientes';
            } else {
                badgeText = activeSortDir === 'asc' ? 'A→Z' : 'Z→A';
            }
        }

        const handleSortClick = () => {
            let nextDir = defaultDir;
            if (isActive) {
                nextDir = activeSortDir === 'asc' ? 'desc' : 'asc';
            }
            if (isControlled) {
                onSort(sortKey, nextDir, sortType);
            } else {
                setInternalSortBy(sortKey);
                setInternalSortDir(nextDir);
                setInternalSortType(sortType);
                setInternalCustomSortFn(() => customSortFn);
            }
        };

        const isRightAligned = customCls.includes('text-right') || customCls.includes('justify-end');

        return (
            <button
                type="button"
                onClick={handleSortClick}
                title={isObj && h.title ? h.title : `Ordenar por ${trimmed}`}
                className={`inline-flex items-center gap-1 uppercase tracking-wider font-bold text-[10px] transition-colors cursor-pointer select-none group ${
                    isRightAligned ? 'ml-auto justify-end' : ''
                } ${
                    isActive ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'
                }`}
            >
                <span>{trimmed}</span>
                {isActive ? (
                    activeSortDir === 'asc' ? (
                        <ArrowUp size={12} className="text-indigo-600 shrink-0" />
                    ) : (
                        <ArrowDown size={12} className="text-indigo-600 shrink-0" />
                    )
                ) : (
                    <ArrowUpDown size={11} className="text-slate-400 opacity-60 group-hover:opacity-100 shrink-0" />
                )}
                {badgeText && (
                    <span className="px-1 py-0.5 rounded bg-indigo-50 text-indigo-600 text-[8.5px] font-extrabold normal-case tracking-normal border border-indigo-200/80">
                        {badgeText}
                    </span>
                )}
            </button>
        );
    };

    return (
        <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden ${className}`}>
            {/* Vista en tarjeta para móvil (si se provee renderCard) */}
            {renderCard && (
                <div className="md:hidden divide-y divide-slate-100">
                    {isLoading ? (
                        <div className="px-4 py-8 text-center">
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-6 h-6 border-[3px] border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-xs font-medium text-slate-500">Cargando registros...</span>
                            </div>
                        </div>
                    ) : sortedData.length > 0 ? (
                        <div className="p-3 space-y-3">
                            {sortedData.map((item, index) => (
                                <div key={item.id || index} className="bg-slate-50/50 rounded-xl p-3.5 border border-slate-100 hover:border-indigo-100 transition-all">
                                    {renderCard(item, index)}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="px-4 py-8 text-center text-slate-400 italic text-sm">
                            No se encontraron registros
                        </div>
                    )}
                </div>
            )}

            {/* Vista en Tabla (Escritorio o fallback móvil si no hay renderCard) */}
            <div 
                className={`${noHorizontalScroll ? 'overflow-x-hidden' : 'overflow-x-auto'} ${maxHeight ? 'overflow-y-auto' : ''} ${renderCard ? 'hidden md:block' : 'block'} ${containerClassName}`}
                style={maxHeight ? { maxHeight } : undefined}
            >
                <table className={`w-full text-left border-collapse ${tableClassName}`}>
                    <thead className={`bg-slate-50 border-b border-slate-100 ${maxHeight ? 'sticky top-0 z-10 shadow-xs' : ''}`}>
                        <tr>
                            {headers.map((h, i) => {
                                const isObj = typeof h === 'object' && h !== null && !React.isValidElement(h);
                                const customCls = isObj ? (h.className || '') : '';
                                return (
                                    <th
                                        key={i}
                                        className={`${compact ? 'py-1.5' : 'py-2'} text-[10px] font-bold text-slate-500 uppercase tracking-wider ${customCls || (compact ? 'px-2.5' : 'px-4')}`}
                                    >
                                        {renderHeaderContent(h, i)}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody className={compact ? 'divide-y divide-slate-100' : 'divide-y divide-slate-50'}>
                        {isLoading ? (
                            <tr>
                                <td colSpan={headers.length} className="px-4 py-6 text-center">
                                    <div className="flex flex-col items-center gap-1">
                                        <div className="w-5 h-5 border-[3px] border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                        <span className="text-[11px] font-medium text-slate-500">Cargando registros...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : sortedData.length > 0 ? (
                            sortedData.map((item, index) => renderRow(item, index))
                        ) : (
                            <tr>
                                <td colSpan={headers.length} className="px-4 py-6 text-center text-slate-400 italic">
                                    No se encontraron registros
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Table;
