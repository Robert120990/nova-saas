import {
    Plus,
    Barcode,
    Snowflake
} from 'lucide-react';




export default function PackagingHeader({ model }) {
    const { setIsNewPackagingModalOpen, setIsFreezerModalOpen } = model;

    return (<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 text-purple-600">
                        <Barcode className="h-8 w-8" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Empaque Final y Túnel de Congelación</h1>
                        <p className="text-xs text-slate-500 font-medium">Impresión de etiquetas GS1/QR, inocuidad de envasado y monitoreo de congelación ultra-rápida (Blast Freezer)</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setIsNewPackagingModalOpen(true)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                    >
                        <Plus size={14} />
                        Registrar Envasado
                    </button>
                    <button
                        onClick={() => setIsFreezerModalOpen(true)}
                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                    >
                        <Snowflake size={14} />
                        Blast Freezer
                    </button>
                </div>
            </div>);
}
