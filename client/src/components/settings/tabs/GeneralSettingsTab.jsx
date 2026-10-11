import PropTypes from 'prop-types';
import { Save, Upload, Trash2, Image as ImageIcon, Type } from 'lucide-react';

const GeneralSettingsTab = ({
    systemName,
    setSystemName,
    previewUrl,
    removeLogo,
    handleLogoChange,
    isCompressing,
    onSubmit,
    isPending
}) => {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <form onSubmit={onSubmit}>
                <div className="p-8 space-y-8">
                    {/* Nombre del Sistema */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-slate-900 font-bold border-b border-slate-100 pb-2">
                            <Type size={18} className="text-indigo-600" />
                            <span>Nombre de la Aplicación</span>
                        </div>
                        <div className="max-w-md">
                            <input 
                                type="text" 
                                value={systemName}
                                onChange={(e) => setSystemName(e.target.value)}
                                placeholder="Ej: SAAS SV"
                                className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 outline-none"
                                required
                            />
                            <p className="text-xs text-slate-400 mt-2">Este nombre se mostrará en la barra superior y pestaña del navegador.</p>
                        </div>
                    </div>

                    {/* Logotipo */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-slate-900 font-bold border-b border-slate-100 pb-2">
                            <ImageIcon size={18} className="text-indigo-600" />
                            <span>Logotipo del Sistema</span>
                        </div>
                        
                        <div className="flex items-start gap-8">
                            <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden relative group">
                                {previewUrl ? (
                                    <img src={previewUrl} alt="Logo" className="w-full h-full object-contain p-2" />
                                ) : (
                                    <ImageIcon size={32} className="text-slate-300 group-hover:text-indigo-400" />
                                )}
                            </div>
                            
                            <div className="flex-1 space-y-3">
                                <p className="text-sm text-slate-500 font-medium">Sube el logotipo de tu empresa. El tamaño recomendado es 200x200px o superior.</p>
                                <div className="flex flex-wrap gap-2">
                                    <label className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-slate-900/10 ${isCompressing ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}>
                                        <Upload size={14} className={isCompressing ? 'animate-bounce' : ''} />
                                        <span>{isCompressing ? 'Procesando...' : 'Subir Foto'}</span>
                                        <input type="file" className="hidden" accept="image/*" onChange={handleLogoChange} disabled={isCompressing} />
                                    </label>
                                    {previewUrl && (
                                        <button 
                                            type="button" 
                                            onClick={removeLogo}
                                            className="bg-rose-50 text-rose-600 hover:bg-rose-100 px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 active:scale-95"
                                        >
                                            <Trash2 size={14} />
                                            <span>Eliminar</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 px-8 py-5 flex justify-end gap-3 border-t border-slate-100">
                    <button 
                        type="submit" 
                        disabled={isPending}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50"
                    >
                        <Save size={18} />
                        {isPending ? 'Guardando...' : 'Guardar Configuración'}
                    </button>
                </div>
            </form>
        </div>
    );
};

GeneralSettingsTab.propTypes = {
    systemName: PropTypes.string.isRequired,
    setSystemName: PropTypes.func.isRequired,
    previewUrl: PropTypes.string,
    removeLogo: PropTypes.func.isRequired,
    handleLogoChange: PropTypes.func.isRequired,
    isCompressing: PropTypes.bool.isRequired,
    onSubmit: PropTypes.func.isRequired,
    isPending: PropTypes.bool.isRequired
};

export default GeneralSettingsTab;
