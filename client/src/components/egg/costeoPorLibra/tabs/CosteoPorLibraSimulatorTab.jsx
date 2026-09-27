

import {
    EggCosteoSimulatorTab
} from '../../costeo';


export default function CosteoPorLibraSimulatorTab({ model }) {
    const { activeTab, calcParams, calculationResult, handleParamChange } = model;

    return (<>{activeTab === 'simulator' && (
                <EggCosteoSimulatorTab
                    calcParams={calcParams}
                    calculationResult={calculationResult}
                    handleParamChange={handleParamChange}
                />
            )}</>);
}
