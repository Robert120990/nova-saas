import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Receipt, Layers, History, Plus, RefreshCw } from 'lucide-react';
import {
    WriteOffSummaryCards,
    LinkInvoiceTarimasModal,
    ActiveLotsTarimasTab,
    WriteOffHistoryTab
} from '../../components/egg/rawMaterialWriteOff';
import { unwrapList } from '../../utils/apiUtils';

export default function RawMaterialInvoiceWriteOff() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('lots');
    const [modalState, setModalState] = useState({
        open: false,
        initialLot: null,
        initialTarimaNumber: null
    });

    const { data: lots = [], isLoading: loadingLots, isFetching: fetchingLots } = useQuery({
        queryKey: ['egg-raw-materials-writeoff'],
        queryFn: async () => unwrapList(await axios.get('/api/egg-industrial/raw-materials'))
    });

    const { data: summaryData } = useQuery({
        queryKey: ['egg-tarima-writeoffs-summary'],
        queryFn: async () => {
            const res = await axios.get('/api/egg-industrial/tarima-writeoffs?page=1&limit=1');
            return res.data?.summary || {};
        }
    });

    const safeLots = useMemo(() => (Array.isArray(lots) ? lots : []), [lots]);

    const lotsStats = useMemo(() => {
        return safeLots.reduce(
            (acc, lot) => {
                if (['anulado', 'cancelado'].includes(String(lot.status || '').toLowerCase())) return acc;
                const stockLbs = parseFloat(lot.stock_lbs || 0);
                if (lot.is_depleted || stockLbs <= 0.01) return acc;

                const availTarimas = Array.isArray(lot.tarimas_available)
                    ? lot.tarimas_available.filter((t) => !t.is_depleted).length
                    : 0;
                return {
                    activeLots: acc.activeLots + 1,
                    availableTarimas: acc.availableTarimas + availTarimas,
                    availableBoxes: acc.availableBoxes + (parseInt(lot.stock_boxes ?? lot.total_boxes, 10) || 0),
                    availableLbs: Math.round((acc.availableLbs + stockLbs) * 100) / 100
                };
            },
            { activeLots: 0, availableTarimas: 0, availableBoxes: 0, availableLbs: 0 }
        );
    }, [safeLots]);

    const handleRefreshAll = () => {
        queryClient.invalidateQueries({ queryKey: ['egg-raw-materials-writeoff'] });
        queryClient.invalidateQueries({ queryKey: ['egg-tarima-writeoffs-summary'] });
        queryClient.invalidateQueries({ queryKey: ['egg-tarima-writeoffs'] });
        queryClient.invalidateQueries({ queryKey: ['egg-writeoff-invoices'] });
        queryClient.invalidateQueries({ queryKey: ['egg-raw-materials'] });
    };

    const openWriteOffModal = (lot = null, tarimaNumber = null) => {
        setModalState({
            open: true,
            initialLot: lot,
            initialTarimaNumber: tarimaNumber
        });
    };

    const closeWriteOffModal = () => {
        setModalState({ open: false, initialLot: null, initialTarimaNumber: null });
    };

    return (
        <div className="space-y-5 pb-10 animate-in fade-in duration-200">
            {/* Cabecera Principal */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5 min-w-0">
                    <div className="p-3 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-2xl shrink-0">
                        <Receipt size={22} />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                            Facturas y Baja de Tarimas
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                            Vincula facturas de venta con lotes de huevo para dar de baja tarimas que no se utilizan en producción.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={handleRefreshAll}
                        className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5"
                    >
                        <RefreshCw size={14} className={fetchingLots ? 'animate-spin' : ''} />
                        Actualizar
                    </button>
                    <button
                        type="button"
                        onClick={() => openWriteOffModal(null, null)}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all inline-flex items-center gap-1.5"
                    >
                        <Plus size={15} />
                        Vincular Factura / Dar de Baja
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <WriteOffSummaryCards
                lotsStats={lotsStats}
                writeOffSummary={summaryData || {}}
            />

            {/* Navegación por Pestañas */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-0.5 overflow-x-auto">
                <button
                    type="button"
                    onClick={() => setActiveTab('lots')}
                    className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all inline-flex items-center gap-2 whitespace-nowrap ${
                        activeTab === 'lots'
                            ? 'border-indigo-600 text-indigo-700'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <Layers size={15} />
                    Lotes y Tarimas Disponibles
                    <span className="px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black">
                        {lotsStats.availableTarimas}
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all inline-flex items-center gap-2 whitespace-nowrap ${
                        activeTab === 'history'
                            ? 'border-indigo-600 text-indigo-700'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <History size={15} />
                    Historial de Bajas y Facturas
                    <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-black">
                        {summaryData?.active_writeoffs || 0}
                    </span>
                </button>
            </div>

            {/* Contenido de la Pestaña Activa */}
            {activeTab === 'lots' ? (
                <ActiveLotsTarimasTab
                    lots={safeLots}
                    isLoading={loadingLots}
                    onOpenWriteOff={openWriteOffModal}
                />
            ) : (
                <WriteOffHistoryTab onDataChanged={handleRefreshAll} />
            )}

            {/* Modal Controlado de Vinculación y Baja */}
            <LinkInvoiceTarimasModal
                open={modalState.open}
                onClose={closeWriteOffModal}
                onSuccess={handleRefreshAll}
                lots={safeLots}
                initialLot={modalState.initialLot}
                initialTarimaNumber={modalState.initialTarimaNumber}
            />
        </div>
    );
}
