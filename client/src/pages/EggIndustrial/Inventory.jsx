import {
    useInventoryModel,
    InventoryHeader,
    FinishedProductTab,
    RawMaterialInventoryTab,
    WasteLossesInventoryTab,
    RawMaterialTarimasModal,
    PackagingLotsModal
} from '../../components/egg/inventory';
import { RefreshCw } from 'lucide-react';

export default function EggInventory() {
    const model = useInventoryModel();
    const {
        loading,
        activeTab,
        isTarimasModalOpen,
        onCloseTarimasModal,
        selectedRmLot,
        isLotsModalOpen,
        onCloseLotsModal,
        selectedPresentation,
        unitOfMeasure
    } = model;

    return (
        <div className="space-y-6 animate-in fade-in duration-300 pb-12">
            {/* Header del módulo con selector de Pestañas y Acciones */}
            <InventoryHeader model={model} />

            {/* Contenido según la pestaña activa */}
            {loading ? (
                <div className="py-24 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center justify-center gap-3 text-slate-400">
                    <RefreshCw size={28} className="animate-spin text-blue-600" />
                    <p className="text-xs font-semibold">Cargando existencias de inventario...</p>
                </div>
            ) : (
                <>
                    {activeTab === 'finished_product' && (
                        <FinishedProductTab model={model} />
                    )}

                    {activeTab === 'raw_material' && (
                        <RawMaterialInventoryTab model={model} />
                    )}

                    {activeTab === 'wastes' && (
                        <WasteLossesInventoryTab model={model} />
                    )}
                </>
            )}

            {/* Modal de Tarimas de Materia Prima */}
            <RawMaterialTarimasModal
                open={isTarimasModalOpen}
                onClose={onCloseTarimasModal}
                lot={selectedRmLot}
            />

            {/* Modal de Lotes de Producto Terminado */}
            <PackagingLotsModal
                open={isLotsModalOpen}
                onClose={onCloseLotsModal}
                presentation={selectedPresentation}
                unitOfMeasure={unitOfMeasure}
            />
        </div>
    );
}
