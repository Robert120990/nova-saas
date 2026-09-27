import { formatDate } from '../../../utils/dateUtils';


import EggReceptionDetailModal from '../EggReceptionDetailModal';


export default function ReceptionContent({ model }) {
    const { user, viewingReception, setViewingReception, printingPdfId, handlePrintLab001, handleOpenQualityModal, handleOpenPrintTarima, handleEdit, handlePrintReceptionSummary, getStatusBadge, getStatusIcon } = model;

    return (<EggReceptionDetailModal
                isOpen={Boolean(viewingReception)}
                onClose={() => setViewingReception(null)}
                reception={viewingReception}
                user={user}
                formatDate={formatDate}
                getStatusBadge={getStatusBadge}
                getStatusIcon={getStatusIcon}
                printingPdfId={printingPdfId}
                handlePrintLab001={handlePrintLab001}
                handleOpenQualityModal={handleOpenQualityModal}
                handleOpenPrintTarima={handleOpenPrintTarima}
                handlePrintReceptionSummary={handlePrintReceptionSummary}
                handleEdit={handleEdit}
            />);
}
