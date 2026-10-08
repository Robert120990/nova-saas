import Modal from '../../ui/Modal';
import {
    Sparkles,
    RefreshCw,
    CalendarCheck,
    CheckSquare
} from 'lucide-react';

import EggSuggestionsRangeBar from '../EggSuggestionsRangeBar';
import EggSuggestionsClientsPanel from './EggSuggestionsClientsPanel';
import ProductionCalendarMonthlyTab from './ProductionCalendarMonthlyTab';
import ProductionCalendarTacticalTab from './ProductionCalendarTacticalTab';

export default function ProductionCalendarSection6({ model }) {
    const {
        currentDate,
        suggestionsData,
        loadingSuggestions,
        isSuggestionsDrawerOpen,
        setIsSuggestionsDrawerOpen,
        suggestionsTab,
        setSuggestionsTab,
        monthlyPlanData,
        loadingMonthlyPlan,
        applyingPlan,
        selectedPlanRuns,
        setSelectedPlanRuns,
        suggestionStartDate,
        setSuggestionStartDate,
        suggestionEndDate,
        setSuggestionEndDate,
        preventPastSuggestions,
        setPreventPastSuggestions,
        availableCustomers = [],
        selectedCustomerIds,
        separationBatchLbs = 6000,
        setSeparationBatchLbs,
        isConfigDrawerOpen,
        setIsConfigDrawerOpen,
        handleToggleCustomer,
        handleSelectAllCustomers,
        handleDeselectAllCustomers,
        fetchSuggestions,
        fetchMonthlyPlan,
        handleApplyMonthlyPlan,
        handleOpenCreateModal
    } = model;

    const handleCalculateAll = () => {
        fetchMonthlyPlan(
            currentDate,
            suggestionStartDate,
            suggestionEndDate,
            preventPastSuggestions,
            selectedCustomerIds,
            separationBatchLbs
        );
        fetchSuggestions(
            suggestionStartDate,
            suggestionEndDate,
            selectedCustomerIds,
            separationBatchLbs
        );
    };

    const activeCount = selectedCustomerIds !== null
        ? selectedCustomerIds.length
        : availableCustomers.length;

    return (
        <Modal
            isOpen={isSuggestionsDrawerOpen}
            onClose={() => setIsSuggestionsDrawerOpen(false)}
            title="Sugerencias Inteligentes de Producción por IA"
            maxWidth="max-w-5xl"
        >
            <div className="space-y-4">
                {/* Barra de Selección de Rango y Configuración */}
                <EggSuggestionsRangeBar
                    startDate={suggestionStartDate}
                    setStartDate={setSuggestionStartDate}
                    endDate={suggestionEndDate}
                    setEndDate={setSuggestionEndDate}
                    preventPast={preventPastSuggestions}
                    setPreventPast={setPreventPastSuggestions}
                    availableCustomersCount={availableCustomers.length}
                    activeCustomersCount={activeCount}
                    separationBatchLbs={separationBatchLbs}
                    isConfigOpen={isConfigDrawerOpen}
                    onToggleConfig={() => setIsConfigDrawerOpen(!isConfigDrawerOpen)}
                    onCalculate={handleCalculateAll}
                    loading={loadingMonthlyPlan || loadingSuggestions}
                />

                {/* Panel Expandible de Clientes Contemplados y Lote de Separación */}
                {isConfigDrawerOpen && (
                    <EggSuggestionsClientsPanel
                        availableCustomers={availableCustomers}
                        selectedCustomerIds={selectedCustomerIds}
                        onToggleCustomer={handleToggleCustomer}
                        onSelectAllCustomers={handleSelectAllCustomers}
                        onDeselectAllCustomers={handleDeselectAllCustomers}
                        separationBatchLbs={separationBatchLbs}
                        onSeparationBatchChange={setSeparationBatchLbs}
                    />
                )}

                {/* Header Tabs */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setSuggestionsTab('monthly')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                suggestionsTab === 'monthly'
                                    ? 'bg-white text-indigo-700 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Plan Mensual Completo (IA)</span>
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                                {monthlyPlanData?.monthly_plan?.length || 0}
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setSuggestionsTab('tactical')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                suggestionsTab === 'tactical'
                                    ? 'bg-white text-emerald-700 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <CalendarCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Sugerencias Tácticas</span>
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                {suggestionsData?.suggestions?.length || 0}
                            </span>
                        </button>
                    </div>

                    {suggestionsTab === 'monthly' && (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleCalculateAll}
                                disabled={loadingMonthlyPlan}
                                className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium flex items-center gap-1.5 transition-colors"
                                title="Recalcular sugerencias del rango"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${loadingMonthlyPlan ? 'animate-spin text-indigo-600' : ''}`} />
                                <span>Recalcular</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleApplyMonthlyPlan}
                                disabled={applyingPlan || selectedPlanRuns.length === 0}
                                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs shadow-indigo-200 transition-all disabled:opacity-50"
                            >
                                <CheckSquare className="w-3.5 h-3.5" />
                                <span>
                                    {applyingPlan
                                        ? 'Programando...'
                                        : `Aplicar ${selectedPlanRuns.length} al Calendario`}
                                </span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Contenido Pestaña 1: Plan Mensual Completo */}
                {suggestionsTab === 'monthly' && (
                    <ProductionCalendarMonthlyTab
                        monthlyPlanData={monthlyPlanData}
                        loadingMonthlyPlan={loadingMonthlyPlan}
                        selectedPlanRuns={selectedPlanRuns}
                        setSelectedPlanRuns={setSelectedPlanRuns}
                    />
                )}

                {/* Contenido Pestaña 2: Sugerencias Tácticas */}
                {suggestionsTab === 'tactical' && (
                    <ProductionCalendarTacticalTab
                        suggestionsData={suggestionsData}
                        loadingSuggestions={loadingSuggestions}
                        setIsSuggestionsDrawerOpen={setIsSuggestionsDrawerOpen}
                        handleOpenCreateModal={handleOpenCreateModal}
                    />
                )}
            </div>
        </Modal>
    );
}
