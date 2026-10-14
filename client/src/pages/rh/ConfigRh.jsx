import { useState } from 'react';
import { Settings2, Landmark } from 'lucide-react';
import { RhGeneralConfigTab, RhBankFormatsConfigTab } from '../../components/rh/config';

const ConfigRh = () => {
    const [activeTab, setActiveTab] = useState('general'); // 'general' | 'formatos_bancarios'

    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Cabecera */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">Configuración RH</h2>
                    <p className="text-slate-500 text-[11px] font-medium">
                        Responsable, notario, firma, sello y formatos de dispersión bancaria
                    </p>
                </div>

                {/* Tabs de navegación */}
                <div className="flex bg-slate-200/80 p-1 rounded-xl shrink-0">
                    <button
                        type="button"
                        onClick={() => setActiveTab('general')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                            activeTab === 'general'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Settings2 size={15} />
                        <span>General</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('formatos_bancarios')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                            activeTab === 'formatos_bancarios'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Landmark size={15} />
                        <span>Formatos Bancarios</span>
                    </button>
                </div>
            </div>

            {/* Contenido de la pestaña activa */}
            {activeTab === 'general' ? (
                <RhGeneralConfigTab />
            ) : (
                <RhBankFormatsConfigTab />
            )}
        </div>
    );
};

export default ConfigRh;
