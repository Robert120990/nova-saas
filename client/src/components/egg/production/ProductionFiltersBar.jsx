

import EggBatchStagesModal from '../EggBatchStagesModal';


export default function ProductionFiltersBar({ model }) {
    const { navigate, setQualityModal, setSelectedBatchForPasteurize, setIsPasteurizeModalOpen, canManageLots, stagesModal, setStagesModal, setAddTarimasModal, setRemanenteModal, handleOpenClosePasteurization, handleReopenPasteurization, handleReopenBatchPackaging, handleOpenBalanceModal, handleOpenWastesModal, handleOpenEditWaste, handleDeleteWaste, handleOpenEditRemanente, handleDeleteRemanente, handleExportSummary } = model;

    return (<EggBatchStagesModal
                isOpen={stagesModal.isOpen}
                onClose={() => setStagesModal({ isOpen: false, batch: null, data: null, loading: false })}
                stagesModal={stagesModal}
                canManageLots={canManageLots}
                onClosePasteurization={(batch) => handleOpenClosePasteurization(batch)}
                onReopenPasteurization={(batch) => handleReopenPasteurization(batch)}
                onReopenPackaging={(batch) => handleReopenBatchPackaging(batch?.id || batch)}
                onOpenAddTarimas={(batch) => setAddTarimasModal({
                    isOpen: true,
                    batch: batch,
                    raw_materials: [
                        { raw_material_id: '', quantity_lbs: '', boxes_count: '', tarimas: [] }
                    ],
                    manualTarimaInput: '',
                    notes: '',
                    isSubmitting: false
                })}
                onOpenPasteurize={(batch) => {
                    setSelectedBatchForPasteurize(batch?.id);
                    setIsPasteurizeModalOpen(true);
                    setStagesModal({ isOpen: false, batch: null, data: null, loading: false });
                }}
                onOpenBalance={(batch) => handleOpenBalanceModal(batch)}
                onOpenRemanente={(batch) => setRemanenteModal({
                    isOpen: true,
                    id: null,
                    batch: batch,
                    product_type: batch?.product_type || 'huevo entero',
                    presentation: 'cubeta 30LB',
                    weight_lbs: '',
                    is_pasteurized: batch?.status === 'pasteurizado',
                    destination: 'proximo_empaque',
                    notes: '',
                    isSubmitting: false
                })}
                onOpenEditRemanente={(rem) => handleOpenEditRemanente(rem)}
                onDeleteRemanente={(remId) => handleDeleteRemanente(remId)}
                onNavigateEmpaque={() => navigate('/industrial/empaque')}
                onOpenWastes={(batch) => handleOpenWastesModal(batch)}
                onOpenEditWaste={(waste) => handleOpenEditWaste(waste)}
                handleDeleteWaste={(wasteId) => handleDeleteWaste(wasteId)}
                onDeleteWaste={(wasteId) => handleDeleteWaste(wasteId)}
                onExportSummary={(batchId, format) => handleExportSummary(batchId, format)}
                onOpenQualityEvaluation={(b) => setQualityModal({ isOpen: true, batch: b })}
            />);
}
