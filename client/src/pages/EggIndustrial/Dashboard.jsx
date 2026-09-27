import { useDashboardModel, DashboardHeader, DashboardFiltersBar, DashboardContent } from '../../components/egg/dashboard';


export default function EggDashboard() {
 const model = useDashboardModel();

 return (<div className="space-y-6 text-slate-900">
            <p className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">Modo demostración: datos simulados. No representa lecturas ni control de equipos físicos.</p>
            {/* Header del Dashboard */}
            <DashboardHeader model={model} />

            {/* Layout de Grid */}
            <DashboardFiltersBar model={model} />

            {/* Fila de Tanques y Bitácora de Alertas */}
            <DashboardContent model={model} />
        </div>);
}
