import {
    Truck,
    Navigation,
    Plus
} from 'lucide-react';


export default function EggDispatchHeader({ model }) {
    const { setOrderModalOpen, setEditingOrder, handleOpenCreateRoute } = model;

    return (<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 md:p-6 rounded-3xl text-white shadow-xl">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-500/20 backdrop-blur-md rounded-2xl border border-indigo-400/30 text-indigo-300">
                            <Truck className="w-6 h-6" />
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
                                Huevo Industrial - Logística de Entregas
                            </span>
                            <h1 className="text-xl md:text-2xl font-black tracking-tight">
                                Espacio de Despachos y Rutas
                            </h1>
                        </div>
                    </div>
                    <p className="text-xs text-slate-300 mt-2 max-w-2xl">
                        Planificación de rutas inteligentes según capacidad de camiones, control e historial de mantenimiento de flota, y asignación a motoristas con escaneo QR de DTE y georreferenciación de clientes.
                    </p>
                </div>

                {/* Acciones Rápidas de Cabecera */}
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => {
                            setEditingOrder(null);
                            setOrderModalOpen(true);
                        }}
                        className="flex items-center gap-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-xl shadow-lg transition"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Nuevo Pedido</span>
                    </button>

                    <button
                        onClick={() => handleOpenCreateRoute()}
                        className="flex items-center gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl shadow-lg transition"
                    >
                        <Navigation className="w-4 h-4" />
                        <span>Planificar Ruta</span>
                    </button>
                </div>
            </div>);
}
