const StatCard = ({ label, value, icon: Icon, color, bg, subtitle, breakdown }) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start justify-between transition-all hover:shadow-md h-full">
        <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">{label}</p>
            <h4 className="text-2xl font-black text-slate-900 tracking-tight">{value}</h4>
            {subtitle && <p className="text-[10px] text-slate-400 font-bold mt-1">{subtitle}</p>}
            {breakdown?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                    {breakdown.map((b, i) => (
                        <div key={i} className="flex items-center justify-between gap-2">
                            <span className="text-[9px] font-bold text-slate-400 uppercase truncate">{b.name}</span>
                            <span className="text-[10px] font-black text-slate-600">{b.value}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
        <div className={`p-3 rounded-2xl ${bg} ${color} shadow-sm shrink-0`}>
            <Icon size={20} />
        </div>
    </div>
);

export default StatCard;
