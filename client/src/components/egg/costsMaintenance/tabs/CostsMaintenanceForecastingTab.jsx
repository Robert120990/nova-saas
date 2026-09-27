import EggForecastTab from '../../tabs/EggForecastTab';




export default function CostsMaintenanceForecastingTab({ model }) {
    const { forecast, activeTab } = model;

    return (<>{activeTab === 'forecasting' && <EggForecastTab forecast={forecast} />}</>);
}
