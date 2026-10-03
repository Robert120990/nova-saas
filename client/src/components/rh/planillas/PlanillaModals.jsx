import EmployeeSearchModal from '../../rh/EmployeeSearchModal';
import PlanillaReportModal from '../../rh/PlanillaReportModal';
import PlanillaExportModal from '../../rh/PlanillaExportModal';


const PlanillaModals = ({ model }) => {
    const { isEmpModalOpen, setIsEmpModalOpen, handleSelectEmployee, previewPeriodo, setPreviewPeriodo, exportModalConfig, setExportModalConfig, handleConfirmExport } = model;
    return (<><EmployeeSearchModal
                isOpen={isEmpModalOpen}
                onClose={() => setIsEmpModalOpen(false)}
                onSelect={handleSelectEmployee}
            />
<PlanillaReportModal
                isOpen={!!previewPeriodo}
                onClose={() => setPreviewPeriodo(null)}
                periodo={previewPeriodo}
            />
<PlanillaExportModal
                isOpen={!!exportModalConfig}
                onClose={() => setExportModalConfig(null)}
                periodo={exportModalConfig}
                onConfirm={handleConfirmExport}
            /></>);
};
export default PlanillaModals;
