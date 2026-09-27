import {
    Boxes,
    Scale,
    PackageCheck
} from 'lucide-react';


export default function InventoryContent({ model }) {
    const { inventoryData } = model;

    return (<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Productos Mapeados</span>
                        <PackageCheck size={16} className="text-indigo-600" />
                    </div>
                    <span className="text-2xl font-black text-slate-900">
                        {inventoryData.by_mapping?.length || inventoryData.totals?.total_items || 0}
                    </span>
                    <span className="text-[11px] text-slate-400 block font-medium mt-0.5">
                        Vinculaciones configuradas
                    </span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Stock Total (Unidades)</span>
                        <Boxes size={16} className="text-blue-600" />
                    </div>
                    <span className="text-2xl font-black text-blue-700">
                        {parseInt(inventoryData.totals?.total_stock_units || 0).toLocaleString()}
                    </span>
                    <span className="text-[11px] text-slate-400 block font-medium mt-0.5">
                        Envases / presentaciones físicas
                    </span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Existencia en Libras</span>
                        <Scale size={16} className="text-emerald-600" />
                    </div>
                    <span className="text-2xl font-black text-emerald-600">
                        {parseFloat(inventoryData.totals?.total_weight_lbs || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </span>
                    <span className="text-[11px] text-emerald-700 font-bold block mt-0.5">
                        Libras Netas (Lbs)
                    </span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Existencia en Kilos</span>
                        <Scale size={16} className="text-violet-600" />
                    </div>
                    <span className="text-2xl font-black text-violet-700">
                        {parseFloat(inventoryData.totals?.total_weight_kg || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </span>
                    <span className="text-[11px] text-violet-700 font-bold block mt-0.5">
                        Kilogramos Netos (Kg)
                    </span>
                </div>
            </div>);
}
