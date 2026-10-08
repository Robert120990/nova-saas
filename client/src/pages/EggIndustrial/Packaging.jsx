import { usePackagingModel, PackagingHeader, PackagingFiltersBar, PackagingContent } from '../../components/egg/packaging';


import {
    EggNewPackagingModal,
    EggLabelPreviewModal,
    EggFreezerModal,
    EggCloseBatchModal
} from '../../components/egg/packaging';
import { EggQualityFinishedProductModal } from '../../components/egg/quality';
export default function EggPackaging() {
 const model = usePackagingModel();
 const { packagingRecords, batches, freezerLogs, isNewPackagingModalOpen, setIsNewPackagingModalOpen, isFreezerModalOpen, setIsFreezerModalOpen, packagingForm, setPackagingForm, freezerForm, setFreezerForm, isSubmitting, selectedLabel, setSelectedLabel, qualityModal, setQualityModal, canClosePackaging, closeBatchModal, setCloseBatchModal, handleCloseBatchPackaging, handleReopenBatchPackaging, fetchData, handleCreatePackaging, handleDeleteFreezerLog, handleCreateFreezerLog, getFreezerStatusBadge, handlePrintLabel, catalogProducts, codeMappings } = model;
 return (<div className="space-y-6 text-slate-900">
            {/* Header */}
            <PackagingHeader model={model} />

            {/* HISTORIAL DE LOTES EMPACADOS */}
            <PackagingFiltersBar model={model} />

            <EggNewPackagingModal
                isOpen={isNewPackagingModalOpen}
                onClose={() => setIsNewPackagingModalOpen(false)}
                packagingForm={packagingForm}
                setPackagingForm={setPackagingForm}
                batches={batches}
                isSubmitting={isSubmitting}
                onSubmit={handleCreatePackaging}
                onOpenCloseBatch={(b) => setCloseBatchModal({ isOpen: true, batch: b, notes: '', isSubmitting: false })}
                onReopenPackaging={handleReopenBatchPackaging}
                canClosePackaging={canClosePackaging}
                catalogProducts={catalogProducts}
                codeMappings={codeMappings}
            />

            <EggLabelPreviewModal
                isOpen={!!selectedLabel}
                onClose={() => setSelectedLabel(null)}
                label={selectedLabel}
                onPrint={handlePrintLabel}
            />

            <EggFreezerModal
                isOpen={isFreezerModalOpen}
                onClose={() => setIsFreezerModalOpen(false)}
                freezerForm={freezerForm}
                setFreezerForm={setFreezerForm}
                onSubmit={handleCreateFreezerLog}
                isSubmitting={isSubmitting}
                packagingRecords={packagingRecords}
                freezerLogs={freezerLogs}
                onDeleteFreezerLog={handleDeleteFreezerLog}
                getFreezerStatusBadge={getFreezerStatusBadge}
            />

            <PackagingContent model={model} />

            <EggCloseBatchModal
                isOpen={closeBatchModal.isOpen && !!closeBatchModal.batch}
                onClose={() => setCloseBatchModal({ isOpen: false, batch: null, notes: '', isSubmitting: false })}
                batch={closeBatchModal.batch}
                notes={closeBatchModal.notes}
                onNotesChange={(val) => setCloseBatchModal(prev => ({ ...prev, notes: val }))}
                onSubmit={handleCloseBatchPackaging}
                isSubmitting={closeBatchModal.isSubmitting}
            />

            <EggQualityFinishedProductModal
                open={qualityModal.isOpen}
                onClose={() => setQualityModal({ isOpen: false, batch: null })}
                batch={qualityModal.batch}
                onSuccess={fetchData}
            />
        </div>);
}
