import { useState } from 'react';
import { Maximize2, Minimize2, ImageOff } from 'lucide-react';

export default function AnnotatedScreenshot({ image, title, annotations = [] }) {
    const [activePin, setActivePin] = useState(null);
    const [zoomed, setZoomed] = useState(false);
    const [imgError, setImgError] = useState(false);

    const pins = Array.isArray(annotations) ? annotations : [];
    const src = image ? `/tutorials/${image}` : null;

    const renderCanvas = (isZoom) => (
        <div className="relative w-full aspect-[1480/880] bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 shadow-inner select-none">
            {!src || imgError ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2 p-6 text-center">
                    <ImageOff size={28} />
                    <span className="text-xs font-semibold">Captura no disponible para {title}</span>
                </div>
            ) : (
                <img
                    src={src}
                    alt={title}
                    onError={() => setImgError(true)}
                    className="w-full h-full object-fill block"
                />
            )}

            {pins.map((ann) => {
                const isSelected = activePin === ann.n;
                return (
                    <div
                        key={ann.n}
                        onMouseEnter={() => setActivePin(ann.n)}
                        onMouseLeave={() => setActivePin(null)}
                        onClick={() => setActivePin(isSelected ? null : ann.n)}
                        style={{
                            left: `${ann.x}%`,
                            top: `${ann.y}%`,
                            width: `${ann.w}%`,
                            height: `${ann.h}%`
                        }}
                        title={ann.label}
                        className={`absolute rounded-lg border-2 transition-all cursor-pointer ${
                            isSelected
                                ? 'border-amber-500 bg-amber-400/20 ring-4 ring-amber-400/30 z-20'
                                : 'border-rose-500/90 bg-rose-500/10 hover:bg-rose-500/20 z-10'
                        }`}
                    >
                        <span
                            className={`absolute -top-2.5 -left-2.5 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black text-white border-2 border-white shadow-md ${
                                isSelected ? 'bg-amber-600 scale-110' : 'bg-rose-600'
                            }`}
                        >
                            {ann.n}
                        </span>
                    </div>
                );
            })}

            {!isZoom && src && !imgError && (
                <button
                    type="button"
                    onClick={() => setZoomed(true)}
                    className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-white text-[11px] font-bold backdrop-blur-sm shadow cursor-pointer"
                >
                    <Maximize2 size={12} />
                    <span>Ampliar captura</span>
                </button>
            )}
        </div>
    );

    return (
        <div className="space-y-3">
            {renderCanvas(false)}

            {pins.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {pins.map((ann) => {
                        const isSelected = activePin === ann.n;
                        return (
                            <button
                                key={ann.n}
                                type="button"
                                onMouseEnter={() => setActivePin(ann.n)}
                                onMouseLeave={() => setActivePin(null)}
                                onClick={() => setActivePin(isSelected ? null : ann.n)}
                                className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                    isSelected
                                        ? 'bg-amber-50 border-amber-300 text-amber-950 shadow-2xs'
                                        : 'bg-slate-50 border-slate-200/80 text-slate-700 hover:bg-indigo-50/50 hover:border-indigo-200'
                                }`}
                            >
                                <span
                                    className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[11px] font-black text-white mt-0.5 ${
                                        isSelected ? 'bg-amber-600' : 'bg-rose-600'
                                    }`}
                                >
                                    {ann.n}
                                </span>
                                <span className="text-xs font-medium leading-snug">{ann.label}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {zoomed && (
                <div
                    className="fixed inset-0 z-[120] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
                    onClick={() => setZoomed(false)}
                >
                    <div className="w-full max-w-6xl space-y-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between text-white px-1">
                            <span className="text-xs sm:text-sm font-bold truncate">{title}</span>
                            <button
                                type="button"
                                onClick={() => setZoomed(false)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold cursor-pointer"
                            >
                                <Minimize2 size={13} />
                                <span>Cerrar vista amplia</span>
                            </button>
                        </div>
                        {renderCanvas(true)}
                    </div>
                </div>
            )}
        </div>
    );
}
