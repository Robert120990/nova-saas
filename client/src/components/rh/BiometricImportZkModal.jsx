import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import {
    FolderArchive, FileSpreadsheet, CheckCircle2, AlertCircle,
    Loader2, RefreshCw, X, FolderOpen, UserCheck
} from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';

const BiometricImportZkModal = ({ open, onClose, onSuccess }) => {
    const queryClient = useQueryClient();
    const [selectedFolder, setSelectedFolder] = useState('');
    const [customPath, setCustomPath] = useState('');
    const [isCustom, setIsCustom] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [mappings, setMappings] = useState({});
    const [updateBioCodes, setUpdateBioCodes] = useState(true);
    const [isExporting, setIsExporting] = useState(false);

    // 1. Obtener lista de subcarpetas disponibles en el servidor
    const { data: foldersData, isLoading: isFoldersLoading } = useQuery({
        queryKey: ['rh-biometric-zk-folders'],
        queryFn: async () => {
            const res = await axios.get('/api/rh/biometric/zk-import/folders');
            return res.data || { folders: [] };
        },
        enabled: open
    });

    const folders = foldersData?.folders || [];

    useEffect(() => {
        if (open && folders.length > 0 && !selectedFolder && !customPath) {
            setSelectedFolder(folders[0].path);
        }
    }, [open, folders, selectedFolder, customPath]);

    // Reset al cerrar
    useEffect(() => {
        if (!open) {
            setPreviewData(null);
            setMappings({});
            setIsExporting(false);
        }
    }, [open]);

    // 2. Previsualizar carpeta seleccionada
    const previewMutation = useMutation({
        mutationFn: async (targetPath) => {
            const res = await axios.post('/api/rh/biometric/zk-import/preview', { folderPath: targetPath });
            return res.data;
        },
        onSuccess: (data) => {
            setPreviewData(data);
            const initialMap = {};
            (data.employees || []).forEach(emp => {
                if (emp.suggestedEmpId) initialMap[emp.acNo] = emp.suggestedEmpId;
            });
            setMappings(initialMap);
            toast.success(`Se encontraron ${data.totalFiles} archivos en la quincena.`);
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al analizar la carpeta.');
        }
    });

    // 3. Importar a la Base de Datos
    const importMutation = useMutation({
        mutationFn: async () => {
            const activePath = isCustom ? customPath : selectedFolder;
            const res = await axios.post('/api/rh/biometric/zk-import/import', {
                folderPath: activePath,
                mappings,
                updateBioCodes
            });
            return res.data;
        },
        onSuccess: (data) => {
            toast.success(`Importación completada: ${data.totalPunchesInserted} marcaciones y ${data.totalOvertimeRecords} horas extra procesadas.`);
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-cortes-summary'] });
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-cortes-daily-overtime'] });
            queryClient.invalidateQueries({ queryKey: ['rh-biometric-attendance-report'] });
            if (onSuccess) onSuccess();
            onClose();
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error durante la importación');
        }
    });

    const handleAnalyze = () => {
        const target = isCustom ? customPath.trim() : selectedFolder;
        if (!target) {
            toast.error('Seleccione o ingrese una ruta de carpeta.');
            return;
        }
        previewMutation.mutate(target);
    };

    const handleExportConsolidatedExcel = async () => {
        if (!previewData?.dateRange?.startDate || !previewData?.dateRange?.endDate) {
            toast.error('Primero analice la carpeta para detectar el rango de fechas.');
            return;
        }
        try {
            setIsExporting(true);
            const res = await axios.get('/api/rh/biometric/zk-import/export-excel', {
                params: {
                    startDate: previewData.dateRange.startDate,
                    endDate: previewData.dateRange.endDate
                },
                responseType: 'blob'
            });
            const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Resumen_Consolidado_${previewData.folderName || 'Quincena'}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            toast.success('Excel consolidado generado con éxito.');
        } catch (e) {
            console.error('Error al exportar Excel:', e);
            toast.error('Error al generar el archivo Excel.');
        } finally {
            setIsExporting(false);
        }
    };

    if (!open) return null;

    const employees = previewData?.employees || [];
    const dbEmployees = previewData?.dbEmployees || [];
    const dateRange = previewData?.dateRange || { startDate: '', endDate: '' };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
                {/* Cabecera */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/40">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-sm">
                            <FolderArchive className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-800">Cargar Archivos Biométricos ZKTeco (.xls)</h3>
                            <p className="text-xs text-slate-500">Valida los archivos por empleado, importa marcaciones y genera el Excel consolidado.</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Contenido */}
                <div className="p-6 overflow-y-auto space-y-5 flex-1">
                    {/* Selector de Carpeta */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <FolderOpen className="w-4 h-4 text-indigo-600" />
                                <span>Carpeta de la Quincena</span>
                            </label>
                            <button type="button" onClick={() => setIsCustom(!isCustom)} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline">
                                {isCustom ? 'Seleccionar de lista detectada' : 'Escribir ruta manual'}
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            {isCustom ? (
                                <input
                                    type="text"
                                    value={customPath}
                                    onChange={(e) => setCustomPath(e.target.value)}
                                    placeholder="Ej: C:\Users\rauls\Downloads\HORAS 25.06.2026\2° septiembre"
                                    className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                                />
                            ) : (
                                <select
                                    value={selectedFolder}
                                    onChange={(e) => setSelectedFolder(e.target.value)}
                                    disabled={isFoldersLoading}
                                    className="flex-1 px-3 py-2 text-xs font-medium border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    {folders.map(f => (
                                        <option key={f.path} value={f.path}>
                                            {f.name} ({f.fileCount} archivos de empleados)
                                        </option>
                                    ))}
                                    {folders.length === 0 && (
                                        <option value="">No se encontraron carpetas en la ruta predeterminada</option>
                                    )}
                                </select>
                            )}

                            <button
                                type="button"
                                onClick={handleAnalyze}
                                disabled={previewMutation.isPending}
                                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm disabled:opacity-50"
                            >
                                {previewMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                <span>Analizar</span>
                            </button>
                        </div>
                    </div>

                    {/* Resultados del análisis */}
                    {previewData && (
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-xl text-xs">
                                <div className="flex items-center gap-4">
                                    <div>
                                        <span className="text-slate-500 font-medium">Quincena: </span>
                                        <span className="font-bold text-indigo-900">{previewData.folderName}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 font-medium">Rango: </span>
                                        <span className="font-bold text-slate-800">
                                            {dateRange.startDate ? formatDate(dateRange.startDate) : '---'} al {dateRange.endDate ? formatDate(dateRange.endDate) : '---'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 font-medium">Archivos: </span>
                                        <span className="font-bold text-slate-800">{previewData.totalFiles}</span>
                                    </div>
                                </div>

                                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={updateBioCodes}
                                        onChange={(e) => setUpdateBioCodes(e.target.checked)}
                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span>Vincular código biométrico en ficha</span>
                                </label>
                            </div>

                            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                <div className="max-h-72 overflow-y-auto">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-100/80 text-slate-600 uppercase font-bold text-[10px] sticky top-0 z-10 border-b border-slate-200">
                                            <tr>
                                                <th className="px-3 py-2 w-14 text-center">ID Bio</th>
                                                <th className="px-3 py-2">Archivo / Nombre en Lector</th>
                                                <th className="px-3 py-2">Empleado en NovaSaaS</th>
                                                <th className="px-2 py-2 text-center w-16">Días</th>
                                                <th className="px-2 py-2 text-center w-20">Marcaciones</th>
                                                <th className="px-2 py-2 text-center w-20">H. Extra</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {employees.map((emp) => {
                                                const currentEmpId = mappings[emp.acNo] || '';
                                                const isMatched = !!currentEmpId;
                                                return (
                                                    <tr key={emp.acNo} className="hover:bg-slate-50/80">
                                                        <td className="px-3 py-2 text-center font-bold text-indigo-700 bg-indigo-50/30">
                                                            {emp.acNo}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <div className="font-bold text-slate-800">{emp.fileName.replace(/\.xls(\.xls)?$/i, '')}</div>
                                                            {emp.nameInFile && <div className="text-[10px] text-slate-400">Lector: {emp.nameInFile}</div>}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <div className="flex items-center gap-1.5">
                                                                <select
                                                                    value={currentEmpId}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value ? parseInt(e.target.value, 10) : '';
                                                                        setMappings(prev => ({ ...prev, [emp.acNo]: val }));
                                                                    }}
                                                                    className={`w-full px-2 py-1.5 text-xs rounded-lg border focus:ring-1 focus:ring-indigo-500 ${
                                                                        isMatched ? 'border-emerald-300 bg-emerald-50/20 text-slate-800' : 'border-amber-300 bg-amber-50/30 text-amber-900 font-medium'
                                                                    }`}
                                                                >
                                                                    <option value="">-- No vincular este archivo --</option>
                                                                    {dbEmployees.map(de => (
                                                                        <option key={de.id} value={de.id}>
                                                                            {de.nombre_completo} {de.codigo_biometrico ? `(Bio: ${de.codigo_biometrico})` : ''}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                                {isMatched ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-2 text-center font-medium text-slate-700">{emp.daysCount}</td>
                                                        <td className="px-2 py-2 text-center font-bold text-slate-800">{emp.punchesCount}</td>
                                                        <td className="px-2 py-2 text-center font-bold text-indigo-700">{emp.totalOtHours > 0 ? `${emp.totalOtHours} h` : '-'}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Pie de acciones */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
                    <button type="button" onClick={onClose} className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-all">
                        Cerrar
                    </button>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        {previewData && (
                            <button
                                type="button"
                                onClick={handleExportConsolidatedExcel}
                                disabled={isExporting}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-xl transition-all shadow-sm disabled:opacity-50"
                                title="Descargar archivo Excel con formato oficial de ANDELSA"
                            >
                                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                                <span>Descargar Excel Consolidado</span>
                            </button>
                        )}
                        {previewData && (
                            <button
                                type="button"
                                onClick={() => importMutation.mutate()}
                                disabled={importMutation.isPending}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm shadow-indigo-200 disabled:opacity-50"
                            >
                                {importMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                                <span>Importar Marcaciones al Sistema</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BiometricImportZkModal;
