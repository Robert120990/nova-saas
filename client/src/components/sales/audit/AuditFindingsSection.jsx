import { useState } from 'react';
import SaleDetailModal from '../SaleDetailModal';
import { 
    PhantomSalesTab, 
    DuplicatesTab, 
    UnsyncedStampsTab, 
    AutoOrdersTab, 
    MultiBranchTab 
} from './tabs';

const AuditFindingsSection = ({ auditData = {}, onSyncStamps, isSyncing = false }) => {
    const [activeTab, setActiveTab] = useState('fantasmas');
    const [selectedSaleForModal, setSelectedSaleForModal] = useState(null);
    const [saleModalView, setSaleModalView] = useState('detalle');

    const phantomSales = auditData.ventas_sin_sello_fantasma || auditData.hallazgos_criticos?.ventas_fantasma_locales || [];
    const suspiciousDuplicates = auditData.duplicados_sospechosos_hacienda || auditData.hallazgos_criticos?.duplicidad_sospechosa_hacienda || [];
    const unsyncedStamps = auditData.sellos_desincronizados || auditData.hallazgos_criticos?.sellos_pendientes_sincronizar || [];
    const autoSales = auditData.auditoria_pedidos_automaticos || auditData.hallazgos_criticos?.facturacion_automatica_pedidos || [];
    const multiBranch = auditData.ventas_multi_sucursal_legitimas || [];

    const handleOpenSale = (saleId, view = 'detalle') => {
        if (!saleId) return;
        setSaleModalView(view);
        setSelectedSaleForModal(saleId);
    };

    const tabs = [
        { id: 'fantasmas', label: 'Sin Sello MH (Fantasma)', count: phantomSales.length, color: 'rose' },
        { id: 'duplicados', label: 'Duplicidad en MH', count: suspiciousDuplicates.length, color: 'amber' },
        { id: 'desincronizados', label: 'Sellos Desincronizados', count: unsyncedStamps.length, color: 'sky' },
        { id: 'pedidos_auto', label: 'Pedidos Auto vs POS', count: autoSales.length, color: 'indigo' },
        { id: 'multi_sucursal', label: 'Super Selectos (Legítimas)', count: multiBranch.length, color: 'slate' }
    ];

    return (
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
            {/* Tabs Header */}
            <div className="flex items-center gap-1 p-2 bg-slate-50 border-b border-slate-200/80 overflow-x-auto text-xs">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                                isActive 
                                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80' 
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                        >
                            <span>{tab.label}</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                                tab.count > 0 
                                    ? tab.color === 'rose' ? 'bg-rose-100 text-rose-700' :
                                      tab.color === 'amber' ? 'bg-amber-100 text-amber-700' :
                                      tab.color === 'sky' ? 'bg-sky-100 text-sky-700' :
                                      'bg-indigo-100 text-indigo-700'
                                    : 'bg-slate-200 text-slate-600'
                            }`}>
                                {tab.count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <div className="p-4">
                {activeTab === 'fantasmas' && (
                    <PhantomSalesTab 
                        phantomSales={phantomSales} 
                        onOpenSale={handleOpenSale} 
                    />
                )}

                {activeTab === 'duplicados' && (
                    <DuplicatesTab 
                        suspiciousDuplicates={suspiciousDuplicates} 
                        onOpenSale={handleOpenSale} 
                    />
                )}

                {activeTab === 'desincronizados' && (
                    <UnsyncedStampsTab 
                        unsyncedStamps={unsyncedStamps} 
                        onOpenSale={handleOpenSale}
                        onSyncStamps={onSyncStamps}
                        isSyncing={isSyncing}
                    />
                )}

                {activeTab === 'pedidos_auto' && (
                    <AutoOrdersTab 
                        autoSales={autoSales} 
                        onOpenSale={handleOpenSale} 
                    />
                )}

                {activeTab === 'multi_sucursal' && (
                    <MultiBranchTab 
                        multiBranch={multiBranch} 
                        onOpenSale={handleOpenSale} 
                    />
                )}
            </div>

            {/* Modal de Detalle de Venta (Visualización completa con doble clic o botón) */}
            <SaleDetailModal
                isOpen={!!selectedSaleForModal}
                saleId={selectedSaleForModal}
                initialView={saleModalView}
                onClose={() => setSelectedSaleForModal(null)}
            />
        </div>
    );
};

export default AuditFindingsSection;
