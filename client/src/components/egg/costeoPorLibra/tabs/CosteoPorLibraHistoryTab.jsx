

import {
    EggCosteoHistoryTab
} from '../../costeo';


export default function CosteoPorLibraHistoryTab({ model }) {
    const { activeTab, scenarios, costingHistoryList, loadingHistory, globalAgreementHistory, loadingGlobalHistory, historySubTab, setHistorySubTab, loadGlobalAgreementHistory, handlePresetChange } = model;

    return (<>{activeTab === 'history' && (
                <EggCosteoHistoryTab
                    historySubTab={historySubTab}
                    setHistorySubTab={setHistorySubTab}
                    costingHistoryList={costingHistoryList}
                    loadingHistory={loadingHistory}
                    handlePresetChange={handlePresetChange}
                    scenarios={scenarios}
                    globalAgreementHistory={globalAgreementHistory}
                    loadingGlobalHistory={loadingGlobalHistory}
                    loadGlobalAgreementHistory={loadGlobalAgreementHistory}
                />
            )}</>);
}
