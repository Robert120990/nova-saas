import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { BarChart3, Search, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Money from '../components/ui/Money';

const formatNum = (val, decimals = 2) => {
    const n = parseFloat(val) || 0;
    return decimals === 5 ? n.toFixed(5) : n.toFixed(2);
};

const ReporteVentasCombustible = () => {
    const { user } = useAuth();
    const today = new Date().toISOString().split('T')[0];
    const [fecha, setFecha] = useState(today);
    const [turno, setTurno] = useState('0');
    const [consulted, setConsulted] = useState(false);

    const { data, isLoading, isFetching } = useQuery({
        queryKey: ['gas-reporte-ventas', fecha, turno, user?.branch_id],
        queryFn: async () => {
            const res = await axios.get('/api/gas-station/reporte-ventas', {
                params: { fecha, turno, branch_id: user?.branch_id }
            });
            return res.data;
        },
        enabled: consulted,
    });

    const handleConsult = (e) => {
        e.preventDefault();
        if (!fecha) return;
        setConsulted(true);
    };

    const rows = data?.data || [];
    const totales = data?.totales || null;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <BarChart3 size={20} className="text-indigo-600" />
                        Lecturas - Ventas
                    </h2>
                    <p className="text-slate-500 text-[11px] font-medium">Gasolinera — Reporte combustibles</p>
                </div>
            </div>

            <form onSubmit={handleConsult} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Fecha</label>
                        <input
                            type="date"
                            value={fecha}
                            onChange={(e) => setFecha(e.target.value)}
                            className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-[13px] font-medium shadow-sm"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Turno</label>
                        <input
                            type="number"
                            min="0"
                            value={turno}
                            onChange={(e) => setTurno(e.target.value)}
                            placeholder="0 = Todos"
                            className="w-full sm:w-24 px-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-[13px] font-medium shadow-sm"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isFetching}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl transition-colors text-xs font-bold flex items-center gap-1.5 shadow-sm"
                    >
                        {isFetching ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <Search size={14} />
                        )}
                        Consultar
                    </button>
                </div>
            </form>

            {consulted && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="text-left px-3 py-2 text-[11px] font-bold text-slate-500 uppercase">Código</th>
                                    <th className="text-left px-3 py-2 text-[11px] font-bold text-slate-500 uppercase">Descripción</th>
                                    <th className="text-right px-3 py-2 text-[11px] font-bold text-slate-500 uppercase">Precio</th>
                                    <th className="text-right px-3 py-2 text-[11px] font-bold text-slate-500 uppercase">Lectura (gal)</th>
                                    <th className="text-right px-3 py-2 text-[11px] font-bold text-slate-500 uppercase">Lectura ($)</th>
                                    <th className="text-right px-3 py-2 text-[11px] font-bold text-slate-500 uppercase">Venta (gal)</th>
                                    <th className="text-right px-3 py-2 text-[11px] font-bold text-slate-500 uppercase">Venta ($)</th>
                                    <th className="text-right px-3 py-2 text-[11px] font-bold text-slate-500 uppercase">Diferencia (gal)</th>
                                    <th className="text-right px-3 py-2 text-[11px] font-bold text-slate-500 uppercase">Diferencia ($)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={9} className="text-center py-8">
                                            <Loader2 size={20} className="animate-spin text-indigo-500 mx-auto" />
                                        </td>
                                    </tr>
                                ) : rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="text-center py-8 text-sm text-slate-400 font-medium">
                                            No se encontraron registros para la fecha y turno seleccionados
                                        </td>
                                    </tr>
                                ) : (
                                    rows.map((row, i) => (
                                        <tr key={i} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                                            <td className="px-3 py-1.5 text-xs font-mono font-bold text-slate-900">{row.codigo_producto}</td>
                                            <td className="px-3 py-1.5 text-xs text-slate-600">{row.descripcion_producto}</td>
                                            <td className="px-3 py-1.5 text-xs font-mono font-bold text-right text-slate-900"><Money value={row.precio} /></td>
                                            <td className="px-3 py-1.5 text-xs font-mono text-right text-slate-700">{formatNum(row.lectura_galones, 2)}</td>
                                            <td className="px-3 py-1.5 text-xs font-mono text-right text-slate-700"><Money value={row.lectura_monto} /></td>
                                            <td className="px-3 py-1.5 text-xs font-mono text-right text-indigo-600 font-bold">{formatNum(row.venta_galones, 5)}</td>
                                            <td className="px-3 py-1.5 text-xs font-mono text-right text-slate-900 font-bold"><Money value={row.venta_monto} /></td>
                                            <td className="px-3 py-1.5 text-xs font-mono text-right text-slate-700">{formatNum(row.diferencia_galones, 2)}</td>
                                            <td className="px-3 py-1.5 text-xs font-mono text-right text-slate-700"><Money value={row.diferencia_monto} /></td>
                                        </tr>
                                    ))
                                )}
                                {totales && rows.length > 0 && (
                                    <tr className="bg-indigo-50 border-t-2 border-indigo-200 font-bold">
                                        <td colSpan={2} className="px-3 py-2 text-xs font-bold text-indigo-800 uppercase">Totales</td>
                                        <td className="px-3 py-2 text-xs font-mono text-right text-indigo-800">—</td>
                                        <td className="px-3 py-2 text-xs font-mono text-right text-indigo-800">{formatNum(totales.lectura_galones, 2)}</td>
                                        <td className="px-3 py-2 text-xs font-mono text-right text-indigo-800"><Money value={totales.lectura_monto} /></td>
                                        <td className="px-3 py-2 text-xs font-mono text-right text-indigo-800">{formatNum(totales.venta_galones, 5)}</td>
                                        <td className="px-3 py-2 text-xs font-mono text-right text-indigo-800"><Money value={totales.venta_monto} /></td>
                                        <td className="px-3 py-2 text-xs font-mono text-right text-indigo-800">{formatNum(totales.diferencia_galones, 2)}</td>
                                        <td className="px-3 py-2 text-xs font-mono text-right text-indigo-800"><Money value={totales.diferencia_monto} /></td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReporteVentasCombustible;
