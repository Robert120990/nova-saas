const inputClass = 'w-full mt-1 text-lg font-bold bg-slate-50 rounded-xl px-4 py-2';
const AccountingFiscalHeader = ({ opening, year, date, changeYear, changeDate, busy }) => (
    <fieldset disabled={busy} className="grid grid-cols-1 sm:grid-cols-2 gap-4 min-w-0">
        <div className="bg-white p-5 rounded-2xl border min-w-0">
            <label className="text-[10px] font-black uppercase text-slate-400">{opening ? 'Nuevo Año' : 'Año Fiscal'}</label>
            <input type="number" min="2000" max="2200" value={year} onChange={event => changeYear(event.target.value)} className={inputClass} />
        </div>
        <div className="bg-white p-5 rounded-2xl border min-w-0">
            <label className="text-[10px] font-black uppercase text-slate-400">{opening ? 'Fecha Apertura' : 'Fecha de Cierre'}</label>
            <input type="date" value={date} onChange={event => changeDate(event.target.value)} className={`${inputClass} min-w-0`} />
        </div>
    </fieldset>
);
export default AccountingFiscalHeader;
