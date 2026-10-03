import { useAuth } from '../../context/AuthContext';
import usePlanillas from '../../components/rh/planillas/usePlanillas';
import PlanillasHistoryTab from '../../components/rh/tabs/PlanillasHistoryTab';
import PlanillasEditorTab from '../../components/rh/tabs/PlanillasEditorTab';
import { PlanillaModals } from '../../components/rh/planillas';

function PlanillasWorkspace() {
    const model = usePlanillas();
    return <div className="space-y-4 text-slate-900 pb-12">
        {model.activeTab === 'historial' ? <PlanillasHistoryTab model={model} /> : <PlanillasEditorTab model={model} />}
        <PlanillaModals model={model} />
    </div>;
}

export default function Planillas() {
    const { user } = useAuth();
    return <PlanillasWorkspace key={`${user?.id}:${user?.company_id}:${user?.branch_id}`} />;
}
