const AccountingFiscalActionBar = ({ description, setDescription, busy, saving, generate, opening, accounts, isError }) => (
    <fieldset disabled={busy} className="bg-white p-5 rounded-2xl border space-y-3 min-w-0">
        <label className="text-[10px] font-black uppercase text-slate-400">Descripción de la Partida</label>
        <input value={description} onChange={event => setDescription(event.target.value)} className="w-full px-4 py-3 bg-slate-50 rounded-xl text-sm font-bold" />
        <button type="button" onClick={generate} disabled={busy || isError || !accounts.length} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 px-2 rounded-2xl font-black uppercase text-xs disabled:opacity-50">
            {saving ? 'Generando...' : `Generar Partida de ${opening ? 'Apertura' : 'Cierre'}`}
        </button>
    </fieldset>
);
export default AccountingFiscalActionBar;
