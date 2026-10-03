import { AccountingFiscalScreen, useFiscalOperation } from '../components/accounting';
const YearClosing = () => {
    const model = useFiscalOperation('closing');
    return <AccountingFiscalScreen model={model} />;
};
export default YearClosing;
