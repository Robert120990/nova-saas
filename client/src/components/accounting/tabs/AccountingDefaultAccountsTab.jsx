import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Save, Plus, X } from 'lucide-react';
import DefaultAccountRow from '../DefaultAccountRow';
import DefaultAccountCustomForm from '../DefaultAccountCustomForm';
import DefaultAccountsBranchBar from '../DefaultAccountsBranchBar';
import DefaultAccountsFilterBar from '../DefaultAccountsFilterBar';
import { ACCOUNT_CATEGORIES, KNOWN_ACCOUNTS, getAccountMetadata, findKnownAccountByPosName } from '../defaultAccountsConfig';
import { unwrapList } from '../../../utils/apiUtils';
import { useAuth } from '../../../context/AuthContext';

const AccountingDefaultAccountsTab = ({
    defaultAccounts = [],
    setDefaultAccounts,
    accounts = [],
    saveDefaultAccounts,
    saveDefaultsMutation,
    branches = [],
    selectedBranchId = 0,
    onBranchChange,
    onCopyFromBranch,
}) => {
    const { user } = useAuth();
    const companyId = user?.company_id;
    const headers = { 'x-company-id': companyId };

    const { data: posTypes = [] } = useQuery({
        queryKey: ['gas-station-pos-types', companyId],
        queryFn: async ({ signal }) => unwrapList(await axios.get('/api/gas-station/pos-types', { headers, signal })),
        enabled: !!companyId,
    });

    // Iniciar por defecto en Cierres de Turno para evitar scroll masivo inicial
    const [selectedCategory, setSelectedCategory] = useState('turnos');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'configured' | 'pending'
    const [isAddingCustom, setIsAddingCustom] = useState(false);

    // Mapa de cuentas ya configuradas por clave
    const configuredMap = useMemo(() => {
        const map = new Map();
        (defaultAccounts || []).forEach(row => {
            if (row?.key) map.set(row.key.trim().toUpperCase(), row.account_id);
        });
        return map;
    }, [defaultAccounts]);

    // Combinar cuentas conocidas sugeridas + personalizadas en una lista unificada
    const unifiedList = useMemo(() => {
        const list = [];
        const seenKeys = new Set();

        // 1. Cuentas conocidas sugeridas
        KNOWN_ACCOUNTS.forEach(meta => {
            const keyUpper = meta.key.toUpperCase();
            let matchedKey = keyUpper;
            let currentAccountId = configuredMap.get(keyUpper) || '';

            const variants = [keyUpper, ...(meta.aliases || []).map(a => a.toUpperCase())];
            for (const v of variants) {
                if (!currentAccountId && configuredMap.has(v)) {
                    matchedKey = v;
                    currentAccountId = configuredMap.get(v) || '';
                }
                seenKeys.add(v);
                seenKeys.add(v.replace(/_/g, ''));
            }

            list.push({
                key: matchedKey,
                label: meta.label,
                category: meta.category,
                group: meta.group,
                description: meta.description,
                account_id: currentAccountId,
                isConfigured: Boolean(currentAccountId),
                isKnown: true
            });
        });

        // 1.b. Tipos de POS registrados en gas_station_pos_types (excluyendo los ya conocidos)
        (Array.isArray(posTypes) ? posTypes : []).forEach(pos => {
            if (!pos?.nombre) return;
            const name = pos.nombre.trim();
            const matchedKnown = findKnownAccountByPosName(name);
            if (matchedKnown) return; // Ya está representada por una cuenta conocida sin duplicar

            const keyUnderscored = 'CUENTA_TARJETAS_' + name.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
            const keyClean = 'CUENTA_TARJETAS_' + name.toUpperCase().replace(/[^A-Z0-9]/g, '');

            if (seenKeys.has(keyUnderscored) || seenKeys.has(keyClean) || seenKeys.has(keyClean.replace(/_/g, ''))) return;
            seenKeys.add(keyUnderscored);
            seenKeys.add(keyClean);

            let matchedKey = keyUnderscored;
            let currentAccountId = configuredMap.get(keyUnderscored) || configuredMap.get(keyClean) || '';

            list.push({
                key: matchedKey,
                label: `POS / Tarjeta: ${name}`,
                category: 'tarjetas',
                group: 'Terminales POS Registrados',
                description: `Cobros y liquidaciones bajo "${name}" en cierres de turno.`,
                account_id: currentAccountId,
                isConfigured: Boolean(currentAccountId),
                isKnown: true
            });
        });

        // 2. Cuentas personalizadas o dinámicas no estándar
        (defaultAccounts || []).forEach(row => {
            const keyUpper = (row.key || '').trim().toUpperCase();
            if (!keyUpper || seenKeys.has(keyUpper) || seenKeys.has(keyUpper.replace(/_/g, ''))) return;
            seenKeys.add(keyUpper);

            const meta = getAccountMetadata(keyUpper);
            list.push({
                key: keyUpper,
                label: meta.label,
                category: meta.category || 'custom',
                group: meta.group || 'Personalizadas',
                description: meta.description,
                account_id: row.account_id || '',
                isConfigured: Boolean(row.account_id),
                isKnown: false
            });
        });

        return list;
    }, [configuredMap, defaultAccounts, posTypes]);

    // Contadores de progreso por categoría
    const categoryStats = useMemo(() => {
        const stats = { all: { total: unifiedList.length, configured: 0 } };
        ACCOUNT_CATEGORIES.forEach(c => { stats[c.id] = { total: 0, configured: 0 }; });

        unifiedList.forEach(item => {
            if (item.isConfigured) stats.all.configured++;
            if (stats[item.category]) {
                stats[item.category].total++;
                if (item.isConfigured) stats[item.category].configured++;
            }
        });

        return stats;
    }, [unifiedList]);

    // Filtrar elementos según categoría, búsqueda y estado
    const filteredItems = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return unifiedList.filter(item => {
            if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
            if (statusFilter === 'configured' && !item.isConfigured) return false;
            if (statusFilter === 'pending' && item.isConfigured) return false;

            if (query) {
                const matchLabel = item.label.toLowerCase().includes(query);
                const matchKey = item.key.toLowerCase().includes(query);
                const matchDesc = item.description?.toLowerCase().includes(query);
                const accountObj = accounts.find(a => String(a.id) === String(item.account_id));
                const matchAccount = accountObj ? (accountObj.code + ' ' + accountObj.name).toLowerCase().includes(query) : false;
                if (!matchLabel && !matchKey && !matchDesc && !matchAccount) return false;
            }

            return true;
        });
    }, [unifiedList, selectedCategory, statusFilter, searchQuery, accounts]);

    // Manejador para actualizar o asignar cuenta
    const handleSetAccount = (key, accountId) => {
        const keyUpper = key.trim().toUpperCase();
        setDefaultAccounts(prev => {
            const exists = prev.some(r => r.key.trim().toUpperCase() === keyUpper);
            if (exists) {
                if (!accountId) {
                    return prev.filter(r => r.key.trim().toUpperCase() !== keyUpper);
                }
                return prev.map(r => r.key.trim().toUpperCase() === keyUpper ? { ...r, account_id: String(accountId) } : r);
            }
            if (!accountId) return prev;
            return [...prev, { key: keyUpper, account_id: String(accountId) }];
        });
    };

    // Manejador para eliminar cuenta personalizada
    const handleRemoveCustomKey = (key) => {
        const keyUpper = key.trim().toUpperCase();
        setDefaultAccounts(prev => prev.filter(r => r.key.trim().toUpperCase() !== keyUpper));
    };

    // Manejador para registrar clave personalizada
    const handleAddCustomKey = (cleanKey, accountId) => {
        setDefaultAccounts(prev => [...prev, { key: cleanKey, account_id: String(accountId) }]);
        setSelectedCategory('custom');
    };

    return (
        <fieldset disabled={saveDefaultsMutation.isPending} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-6 space-y-4 min-w-0 w-full">
            {/* Barra de Selección de Sucursal y Acciones */}
            <DefaultAccountsBranchBar
                branches={branches}
                selectedBranchId={selectedBranchId}
                onBranchChange={onBranchChange}
                onCopyFromBranch={onCopyFromBranch}
                isSaving={saveDefaultsMutation.isPending}
            />

            {/* Cabecera Informativa con ÚNICO Botón Guardar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="min-w-0">
                    <h2 className="text-sm sm:text-base font-black text-slate-800 tracking-tight flex items-center gap-2">
                        Cuentas Contables Predeterminadas
                    </h2>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        Asigna las cuentas del catálogo a cada operación del sistema para generar partidas automáticas sin errores.
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={() => setIsAddingCustom(!isAddingCustom)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border shadow-xs cursor-pointer ${
                            isAddingCustom
                                ? 'bg-slate-100 text-slate-700 border-slate-300'
                                : 'bg-white hover:bg-slate-50 text-indigo-600 border-indigo-200 hover:border-indigo-300'
                        }`}
                    >
                        {isAddingCustom ? <X size={14} /> : <Plus size={14} />}
                        <span>{isAddingCustom ? 'Cancelar' : 'Nueva Clave'}</span>
                    </button>
                    {/* Botón único y principal de Guardar para Cuentas por Defecto */}
                    <button
                        type="button"
                        onClick={saveDefaultAccounts}
                        disabled={saveDefaultsMutation.isPending}
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-indigo-100 active:scale-95 cursor-pointer"
                    >
                        <Save size={15} />
                        <span>{saveDefaultsMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}</span>
                    </button>
                </div>
            </div>

            {/* Formulario Modular para Registro de Clave Personalizada */}
            <DefaultAccountCustomForm
                isOpen={isAddingCustom}
                onClose={() => setIsAddingCustom(false)}
                accounts={accounts}
                onAdd={handleAddCustomKey}
                configuredKeys={configuredMap}
            />

            {/* Barra de Categorías, Filtros y Búsqueda */}
            <DefaultAccountsFilterBar
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                categoryStats={categoryStats}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
            />

            {/* Listado Modular Compacto de Cuentas */}
            <div className="space-y-2 min-w-0">
                {filteredItems.map(item => (
                    <DefaultAccountRow
                        key={item.key}
                        item={item}
                        accounts={accounts}
                        onSetAccount={handleSetAccount}
                        onRemoveCustomKey={handleRemoveCustomKey}
                    />
                ))}

                {filteredItems.length === 0 && (
                    <div className="text-center py-8 px-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-1">
                        <p className="text-xs font-bold text-slate-600">No se encontraron cuentas con los filtros actuales.</p>
                        <p className="text-[11px] text-slate-400 font-medium">Intenta limpiar la búsqueda o cambiar de pestaña.</p>
                    </div>
                )}
            </div>

            {/* Pie con Resumen Informativo (Sin botón duplicado) */}
            <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>
                    <span className="font-bold text-slate-800">{categoryStats[selectedCategory]?.configured ?? categoryStats.all.configured}</span> de{' '}
                    <span className="font-bold text-slate-800">{categoryStats[selectedCategory]?.total ?? categoryStats.all.total}</span> en esta sección •{' '}
                    <span className="font-bold text-indigo-600">{categoryStats.all.configured}</span>/{categoryStats.all.total} totales
                </span>
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                    Recuerda pulsar "Guardar Cambios" al finalizar
                </span>
            </div>
        </fieldset>
    );
};

export default AccountingDefaultAccountsTab;
