import { useCostsMaintenanceModel, CostsMaintenanceForecastingTab, CostsMaintenanceVariableCostsModalModal, CostsMaintenanceNewCustomerModalModal, CostsMaintenanceMovementModalModal, CostsMaintenanceMaintenanceTab, CostsMaintenanceCostsTab, CostsMaintenanceStatementModalModal, CostsMaintenanceReturnablesTab, CostsMaintenanceHeader, CostsMaintenanceFiltersBar } from '../../components/egg/costsMaintenance';
import {
    Settings
} from 'lucide-react';
export default function EggCostsMaintenance() {
 const model = useCostsMaintenanceModel();

 return (<div className="space-y-4 sm:space-y-6 text-slate-900">
            {/* Header Banner - Acceso al Costeo por Libra */}
            <CostsMaintenanceHeader model={model} />

            {/* Encabezado Principal */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="p-2.5 sm:p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shrink-0">
                        <Settings className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <div>
                        <h1 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight leading-snug">Gestión de Costos, Envases y Mantenimiento</h1>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                            Costos por lote de producción, control de cubetas retornables y bitácora de equipos.
                        </p>
                    </div>
                </div>
            </div>

            {/* Selector de Pestañas */}
            <CostsMaintenanceFiltersBar model={model} />

            {/* PESTAÑA 1: COSTOS POR LOTE */}
            <CostsMaintenanceCostsTab model={model} />

            {/* PESTAÑA 2: CONTROL DE ENVASES RETORNABLES */}
            <CostsMaintenanceReturnablesTab model={model} />

            {/* PESTAÑA 3: MANTENIMIENTO DE MAQUINARIA */}
            <CostsMaintenanceMaintenanceTab model={model} />

            {/* PESTAÑA 4: PROYECCIÓN DE DEMANDA */}
            <CostsMaintenanceForecastingTab model={model} />

            {/* MODAL 1: ESTADO DE CUENTA DE ENVASES DEL CLIENTE (KARDEX DETALLADO) */}
            <CostsMaintenanceStatementModalModal model={model} />

            {/* MODAL 2: MOVIMIENTO DE ENVASES RETORNABLES (CUBETAS Y TAPADERAS) */}
            <CostsMaintenanceMovementModalModal model={model} />

            {/* MODAL 3: REGISTRAR CLIENTE PARA ENVASES RETORNABLES */}
            <CostsMaintenanceNewCustomerModalModal model={model} />

            {/* MODAL: COSTOS VARIABLES */}
            <CostsMaintenanceVariableCostsModalModal model={model} />
        </div>);
}
