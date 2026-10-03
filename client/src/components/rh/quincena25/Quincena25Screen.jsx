import { useQuincena25 } from '../../../hooks/useQuincena25';
import { Quincena25Header } from './index';
import Quincena25ManagementTab from './tabs/Quincena25ManagementTab';
import Quincena25HistoryTab from './tabs/Quincena25HistoryTab';
import PlanillaReportModal from '../PlanillaReportModal';

const Quincena25Screen = ({ companyId }) => {
    const model = useQuincena25(companyId);
    return (
        <div className="space-y-6 pb-12 animate-fadeIn text-slate-800">
            <Quincena25Header model={model} />
            {model.tabActiva === 'gestion'
                ? <Quincena25ManagementTab model={model} />
                : <Quincena25HistoryTab model={model} />}
            <PlanillaReportModal isOpen={!!model.previewPeriodo} onClose={() => model.setPreviewPeriodo(null)} periodo={model.previewPeriodo} />
        </div>
    );
};

export default Quincena25Screen;
