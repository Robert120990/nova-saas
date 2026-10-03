import { Lock, Unlock } from 'lucide-react';
import { formatDate, getTodayString } from '../../utils/dateUtils';
import AccountingFiscalHeader from './AccountingFiscalHeader';
import AccountingFiscalBalancesTable from './AccountingFiscalBalancesTable';
import AccountingFiscalTotalsSidebar from './AccountingFiscalTotalsSidebar';
import AccountingFiscalActionBar from './AccountingFiscalActionBar';

const AccountingFiscalScreen = ({ model }) => {
    const Icon = model.opening ? Unlock : Lock;
    const cutoff = model.opening ? getTodayString(new Date(Number(model.year) - 1, 11, 31)) : model.date;
    return (
        <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 pb-20">
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 flex items-center gap-3"><Icon size={28} className="text-indigo-600 shrink-0" />{model.opening ? 'Apertura de Ejercicio' : 'Cierre Contable'}</h1>
                <p className="text-slate-500 font-medium mt-1">{model.opening ? 'Traslada los saldos del ejercicio anterior.' : 'Cierra las cuentas de resultado del ejercicio seleccionado.'} Saldos al {formatDate(cutoff)}.</p>
            </div>
            <AccountingFiscalHeader {...model} />
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-4">
                <AccountingFiscalBalancesTable {...model} />
                <aside className="space-y-4 min-w-0"><AccountingFiscalTotalsSidebar {...model} /><AccountingFiscalActionBar {...model} /></aside>
            </div>
        </div>
    );
};
export default AccountingFiscalScreen;
