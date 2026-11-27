import EmployeeSearchModal from '../../rh/EmployeeSearchModal';
import PlanillaReportModal from '../../rh/PlanillaReportModal';
import PlanillaExportModal from '../../rh/PlanillaExportModal';
import PlanillaConflictModal from './PlanillaConflictModal';
import PlanillaBiometricCorteModal from './PlanillaBiometricCorteModal';


const PlanillaModals = ({ model }) => {
    const { isEmpModalOpen, setIsEmpModalOpen, handleSelectEmployee, previewPeriodo, setPreviewPeriodo, exportModalConfig, setExportModalConfig, handleConfirmExport, isBiometricCorteModalOpen, setIsBiometricCorteModalOpen, handleBiometricCorteSuccess, periodoAnio, periodoMes, quincena } = model;
    return (<><PlanillaConflictModal open={!!model.conflict} onClose={() => model.setConflict(null)} onSave={model.resolveConflict} current={model.conflict?.data} details={model.detalles} busy={model.guardandoManual} /><EmployeeSearchModal
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
            />
<PlanillaBiometricCorteModal
                open={isBiometricCorteModalOpen}
                onClose={() => setIsBiometricCorteModalOpen(false)}
                onSuccess={handleBiometricCorteSuccess}
                periodoAnio={periodoAnio}
                periodoMes={periodoMes}
                quincena={quincena}
            /></>);
};
export default PlanillaModals;
