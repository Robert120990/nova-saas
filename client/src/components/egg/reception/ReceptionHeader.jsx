import {
    Plus,
    Boxes
} from 'lucide-react';


export default function ReceptionHeader({ model }) {
    const { handleOpenNewReception } = model;

    return (<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-600">
                        <Boxes className="h-7 w-7" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Recepción de Huevo en Cáscara y Líquido</h1>
                        <p className="text-xs text-slate-500 font-medium">Registro de ingresos de materia prima, pesaje de tarimas en báscula y control de cadena de frío</p>
                    </div>
                </div>

                <button
                    onClick={handleOpenNewReception}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2"
                >
                    <Plus size={16} />
                    Nueva Recepción
                </button>
            </div>);
}
