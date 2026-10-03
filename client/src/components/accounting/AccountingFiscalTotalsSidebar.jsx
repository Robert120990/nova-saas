import Money from '../ui/Money';
const AccountingFiscalTotalsSidebar = ({ accounts, opening }) => {
    const rows = Array.isArray(accounts) ? accounts : [];
    const totals = opening ? [
        ['Total Activo', rows.filter(account => String(account.code).startsWith('1')).reduce((sum, account) => sum + Number(account.balance || 0), 0)],
        ['Pasivo + Patrimonio', rows.filter(account => /^[23]/.test(String(account.code))).reduce((sum, account) => sum + Number(account.balance || 0), 0)]
    ] : [['Resultado del Ejercicio', rows.reduce((sum, account) => sum + Number(account.balance || 0) * (account.nature === 'credit' ? 1 : -1), 0)]];
    return <div className="space-y-3">{totals.map(([label, amount]) => (
        <div key={label} className="bg-white p-5 rounded-2xl border">
            <p className="text-[10px] font-black uppercase text-slate-400">{label}</p>
            <p className="text-2xl font-black text-indigo-600"><Money value={amount} /></p>
        </div>
    ))}</div>;
};
export default AccountingFiscalTotalsSidebar;
