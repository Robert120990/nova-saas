import { 
    ShieldCheck, AlertTriangle, AlertOctagon, 
    Link2, ShoppingBag, CheckCircle2
} from 'lucide-react';

const AuditSummaryCards = ({ resumen = {} }) => {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Total Auditadas */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Auditadas</span>
                    <ShieldCheck size={16} className="text-slate-600" />
                </div>
                <div className="mt-2">
                    <div className="text-xl font-black text-slate-900">{resumen.total_ventas || 0}</div>
                    <div className="text-[11px] font-medium text-slate-500">
                        {resumen.ventas_emitidas || 0} emitidas / {resumen.ventas_invalidadas || 0} inval.
                    </div>
                </div>
            </div>

            {/* Aprobadas MH */}
            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3.5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Sello MH</span>
                    <CheckCircle2 size={16} className="text-emerald-600" />
                </div>
                <div className="mt-2">
                    <div className="text-xl font-black text-emerald-800">
                        {(resumen.ventas_emitidas || 0) - (resumen.ventas_sin_sello_fantasma || 0)}
                    </div>
                    <div className="text-[11px] font-medium text-emerald-600">Reales en Hacienda</div>
                </div>
            </div>

            {/* Fantasmas Locales */}
            <div className={`rounded-2xl p-3.5 flex flex-col justify-between border ${
                (resumen.ventas_sin_sello_fantasma || 0) > 0 
                    ? 'bg-rose-50/80 border-rose-200/90 text-rose-900' 
                    : 'bg-slate-50 border-slate-200/80 text-slate-600'
            }`}>
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Sin Sello MH</span>
                    <AlertOctagon size={16} className={resumen.ventas_sin_sello_fantasma > 0 ? "text-rose-600" : "text-slate-400"} />
                </div>
                <div className="mt-2">
                    <div className="text-xl font-black">{resumen.ventas_sin_sello_fantasma || 0}</div>
                    <div className="text-[11px] font-medium opacity-80">Locales no timbradas</div>
                </div>
            </div>

            {/* Duplicidad Sospechosa */}
            <div className={`rounded-2xl p-3.5 flex flex-col justify-between border ${
                (resumen.duplicados_sospechosos_hacienda || 0) > 0 
                    ? 'bg-amber-50/80 border-amber-200/90 text-amber-900' 
                    : 'bg-slate-50 border-slate-200/80 text-slate-600'
            }`}>
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Duplicadas MH</span>
                    <AlertTriangle size={16} className={resumen.duplicados_sospechosos_hacienda > 0 ? "text-amber-600" : "text-slate-400"} />
                </div>
                <div className="mt-2">
                    <div className="text-xl font-black">{resumen.duplicados_sospechosos_hacienda || 0}</div>
                    <div className="text-[11px] font-medium opacity-80">Doble sello MH activo</div>
                </div>
            </div>

            {/* Sellos Desincronizados */}
            <div className={`rounded-2xl p-3.5 flex flex-col justify-between border ${
                (resumen.sellos_desincronizados || 0) > 0 
                    ? 'bg-sky-50/80 border-sky-200/90 text-sky-900' 
                    : 'bg-slate-50 border-slate-200/80 text-slate-600'
            }`}>
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Sellos Pendientes</span>
                    <Link2 size={16} className={resumen.sellos_desincronizados > 0 ? "text-sky-600" : "text-slate-400"} />
                </div>
                <div className="mt-2">
                    <div className="text-xl font-black">{resumen.sellos_desincronizados || 0}</div>
                    <div className="text-[11px] font-medium opacity-80">Existentes en DTEs</div>
                </div>
            </div>

            {/* Pedidos Auto vs POS */}
            <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-3.5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Pedidos Auto</span>
                    <ShoppingBag size={16} className="text-indigo-600" />
                </div>
                <div className="mt-2">
                    <div className="text-xl font-black text-indigo-900">{resumen.ventas_automaticas_pedidos || 0}</div>
                    <div className="text-[11px] font-medium text-indigo-600">
                        {resumen.ventas_automaticas_invalidadas || 0} inv / {resumen.ventas_automaticas_activas || 0} act
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuditSummaryCards;
