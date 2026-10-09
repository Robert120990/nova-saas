import { useState } from 'react';
import { Barcode, Plus, Trash2, Tag, Info } from 'lucide-react';
import { toast } from 'sonner';

/**
 * ProductAdditionalBarcodes
 * Component for managing additional/alias barcodes for a product (e.g. Clipper designs, import lots).
 */
const ProductAdditionalBarcodes = ({
    barcodes = [],
    onChange,
    mainBarcode = '',
    disabled = false
}) => {
    const [barcodeInput, setBarcodeInput] = useState('');
    const [descriptionInput, setDescriptionInput] = useState('');

    const handleAdd = (e) => {
        if (e) e.preventDefault();
        const trimmedCode = barcodeInput.trim();
        const trimmedDesc = descriptionInput.trim();

        if (!trimmedCode) return;

        if (mainBarcode && trimmedCode.toLowerCase() === mainBarcode.trim().toLowerCase()) {
            toast.error('Este código ya está configurado como el código de barra principal');
            return;
        }

        const isDuplicate = barcodes.some(
            b => (typeof b === 'string' ? b : b.barcode || '').trim().toLowerCase() === trimmedCode.toLowerCase()
        );
        if (isDuplicate) {
            toast.error('Este código de barra ya fue agregado a la lista');
            return;
        }

        const newBarcodeObj = {
            barcode: trimmedCode,
            description: trimmedDesc || null
        };

        onChange([...barcodes, newBarcodeObj]);
        setBarcodeInput('');
        setDescriptionInput('');
    };

    const handleRemove = (indexToRemove) => {
        onChange(barcodes.filter((_, idx) => idx !== indexToRemove));
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
        }
    };

    return (
        <div className="space-y-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Barcode size={16} className="text-indigo-600" />
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Códigos de Barra Adicionales / Alias
                    </span>
                </div>
                <span className="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                    {barcodes.length} {barcodes.length === 1 ? 'alias registrado' : 'alias registrados'}
                </span>
            </div>

            <p className="text-[11px] text-slate-500 flex items-start gap-1.5 leading-relaxed">
                <Info size={13} className="shrink-0 text-slate-400 mt-0.5" />
                <span>
                    Permite escanear diferentes presentaciones, diseños surtidos o lotes de importación para el mismo producto sin duplicar el inventario ni dividir el stock.
                </span>
            </p>

            {/* Input row */}
            {!disabled && (
                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                            <Barcode size={14} />
                        </div>
                        <input
                            type="text"
                            value={barcodeInput}
                            onChange={(e) => setBarcodeInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Pistolear o escribir código..."
                            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                        />
                    </div>
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                            <Tag size={13} />
                        </div>
                        <input
                            type="text"
                            value={descriptionInput}
                            onChange={(e) => setDescriptionInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Nota o diseño (ej. Lote México, Flores...)"
                            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleAdd}
                        disabled={!barcodeInput.trim()}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
                    >
                        <Plus size={14} />
                        <span>Agregar</span>
                    </button>
                </div>
            )}

            {/* Barcodes list */}
            {barcodes.length > 0 ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {barcodes.map((item, index) => {
                        const code = typeof item === 'string' ? item : item.barcode;
                        const desc = typeof item === 'object' ? item.description : null;
                        return (
                            <div
                                key={index}
                                className="flex items-center justify-between px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-xs hover:border-slate-300 transition-colors"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <Barcode size={13} className="text-slate-400 shrink-0" />
                                    <span className="font-mono font-bold text-slate-800 tracking-tight">
                                        {code}
                                    </span>
                                    {desc && (
                                        <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded truncate max-w-[180px]">
                                            {desc}
                                        </span>
                                    )}
                                </div>
                                {!disabled && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemove(index)}
                                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                        title="Eliminar este código alias"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="py-2.5 text-center text-xs text-slate-400 italic bg-white/60 rounded-lg border border-dashed border-slate-200">
                    No hay códigos de barra adicionales registrados.
                </div>
            )}
        </div>
    );
};

export default ProductAdditionalBarcodes;
