import { useCosteoPorLibraModel, CosteoPorLibraSimulatorTab, CosteoPorLibraClientsTab, CosteoPorLibraHistoryTab, CosteoPorLibraCatalogTab, CosteoPorLibraCommissionsTab, CosteoPorLibraCalculatorTab, CosteoPorLibraHeader, CosteoPorLibraFiltersBar, CosteoPorLibraContent, CosteoPorLibraActionBar } from '../../components/egg/costeoPorLibra';


import {
    EggAgreementModal,
    EggAgreementHistoryModal,
    EggCipModal,
    EggPackagingMaterialModal,
    EggPlantConfigModal,
    EggSaveScenarioModal
} from '../../components/egg/costeo';
export default function EggCosteoPorLibra() {
 const model = useCosteoPorLibraModel();
 const { productsLookup, agreementModal, setAgreementModal, agreementHistoryModal, setAgreementHistoryModal, saveScenarioModal, setSaveScenarioModal, scenarioNameInput, setScenarioNameInput, cipModal, setCipModal, packagingModal, setPackagingModal, configModal, setConfigModal, handleSaveScenario, handleSaveAgreement, handleSelectProductForCip, handleSelectProductForPackaging, handleSaveCipItem, handleSavePackagingItem, handleSaveConfigs } = model;
 return (<div className="space-y-4 sm:space-y-6 text-slate-900">
            {/* Header Principal */}
            <CosteoPorLibraHeader model={model} />

            {/* BARRA GLOBAL DE RANGO DE FECHAS & FILTRO HISTÓRICO */}
            <CosteoPorLibraFiltersBar model={model} />

            {/* SECCIÓN DESTACADA: COSTO ACTUAL REAL DE OPERACIÓN (EN VIVO) */}
            <CosteoPorLibraContent model={model} />

            {/* Navigation Tabs */}
            <CosteoPorLibraActionBar model={model} />

            {/* TAB 1: CALCULADORA DINÁMICA */}
            <CosteoPorLibraCalculatorTab model={model} />

            {/* TAB 2: SIMULADOR COMERCIAL & MATRIZ DE RENTABILIDAD */}

            {/* TAB 2: SIMULADOR COMERCIAL & MATRIZ DE RENTABILIDAD */}
            <CosteoPorLibraSimulatorTab model={model} />

            {/* TAB 3: ACUERDOS CON CLIENTES & SEMÁFORO */}
            <CosteoPorLibraClientsTab model={model} />

            {/* TAB 4: INSUMOS, EMPAQUES Y CIP (CON BOTONES Y MODALES PARA AGREGAR) */}
            <CosteoPorLibraCatalogTab model={model} />

            {/* TAB 5: HISTÓRICO Y ESCENARIOS */}
            <CosteoPorLibraHistoryTab model={model} />

            <CosteoPorLibraCommissionsTab model={model} />


            {/* MODALES MODULARES DE COSTEO */}
            <EggAgreementModal
                open={agreementModal.open}
                data={agreementModal.data}
                onClose={() => setAgreementModal({ open: false, data: null })}
                onSave={handleSaveAgreement}
                setAgreementModal={setAgreementModal}
            />

            <EggAgreementHistoryModal
                open={agreementHistoryModal.open}
                agreement={agreementHistoryModal.agreement}
                history={agreementHistoryModal.history}
                loading={agreementHistoryModal.loading}
                onClose={() => setAgreementHistoryModal({ open: false, agreement: null, history: [], loading: false })}
            />

            <EggCipModal
                open={cipModal.open}
                data={cipModal.data}
                productsLookup={productsLookup}
                onClose={() => setCipModal({ open: false, data: null })}
                onSave={handleSaveCipItem}
                setCipModal={setCipModal}
                onSelectProduct={handleSelectProductForCip}
            />

            <EggPackagingMaterialModal
                open={packagingModal.open}
                data={packagingModal.data}
                productsLookup={productsLookup}
                onClose={() => setPackagingModal({ open: false, data: null })}
                onSave={handleSavePackagingItem}
                setPackagingModal={setPackagingModal}
                onSelectProduct={handleSelectProductForPackaging}
            />

            <EggPlantConfigModal
                open={configModal.open}
                data={configModal.data}
                onClose={() => setConfigModal({ open: false, data: null })}
                onSave={handleSaveConfigs}
                setConfigModal={setConfigModal}
            />

            <EggSaveScenarioModal
                open={saveScenarioModal}
                scenarioName={scenarioNameInput}
                setScenarioName={setScenarioNameInput}
                onClose={() => setSaveScenarioModal(false)}
                onSave={handleSaveScenario}
            />
        </div>);
}
