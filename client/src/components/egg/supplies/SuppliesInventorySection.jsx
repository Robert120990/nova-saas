import useSuppliesModel from './useSuppliesModel';
import SuppliesHeader from './SuppliesHeader';
import SuppliesSummaryCards from './SuppliesSummaryCards';
import SuppliesTableSection from './SuppliesTableSection';
import SupplyFormModal from './SupplyFormModal';
import SupplyMovementModal from './SupplyMovementModal';
import PdfViewerModal from '../../ui/PdfViewerModal';

export default function SuppliesInventorySection({ embedded = false }) {
    const model = useSuppliesModel();
    const {
        supplies,
        batches,
        supplyModalState,
        closeSupplyModal,
        saveSupplyMutation,
        movementModalState,
        closeMovementModal,
        registerMovementMutation,
        pdfViewer,
        closePdfViewer,
        handleOpenReportPdf
    } = model;

    return (
        <div className="space-y-4 sm:space-y-6 text-slate-900">
            <SuppliesHeader model={model} embedded={embedded} />

            <SuppliesSummaryCards model={model} />

            <SuppliesTableSection model={model} />

            <SupplyFormModal
                open={supplyModalState.open}
                onClose={closeSupplyModal}
                onSave={(payload) => saveSupplyMutation.mutate(payload)}
                item={supplyModalState.item}
                isSubmitting={saveSupplyMutation.isPending}
            />

            <SupplyMovementModal
                open={movementModalState.open}
                onClose={closeMovementModal}
                onSave={(payload) => registerMovementMutation.mutate(payload)}
                supply={movementModalState.supply}
                supplies={supplies}
                batches={batches}
                defaultType={movementModalState.defaultType}
                isSubmitting={registerMovementMutation.isPending}
            />

            <PdfViewerModal
                isOpen={pdfViewer.isOpen}
                onClose={closePdfViewer}
                title={pdfViewer.title}
                subtitle={pdfViewer.subtitle}
                badge="Formato Oficial"
                pdfUrl={pdfViewer.pdfUrl}
                isLoading={pdfViewer.isLoading}
                error={pdfViewer.error}
                onRetry={handleOpenReportPdf}
                fileName={pdfViewer.fileName}
            />
        </div>
    );
}
