import { useReceptionModel, ReceptionVoidConfirmIdNullModal, ReceptionDeleteConfirmRmModal, ReceptionIsCreateModalOpenModal, ReceptionHeader, ReceptionFiltersBar, ReceptionContent, ReceptionActionBar } from '../../components/egg/reception';


import TarimaLabelModal from '../../components/egg/TarimaLabelModal';
import PdfViewerModal from '../../components/ui/PdfViewerModal';
import ProviderLotConfigModal from '../../components/egg/ProviderLotConfigModal';
export default function EggReception() {
 const model = useReceptionModel();
 const { providers, lotConfigModalData, setLotConfigModalData, printTarimaModal, setPrintTarimaModal, pdfPreviewModal, handleClosePdfPreview, loadProvidersOptions, handleLotConfigSaved } = model;
 return (<div className="space-y-6 text-slate-900">
            {/* Header section */}
            <ReceptionHeader model={model} />

            <ReceptionIsCreateModalOpenModal model={model} />

            {/* HISTORY LIST CARD */}
            <ReceptionFiltersBar model={model} />

            {/* Modal de Detalle de Recepción e Impresión Individual de Tarimas */}
            <ReceptionContent model={model} />



            <ReceptionVoidConfirmIdNullModal model={model} />

            {/* Modal de Evaluación y Reporte de Calidad Oficial (LAB 001, Rev. 7.03.24) */}
            <ReceptionActionBar model={model} />



            {/* Modal Confirmar Eliminación Permanente de Recepción */}
            <ReceptionDeleteConfirmRmModal model={model} />

            {/* Modal de Impresión de Fichas de Tarimas */}
            <TarimaLabelModal
                isOpen={printTarimaModal.isOpen}
                onClose={() => setPrintTarimaModal({ isOpen: false, tarima: null, allTarimas: [], receptionData: {} })}
                tarima={printTarimaModal.tarima}
                allTarimas={printTarimaModal.allTarimas}
                receptionData={printTarimaModal.receptionData}
            />

            {/* Modal de Visualización e Impresión de Reporte LAB 001 */}
            <PdfViewerModal
                isOpen={pdfPreviewModal.isOpen}
                onClose={handleClosePdfPreview}
                title={pdfPreviewModal.title}
                subtitle={pdfPreviewModal.subtitle}
                badge="LAB 001 • Rev. 7.03.24"
                pdfUrl={pdfPreviewModal.url}
                fileName={pdfPreviewModal.fileName}
                footerNote="Laboratorio de Control de Calidad • Reporte Oficial de Materia Prima y Dictamen Técnico (LAB 001)"
            />

            {/* Modal de Parametrización de Proveedor y Taras */}
            <ProviderLotConfigModal
                isOpen={lotConfigModalData.isOpen}
                onClose={() => setLotConfigModalData({ isOpen: false, config: null, initialProviderId: '' })}
                configToEdit={lotConfigModalData.config}
                initialProviderId={lotConfigModalData.initialProviderId}
                providers={providers}
                loadProvidersOptions={loadProvidersOptions}
                onSaved={handleLotConfigSaved}
            />
        </div>);
}
