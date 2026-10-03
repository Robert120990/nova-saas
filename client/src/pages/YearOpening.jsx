import { AccountingFiscalScreen, useFiscalOperation } from '../components/accounting';
const YearOpening = () => {
    const model = useFiscalOperation('opening');
    return <AccountingFiscalScreen model={model} />;
};
export default YearOpening;
