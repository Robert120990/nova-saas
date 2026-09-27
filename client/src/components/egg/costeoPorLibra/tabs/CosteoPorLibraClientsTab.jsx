

import {
    EggCosteoClientsTab
} from '../../costeo';


export default function CosteoPorLibraClientsTab({ model }) {
    const { activeTab, calculationResult, validityFilter, setValidityFilter, setAgreementModal, handleOpenAgreementHistory, handleDeleteAgreement } = model;

    return (<>{activeTab === 'clients' && (
                <EggCosteoClientsTab
                    calculationResult={calculationResult}
                    validityFilter={validityFilter}
                    setValidityFilter={setValidityFilter}
                    setAgreementModal={setAgreementModal}
                    handleOpenAgreementHistory={handleOpenAgreementHistory}
                    handleDeleteAgreement={handleDeleteAgreement}
                />
            )}</>);
}
