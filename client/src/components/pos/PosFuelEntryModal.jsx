import { Zap } from 'lucide-react';

/**
 * PosFuelEntryModal Component
 * Modal for entering gas/fuel pump entries by total dollar amount or gallons,
 * with quick preset amounts ($5, $10, $20, $40) and automatic customer discounts.
 */
const PosFuelEntryModal = ({
    isOpen,
    onClose,
    fuelProd,
    getCustomerDiscount,
    calculateDiscountedPrice,
    fuelAmount,
    setFuelAmount,
    fuelQty,
    setFuelQty,
    handleAddFuelToCart
}) => {
    if (!isOpen) return null;

    const discountRule = getCustomerDiscount ? getCustomerDiscount(fuelProd?.id) : null;
    const finalPrice = calculateDiscountedPrice 
        ? calculateDiscountedPrice(parseFloat(fuelProd?.precio_unitario || 0), discountRule)
        : parseFloat(fuelProd?.precio_unitario || 0);

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[300] flex items-center justify-center p-4">
            <div className="bg-white rounded-[3rem] w-full max-w-lg p-6 md:p-10 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-300">
                <div className="flex flex-col items-center text-center mb-8">
                    <div className="p-4 bg-orange-100 rounded-3xl text-orange-600 mb-4">
                        <Zap size={40} />
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">{fuelProd?.nombre}</h3>
                    <div className="mt-2">
                        <p className={`font-bold text-sm ${discountRule ? 'text-slate-400 line-through' : 'text-slate-400'}`}>
                            Precio Ref: ${parseFloat(fuelProd?.precio_unitario || 0).toFixed(3)} / gal
                        </p>
                        {discountRule && (
                            <p className="text-indigo-600 font-black text-lg animate-pulse uppercase italic">
                                Precio Especial: ${finalPrice.toFixed(3)} / gal
                            </p>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">Monto en Dólares ($)</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300">$</span>
                                <input 
                                    autoFocus
                                    type="number"
                                    value={fuelAmount}
                                    onFocus={(e) => e.target.select()}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleAddFuelToCart();
                                    }}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setFuelAmount(val);
                                        const rule = getCustomerDiscount ? getCustomerDiscount(fuelProd?.id) : null;
                                        const price = calculateDiscountedPrice 
                                            ? calculateDiscountedPrice(parseFloat(fuelProd?.precio_unitario || 0), rule) 
                                            : parseFloat(fuelProd?.precio_unitario || 0);
                                        if (price > 0 && val) {
                                            setFuelQty((parseFloat(val) / price).toFixed(4));
                                        } else {
                                            setFuelQty('');
                                        }
                                    }}
                                    placeholder="0.00"
                                    className="w-full pl-10 pr-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-2xl font-black text-right outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">Cantidad en Galones</label>
                            <input 
                                type="number"
                                value={fuelQty}
                                onFocus={(e) => e.target.select()}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAddFuelToCart();
                                }}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFuelQty(val);
                                    const rule = getCustomerDiscount ? getCustomerDiscount(fuelProd?.id) : null;
                                    const price = calculateDiscountedPrice 
                                        ? calculateDiscountedPrice(parseFloat(fuelProd?.precio_unitario || 0), rule) 
                                        : parseFloat(fuelProd?.precio_unitario || 0);
                                    if (price > 0 && val) {
                                        setFuelAmount((parseFloat(val) * price).toFixed(2));
                                    } else {
                                        setFuelAmount('');
                                    }
                                }}
                                placeholder="0.0000"
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-2xl font-black text-right outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[5, 10, 20, 40].map(val => (
                            <button 
                                key={val}
                                type="button"
                                onClick={() => {
                                    setFuelAmount(val.toString());
                                    const rule = getCustomerDiscount ? getCustomerDiscount(fuelProd?.id) : null;
                                    const price = calculateDiscountedPrice 
                                        ? calculateDiscountedPrice(parseFloat(fuelProd?.precio_unitario || 0), rule) 
                                        : parseFloat(fuelProd?.precio_unitario || 0);
                                    setFuelQty((val / price).toFixed(4));
                                }}
                                className="py-3 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl font-black text-xs transition-all border border-slate-100 hover:border-indigo-200"
                            >
                                ${val}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-4 mt-8">
                        <button 
                            type="button"
                            onClick={onClose}
                            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="button"
                            onClick={handleAddFuelToCart}
                            className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-200 transition-all active:scale-95"
                        >
                            Añadir al Carrito (Enter)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PosFuelEntryModal;
