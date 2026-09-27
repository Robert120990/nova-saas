import { formatDate } from '../../../utils/dateUtils';


import EggQualityEvaluationModal from '../EggQualityEvaluationModal';


export default function ReceptionActionBar({ model }) {
    const { canEditQuality, getQualityBadgeClass, printingPdfId, handlePrintLab001FromModal, handleDownloadLab001DocxFromModal, handlePrintOriginCertFromModal, handleDownloadOriginCertDocxFromModal, qualityModal, setQualityModal, handleSaveQualityClassification } = model;

    return (<EggQualityEvaluationModal
                isOpen={qualityModal.isOpen}
                onClose={() => setQualityModal(prev => ({ ...prev, isOpen: false }))}
                qualityModal={qualityModal}
                setQualityModal={setQualityModal}
                canEditQuality={canEditQuality}
                formatDate={formatDate}
                getQualityBadgeClass={getQualityBadgeClass}
                handleSaveQualityClassification={handleSaveQualityClassification}
                handlePrintOriginCertFromModal={handlePrintOriginCertFromModal}
                handleDownloadOriginCertDocxFromModal={handleDownloadOriginCertDocxFromModal}
                handlePrintLab001FromModal={handlePrintLab001FromModal}
                handleDownloadLab001DocxFromModal={handleDownloadLab001DocxFromModal}
                printingPdfId={printingPdfId}
            />);
}
