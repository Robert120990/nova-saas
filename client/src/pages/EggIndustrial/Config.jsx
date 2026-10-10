import { useConfigModel, ConfigHelpConceptModalModal, ConfigProductsTab, ConfigLotPrefixesTab, ConfigCostsTab, ConfigIsSyncModalOpenModal, ConfigCodeMappingsTab, ConfigIsProductCatalogModalOpenModal, ConfigIsMappingModalOpenModal, ConfigHeader } from '../../components/egg/config';
import ProviderLotConfigModal from '../../components/egg/ProviderLotConfigModal';




export default function EggConfig() {
 const model = useConfigModel();
 const { providers, isLotConfigModalOpen, setIsLotConfigModalOpen, editingLotConfig, loadProvidersOptions, handleLotConfigSaved } = model;
 return (<div className="space-y-4 sm:space-y-6 text-slate-900">
            {/* Header */}
            <ConfigHeader model={model} />

            {/* TAB 1: COSTOS FIJOS Y PLANILLAS */}
            <ConfigCostsTab model={model} />

            {/* TAB 2: PREFIJOS DE LOTE POR PROVEEDOR */}
            <ConfigLotPrefixesTab model={model} />

            {/* TAB 3: RENDIMIENTOS Y PESOS POR PRODUCTO */}
            <ConfigProductsTab model={model} />

            {/* TAB 4: VINCULACIÓN DE CÓDIGOS DE PRODUCTO (PÁGINA 5 DEL DOCUMENTO) */}
            <ConfigCodeMappingsTab model={model} />

            {/* MODAL DE VINCULACIÓN DE CÓDIGOS */}
            <ConfigIsMappingModalOpenModal model={model} />

            {/* MODAL DEL CATÁLOGO DE PRODUCTOS Y CÓDIGOS DEL SISTEMA */}
            <ConfigIsProductCatalogModalOpenModal model={model} />
            {/* MODAL DE AYUDA INTERACTIVO (?) */}
            <ConfigHelpConceptModalModal model={model} />

            {/* MODAL DE SINCRONIZACIÓN DE PLANILLAS Y GASTOS OPERATIVOS */}
            <ConfigIsSyncModalOpenModal model={model} />

            {/* MODAL DE PARAMETRIZACIÓN DE PREFIJO DE LOTE POR PROVEEDOR */}
            <ProviderLotConfigModal
                isOpen={isLotConfigModalOpen}
                onClose={() => setIsLotConfigModalOpen(false)}
                configToEdit={editingLotConfig}
                providers={providers}
                loadProvidersOptions={loadProvidersOptions}
                onSaved={handleLotConfigSaved}
            />
        </div>);
}
