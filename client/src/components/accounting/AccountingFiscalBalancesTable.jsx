import Money from '../ui/Money';
const AccountingFiscalBalancesTable = ({ accounts, opening, year, isLoading, isError }) => (
    <div className="bg-white rounded-2xl border overflow-hidden min-w-0">
        <h3 className="px-4 py-4 bg-slate-50 border-b text-sm font-black text-slate-900">{opening ? 'Saldos de Balance' : 'Cuentas de Resultado'} — Año {opening ? Number(year) - 1 : year}</h3>
        {isLoading ? <p className="py-10 text-center text-slate-400">Cargando saldos...</p> : isError ? <p className="p-4 text-sm text-rose-600">No se pudieron consultar los saldos. Recarga antes de generar.</p> : (
            <div className="overflow-x-auto">
                <table className="w-full text-left table-cards md:min-w-[500px]">
                    <thead><tr className="border-b bg-slate-50">{['Código', 'Cuenta', 'Tipo', 'Saldo'].map(label => <th key={label} className="px-4 py-2 text-[10px] uppercase text-slate-400">{label}</th>)}</tr></thead>
                    <tbody>
                        {(Array.isArray(accounts) ? accounts : []).map(account => (
                            <tr key={account.id} className="border-b border-slate-50">
                                <td data-label="Código" className="px-4 py-2 font-mono text-xs">{account.code}</td>
                                <td data-label="Cuenta" className="px-4 py-2 text-xs font-bold">{account.name}</td>
                                <td data-label="Tipo" className="px-4 py-2 text-xs">{account.type_name}</td>
                                <td data-label="Saldo" className="px-4 py-2 text-xs font-bold text-right"><Money value={account.balance} /></td>
                            </tr>
                        ))}
                        {!accounts.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Sin saldos para este ejercicio.</td></tr>}
                    </tbody>
                </table>
            </div>
        )}
    </div>
);
export default AccountingFiscalBalancesTable;
