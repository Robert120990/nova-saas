import { useProductionModel, ProductionDeleteConfirmBatchModal, ProductionTarimaPickerModalIsOpenModal, ProductionSelectedBatchForCompleteModal, ProductionIsPasteurizeModalOpenModal, ProductionCipTab, ProductionBatchesTab, ProductionIsNewBatchModalOpenModal, ProductionHeader, ProductionFiltersBar, ProductionContent } from '../../components/egg/production';
import {
    Flame
} from 'lucide-react';
import ProductionTarimaScannerModal from '../../components/egg/ProductionTarimaScannerModal';
import EggTarimaSearchModal from '../../components/egg/EggTarimaSearchModal';
import EggRemanenteModal from '../../components/egg/EggRemanenteModal';
import EggBatchWastesModal from '../../components/egg/EggBatchWastesModal';
import EggClosePasteurizationModal from '../../components/egg/EggClosePasteurizationModal';
import { EggQualityFinishedProductModal } from '../../components/egg/quality';
export default function EggProduction() {
 const model = useProductionModel();
 const { scannerModalOpen, setScannerModalOpen, tarimaSearchPickerOpen, setTarimaSearchPickerOpen, qualityModal, setQualityModal, rawMaterials, stagesModal, closePasteurizationModal, setClosePasteurizationModal, addTarimasModal, setAddTarimasModal, remanenteModal, setRemanenteModal, wastesModal, setWastesModal, handleOpenStagesModal, handleConfirmClosePasteurization, handleCreateWaste, handleDeleteWaste, handleAddSpecificTarimaToAddModal, handleRemanenteSubmit, fetchData, handleScanTarimaResult } = model;
 return (<div className="space-y-6 text-slate-900">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-600">
                        <Flame className="h-8 w-8" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Sala de Producción y Pasteurización</h1>
                        <p className="text-xs text-slate-500 font-medium">Control de lotes, sanitización CIP, pasteurización térmica y balance de masas</p>
                    </div>
                </div>
            </div>

            {/* Custom Tab Selectors */}
            <ProductionHeader model={model} />

            {/* TAB CONTENT */}
            <ProductionBatchesTab model={model} />

            <ProductionCipTab model={model} />

            <ProductionIsNewBatchModalOpenModal model={model} />

            <ProductionIsPasteurizeModalOpenModal model={model} />

            {/* BALANCE DE MASAS DIALOG MODAL */}
            <ProductionSelectedBatchForCompleteModal model={model} />
            {/* Modal de Escáner de Tarima con Cámara (QR y Código de Barras) */}
            {scannerModalOpen && (
                <ProductionTarimaScannerModal
                    isOpen={scannerModalOpen}
                    onClose={() => setScannerModalOpen(false)}
                    onScanTarima={handleScanTarimaResult}
                    rawMaterials={rawMaterials}
                />
            )}

            {/* Modal Selector de Tarima Específica del Lote */}
            <ProductionTarimaPickerModalIsOpenModal model={model} />

            {/* MODAL VISUALIZADOR Y CONTROL DE ETAPAS DEL PROCESO */}
            {/* MODAL BALANCE Y ETAPAS DEL LOTE */}
            <ProductionFiltersBar model={model} />

            {/* MODAL CONTROL DE CALIDAD FQ & MB (MARIO / LAB-004) */}
            <EggQualityFinishedProductModal
                open={qualityModal.isOpen}
                onClose={() => setQualityModal({ isOpen: false, batch: null })}
                batch={qualityModal.batch}
                onSuccess={() => {
                    fetchData();
                    if (stagesModal.isOpen && stagesModal.batch) {
                        handleOpenStagesModal(stagesModal.batch);
                    }
                }}
            />

            {/* MODAL CERRAR PASTEURIZACIÓN */}
            <EggClosePasteurizationModal
                isOpen={closePasteurizationModal.isOpen}
                onClose={() => setClosePasteurizationModal(prev => ({ ...prev, isOpen: false, batch: null }))}
                batch={closePasteurizationModal.batch}
                pasteurizationLot={closePasteurizationModal.pasteurization_lot}
                onPasteurizationLotChange={(val) => setClosePasteurizationModal(prev => ({ ...prev, pasteurization_lot: val }))}
                wasteShellLbs={closePasteurizationModal.waste_shell_lbs}
                onWasteShellLbsChange={(val) => setClosePasteurizationModal(prev => ({ ...prev, waste_shell_lbs: val }))}
                yieldLiquidLbs={closePasteurizationModal.yield_liquid_lbs}
                onYieldLiquidLbsChange={(val) => setClosePasteurizationModal(prev => ({ ...prev, yield_liquid_lbs: val }))}
                notes={closePasteurizationModal.notes}
                onNotesChange={(val) => setClosePasteurizationModal(prev => ({ ...prev, notes: val }))}
                onSubmit={handleConfirmClosePasteurization}
                isSubmitting={closePasteurizationModal.isSubmitting}
            />

            {/* MODAL AGREGAR MÁS TARIMAS AL QUEBRAJE */}
            <ProductionContent model={model} />

            {/* MODAL BUSCADOR DE LOTES Y TARIMAS DISPONIBLES */}
            <EggTarimaSearchModal
                isOpen={tarimaSearchPickerOpen}
                onClose={() => setTarimaSearchPickerOpen(false)}
                rawMaterials={rawMaterials}
                addTarimasModal={addTarimasModal}
                setAddTarimasModal={setAddTarimasModal}
                handleAddSpecificTarimaToAddModal={handleAddSpecificTarimaToAddModal}
            />

            {/* MODAL REGISTRAR REMANENTE / SOBRANTE */}
            <EggRemanenteModal
                isOpen={remanenteModal.isOpen}
                onClose={() => setRemanenteModal(prev => ({ ...prev, isOpen: false, id: null }))}
                remanenteModal={remanenteModal}
                setRemanenteModal={setRemanenteModal}
                onSubmit={handleRemanenteSubmit}
                productConfig={model.productConfig}
            />

            {/* MODAL REGISTRO Y GESTIÓN DE MERMAS POR LOTE */}
            <EggBatchWastesModal
                isOpen={wastesModal.isOpen}
                onClose={() => setWastesModal(prev => ({ ...prev, isOpen: false, editingWasteId: null }))}
                wastesModal={wastesModal}
                setWastesModal={setWastesModal}
                handleCreateWaste={handleCreateWaste}
                handleDeleteWaste={handleDeleteWaste}
            />

            {/* DIÁLOGO CONFIRMAR ELIMINACIÓN DE LOTE */}
            <ProductionDeleteConfirmBatchModal model={model} />
        </div>);
}
