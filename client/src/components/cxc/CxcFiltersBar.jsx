import { DollarSign } from 'lucide-react';
import SearchableSelect from '../ui/SearchableSelect';
import Money from '../ui/Money';

const CxcFiltersBar = ({
    branches = [],
    selectedBranchId,
    onBranchChange,
    selectedCustomerId,
    onCustomerChange,
    loadCustomersOptions,
    totalBalance = 0
}) => {
    return (
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-center">
            <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Sucursal
                </label>
                <select 
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition-all text-xs font-bold uppercase h-[36px] cursor-pointer"
                    value={selectedBranchId}
                    onChange={(e) => onBranchChange(e.target.value)}
                >
                    <option value="">-- SELECCIONAR SUCURSAL --</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.nombre?.toUpperCase()}</option>)}
                </select>
            </div>

            <div className="sm:col-span-1 md:col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Cliente
                </label>
                <SearchableSelect 
                    placeholder="BUSCAR CLIENTE POR NOMBRE O NRC/NIT..."
                    loadOptions={loadCustomersOptions}
                    value={selectedCustomerId}
                    onChange={(e) => onCustomerChange(e.target.value)}
                    valueKey="id"
                    labelKey="nombre"
                    codeKey="numero_documento"
                    displayKey="nombre"
                />
            </div>

            {/* Badge Saldo Total del Cliente */}
            <div className="bg-indigo-600 text-white rounded-xl p-2.5 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                        <DollarSign size={16} />
                    </div>
                    <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-200 block">Saldo Total</span>
                        <span className="text-sm sm:text-base font-black tracking-tight leading-tight">
                            <Money value={totalBalance} />
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CxcFiltersBar;
