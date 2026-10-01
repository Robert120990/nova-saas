export default function PackagingStockCards({ batches }) {
    const activeBatches = (Array.isArray(batches) ? batches : []).filter(
        b => b.status === 'pasteurizado' || b.status === 'empaquetado'
    );
    if (activeBatches.length === 0) return null;

    const stockByProduct = {};
    activeBatches.forEach(b => {
        const key = b.product_type || 'otro';
        if (!stockByProduct[key]) stockByProduct[key] = 0;
        stockByProduct[key] += Math.max(0, parseFloat(b.yield_liquid_lbs || 0) - parseFloat(b.packaged_weight_lbs || 0));
    });
    const entries = Object.entries(stockByProduct);

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {entries.map(([product, lbs]) => (
                <div key={product} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block truncate">{product}</span>
                    <span className={`text-sm font-bold ${lbs > 0 ? 'text-teal-700' : 'text-slate-400'}`}>
                        {lbs.toLocaleString(undefined, { maximumFractionDigits: 0 })} Lbs
                    </span>
                    <span className="text-[9px] text-slate-400 block font-medium">disponible</span>
                </div>
            ))}
        </div>
    );
}
