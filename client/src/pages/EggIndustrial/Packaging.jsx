import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import {
    Activity,
    Plus,
    Barcode,
    QrCode,
    Calendar,
    User,
    Snowflake,
    Thermometer,
    CheckCircle,
    XCircle,
    Boxes,
    Search,
    Printer,
    Info,
    TrendingDown,
    Lock
} from 'lucide-react';

const EggPackaging = () => {
    const { user } = useAuth();
    const companyId = user?.company_id || 1;

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 'N/A';
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const formatDateTime = (dateStr) => {
        if (!dateStr) return 'N/A';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 'N/A';
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${h}:${m}`;
    };

    // Lists
    const [packagingRecords, setPackagingRecords] = useState([]);
    const [batches, setBatches] = useState([]);
    const [freezerLogs, setFreezerLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Tab state
    const [activeTab, setActiveTab] = useState('records'); // 'records' only
    const [isNewPackagingModalOpen, setIsNewPackagingModalOpen] = useState(false);
    const [isFreezerModalOpen, setIsFreezerModalOpen] = useState(false);

    // Form states
    const [packagingForm, setPackagingForm] = useState({
        batch_id: '',
        units_packaged: '',
        weight_per_unit_lbs: '32.00',
        operator_name: user?.nombre || ''
    });

    const [freezerForm, setFreezerForm] = useState({
        packaging_id: '',
        freezer_location: 'Túnel A - Posición 1',
        core_temperature_c: '-18.5',
        freezing_duration_hours: '4.0',
        status: 'congelando'
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedLabel, setSelectedLabel] = useState(null); // Label modal state

    const fetchData = async () => {
        setLoading(true);
        try {
            const [pkgRes, bRes, fRes] = await Promise.all([
                axios.get('/api/egg-industrial/packaging'),
                axios.get('/api/egg-industrial/batches'),
                axios.get('/api/egg-industrial/blast-freezer')
            ]);
            setPackagingRecords(pkgRes.data);
            setBatches(bRes.data);
            setFreezerLogs(fRes.data);
        } catch (error) {
            console.error('Error fetching packaging data:', error);
            toast.error('Error al cargar datos de envasado.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [companyId]);

    // Handle create packaging record
    const handleCreatePackaging = async (e) => {
        e.preventDefault();

        if (!packagingForm.batch_id) {
            return toast.error('Debe seleccionar un lote de producción.');
        }
        if (!packagingForm.units_packaged || parseInt(packagingForm.units_packaged) <= 0) {
            return toast.error('La cantidad de unidades debe ser mayor a cero.');
        }

        const selectedBatchObj = batches.find(b => b.id === parseInt(packagingForm.batch_id));
        if (selectedBatchObj && selectedBatchObj.status === 'bloqueado_haccp') {
            return toast.error('BLOQUEO DE INOCUIDAD: No se puede envasar un lote bloqueado por HACCP.');
        }

        setIsSubmitting(true);
        try {
            await axios.post('/api/egg-industrial/packaging', {
                batch_id: parseInt(packagingForm.batch_id),
                units_packaged: parseInt(packagingForm.units_packaged),
                weight_per_unit_lbs: parseFloat(packagingForm.weight_per_unit_lbs),
                operator_name: packagingForm.operator_name
            });
            toast.success('Registro de empaque envasado con éxito.');
            setIsNewPackagingModalOpen(false);
            setPackagingForm({
                batch_id: '',
                units_packaged: '',
                weight_per_unit_lbs: '32.00',
                operator_name: user?.nombre || ''
            });
            fetchData();
        } catch (error) {
            console.error('Error saving packaging record:', error);
            toast.error(error.response?.data?.message || 'Error al registrar el empaque.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle freezer entry logging
    const handleCreateFreezerLog = async (e) => {
        e.preventDefault();

        if (!freezerForm.packaging_id) {
            return toast.error('Debe seleccionar una etiqueta de empaque.');
        }

        const parsedTemp = parseFloat(freezerForm.core_temperature_c);
        if (parsedTemp > -12.0) {
            toast.warning('ALERTA FRIGORÍFICA: La temperatura en el núcleo es superior a -12°C. Tiempo de congelado extendido.', { duration: 6000 });
        }

        setIsSubmitting(true);
        try {
            await axios.post('/api/egg-industrial/blast-freezer', {
                packaging_id: parseInt(freezerForm.packaging_id),
                freezer_location: freezerForm.freezer_location,
                core_temperature_c: parsedTemp,
                freezing_duration_hours: parseFloat(freezerForm.freezing_duration_hours),
                status: freezerForm.status
            });
            toast.success('Registro de Blast Freezer guardado.');
            setFreezerForm({
                packaging_id: '',
                freezer_location: 'Túnel A - Posición 1',
                core_temperature_c: '-18.5',
                freezing_duration_hours: '4.0',
                status: 'congelando'
            });
            fetchData();
            setIsFreezerModalOpen(false);
        } catch (error) {
            console.error('Error logging blast freezer entry:', error);
            toast.error('Error al guardar registro en Blast Freezer.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Helper for freezer statuses
    const getFreezerStatusBadge = (status) => {
        switch (status) {
            case 'congelando':
                return 'bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse';
            case 'congelado_ok':
                return 'bg-teal-500/10 text-teal-400 border border-teal-500/20';
            case 'alarma_tiempo':
                return 'bg-rose-500/10 text-rose-500 border border-rose-500/20 animate-bounce';
            default:
                return 'bg-slate-800 text-slate-400';
        }
    };

    // Generate and download a real PDF label for physical printing
    const handlePrintLabel = async (p) => {
        try {
            // Crear instancia de jsPDF (etiqueta industrial de 4x4 pulgadas)
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'in',
                format: [4, 4]
            });

            // Margen y fuentes
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text('NOVA INDUSTRIAL PLANT', 0.2, 0.3);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.text('FDA CERTIFIED #98217A', 2.5, 0.3);

            // Línea divisoria
            doc.setLineWidth(0.01);
            doc.line(0.2, 0.35, 3.8, 0.35);

            // Código de Lote GS1
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.text('CODIGO DE LOTE GS1', 0.2, 0.55);
            doc.setFontSize(11);
            doc.text(p.lot_code, 0.2, 0.75);

            // Línea divisoria
            doc.line(0.2, 0.85, 3.8, 0.85);

            // Datos del Lote
            doc.setFontSize(8);
            doc.text('Producto:', 0.2, 1.05);
            doc.setFont('helvetica', 'bold');
            doc.text(p.product_type.toUpperCase(), 1.2, 1.05);

            doc.setFont('helvetica', 'normal');
            doc.text('Presentacion:', 0.2, 1.25);
            doc.setFont('helvetica', 'bold');
            doc.text(p.presentation.toUpperCase(), 1.2, 1.25);

            doc.setFont('helvetica', 'normal');
            doc.text('Cant. Envasada:', 0.2, 1.45);
            doc.setFont('helvetica', 'bold');
            doc.text(`${p.units_packaged} Unidades`, 1.2, 1.45);

            doc.setFont('helvetica', 'normal');
            doc.text('Peso Total:', 0.2, 1.65);
            doc.setFont('helvetica', 'bold');
            doc.text(`${parseFloat(p.total_batch_weight_lbs).toLocaleString()} Lbs`, 1.2, 1.65);

            doc.setFont('helvetica', 'normal');
            doc.text('F. Empaque:', 0.2, 1.85);
            doc.setFont('helvetica', 'bold');
            doc.text(formatDate(p.created_at), 1.2, 1.85);

            doc.setFont('helvetica', 'normal');
            doc.text('F. Vencimiento:', 0.2, 2.05);
            doc.setFont('helvetica', 'bold');
            doc.text(formatDate(p.expiry_date), 1.2, 2.05);

            // Línea divisoria
            doc.setLineWidth(0.01);
            doc.line(0.2, 2.15, 3.8, 2.15);

            // Código de barras simulado
            doc.setFont('Courier', 'bold');
            doc.setFontSize(10);
            doc.text('|||| | | ||| || ||| || |||', 1.0, 2.35);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.text(`(${p.barcode})`, 1.5, 2.48);

            // Cargar y pintar código QR real
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(p.qr_code_payload)}`;
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.src = qrUrl;
            img.onload = () => {
                doc.addImage(img, 'PNG', 1.4, 2.6, 1.2, 1.2);
                doc.setFontSize(6);
                doc.text('ESCANEAR PARA TRAZABILIDAD 360', 1.1, 3.9);
                doc.save(`etiqueta-${p.lot_code}.pdf`);
                toast.success('Etiqueta PDF generada e iniciada la descarga.');
            };
            img.onerror = () => {
                doc.setFontSize(6);
                doc.text('ERROR AL CARGAR QR DE TRAZABILIDAD', 1.1, 3.5);
                doc.save(`etiqueta-${p.lot_code}.pdf`);
                toast.warning('Etiqueta PDF generada sin código QR dinámico.');
            };
        } catch (error) {
            console.error('Error al generar la etiqueta PDF:', error);
            toast.error('Error al generar la etiqueta imprimible.');
        }
    };

    const filteredPackaging = packagingRecords.filter(p =>
        p.lot_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.product_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.presentation?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/20 text-purple-400">
                        <Barcode className="h-8 w-8" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white uppercase tracking-wider">Empaque Final y Túnel de Congelación</h1>
                        <p className="text-[12px] text-slate-400 font-semibold tracking-tight">Impresión de etiquetas con código de barras GS1/QR, inocuidad de envasado y monitoreo de congelación ultra-rápida (Blast Freezer)</p>
                    </div>
                </div>
                <button
                    onClick={() => setIsNewPackagingModalOpen(true)}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-extrabold transition-all border border-teal-500 flex items-center gap-1.5 shadow-lg"
                >
                    <Plus size={14} />
                    Registrar Envasado
                </button>
                <button
                    onClick={() => setIsFreezerModalOpen(true)}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-extrabold transition-all border border-cyan-500 flex items-center gap-1.5 shadow-lg"
                >
                    <Snowflake size={14} />
                    Blast Freezer
                </button>
            </div>

            {/* HISTORIAL DE LOTES EMPACADOS */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <Boxes className="h-4 w-4 text-indigo-400" />
                            Historial de Unidades Empacadas
                        </h2>
                        <div className="relative w-full md:w-72">
                            <input
                                type="text"
                                placeholder="Buscar por lote, producto..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-4 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                            />
                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                        </div>
                    </div>
                    <div className="h-px bg-slate-800" />

                    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950">
                        {loading ? (
                            <div className="p-8 text-center text-slate-400 text-xs font-bold animate-pulse">
                                Cargando empaques finalizados...
                            </div>
                        ) : filteredPackaging.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 text-xs font-semibold">
                                No se han registrado envasados todavía.
                            </div>
                        ) : (
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-900/50 border-b border-slate-850 text-slate-400 font-extrabold uppercase tracking-wider text-[10px]">
                                        <th className="p-4">Código Lote (Barra)</th>
                                        <th className="p-4">Producto</th>
                                        <th className="p-4">Presentación</th>
                                        <th className="p-4 text-right">Cant. Envasada</th>
                                        <th className="p-4 text-right">Peso Total (Lbs)</th>
                                        <th className="p-4">Vencimiento</th>
                                        <th className="p-4">Operador</th>
                                        <th className="p-4 text-center">Etiquetas</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-850 font-medium text-slate-300">
                                    {filteredPackaging.map(p => (
                                        <tr key={p.id} className="hover:bg-slate-900/40 transition-colors">
                                            <td className="p-4">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-black text-white text-[12px]">{p.lot_code}</span>
                                                    <span className="text-[9px] text-indigo-400 font-semibold tracking-wider flex items-center gap-1">
                                                        <Barcode size={10} />
                                                        {p.barcode}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4 font-bold text-white capitalize">{p.product_type}</td>
                                            <td className="p-4 font-semibold text-slate-400">{p.presentation}</td>
                                            <td className="p-4 text-right text-white font-bold">{p.units_packaged} Uds</td>
                                            <td className="p-4 text-right text-teal-400 font-black">
                                                {parseFloat(p.total_batch_weight_lbs).toLocaleString()} Lbs
                                            </td>
                                            <td className="p-4">
                                                <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                                                    <Calendar size={12} />
                                                    {formatDate(p.expiry_date)}
                                                </span>
                                            </td>
                                            <td className="p-4 text-slate-400">
                                                <span className="flex items-center gap-1 text-[11px]">
                                                    <User size={12} />
                                                    {p.operator_name}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <button
                                                    onClick={() => setSelectedLabel(p)}
                                                    className="px-3 py-1 bg-indigo-600/10 hover:bg-indigo-600/25 border border-indigo-500/20 text-indigo-400 hover:text-indigo-300 rounded-lg text-[10px] font-extrabold transition-all flex items-center gap-1.5 mx-auto"
                                                >
                                                    <QrCode size={11} />
                                                    Etiqueta QR
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

            {isNewPackagingModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto space-y-6">
                    <div>
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Plus className="h-4 w-4 text-purple-400" />
                            Registrar Empaque y Envasado de Producto
                        </h2>
                        <p className="text-[11px] text-slate-400">Genere la numeración de lote comercial e imprima la etiqueta QR de trazabilidad total.</p>
                        <div className="h-px bg-slate-800 mt-4" />
                    </div>

                    <form onSubmit={handleCreatePackaging} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Lote Pasteurizado Aprobado</label>
                            <select
                                value={packagingForm.batch_id}
                                onChange={(e) => setPackagingForm({ ...packagingForm, batch_id: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-indigo-500"
                            >
                                <option value="">Seleccione Lote Pasteurizado...</option>
                                {batches.filter(b => b.status === 'pasteurizado' || b.status === 'aprobado_calidad' || b.status === 'bloqueado_haccp').map(b => (
                                    <option key={b.id} value={b.id} disabled={b.status === 'bloqueado_haccp'}>
                                        {b.batch_uuid.slice(0, 8)}... - {b.product_type} ({b.presentation}) {b.status === 'bloqueado_haccp' ? ' [BLOQUEADO HACCP]' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {packagingForm.batch_id && batches.find(b => b.id === parseInt(packagingForm.batch_id))?.status === 'bloqueado_haccp' && (
                            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 text-rose-500 flex gap-2 font-black text-xs uppercase animate-pulse">
                                <Lock size={16} className="shrink-0" />
                                <span>ERROR CRÍTICO: Este lote tiene bloqueo HACCP activo. El envasado está inhabilitado por normativas de inocuidad.</span>
                            </div>
                        )}

                        {packagingForm.batch_id && (() => {
                            const b = batches.find(x => x.id === parseInt(packagingForm.batch_id));
                            if (b) return (
                                <div className="bg-slate-950 border border-slate-850 rounded-2xl p-4 grid grid-cols-3 gap-3 text-center">
                                    <div>
                                        <span className="text-[8px] font-black text-slate-500 uppercase block">Rendimiento Lote</span>
                                        <span className="text-sm font-bold text-teal-400">{parseFloat(b.yield_liquid_lbs || 0).toLocaleString()} Lbs</span>
                                    </div>
                                    <div>
                                        <span className="text-[8px] font-black text-slate-500 uppercase block">Ya Envasado</span>
                                        <span className="text-sm font-bold text-indigo-400">{parseFloat(b.packaged_weight_lbs || 0).toLocaleString()} Lbs</span>
                                    </div>
                                    <div>
                                        <span className="text-[8px] font-black text-slate-500 uppercase block">Disponible</span>
                                        <span className="text-sm font-bold text-amber-400">{Math.max(0, parseFloat(b.yield_liquid_lbs || 0) - parseFloat(b.packaged_weight_lbs || 0)).toLocaleString()} Lbs</span>
                                    </div>
                                </div>
                            );
                            return null;
                        })()}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Unidades Envasadas</label>
                                <input
                                    type="number"
                                    value={packagingForm.units_packaged}
                                    onChange={(e) => setPackagingForm({ ...packagingForm, units_packaged: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none"
                                    placeholder="Ej: 320"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Peso por Unidad (Lbs)</label>
                                <input
                                    type="number"
                                    value={packagingForm.weight_per_unit_lbs}
                                    onChange={(e) => setPackagingForm({ ...packagingForm, weight_per_unit_lbs: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none"
                                    placeholder="Ej: 32.00"
                                    step="0.01"
                                />
                            </div>
                        </div>

                        {packagingForm.units_packaged && packagingForm.weight_per_unit_lbs && (
                            <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-3 text-center">
                                <span className="text-[9px] font-black text-teal-400 uppercase block">Total Producido</span>
                                <span className="text-base font-black text-teal-300">
                                    {(parseFloat(packagingForm.units_packaged || 0) * parseFloat(packagingForm.weight_per_unit_lbs || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Lbs
                                </span>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                            <button
                                type="button"
                                onClick={() => setIsNewPackagingModalOpen(false)}
                                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-800"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || (packagingForm.batch_id && batches.find(b => b.id === parseInt(packagingForm.batch_id))?.status === 'bloqueado_haccp')}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold transition-all border border-indigo-500 shadow-lg shadow-indigo-600/15 disabled:opacity-40"
                            >
                                {isSubmitting ? 'Guardando...' : 'Confirmar & Generar Lote'}
                            </button>
                        </div>
                    </form>
                </div>
                </div>
            )}

            {/* INTERACTIVE GS1 LABEL PREVIEW MODAL */}
            {selectedLabel && (
                <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                                <QrCode size={16} className="text-purple-400" />
                                Etiqueta de Trazabilidad Industrial
                            </h3>
                            <button
                                onClick={() => setSelectedLabel(null)}
                                className="text-slate-500 hover:text-slate-300 text-xs font-black uppercase"
                            >
                                Cerrar
                            </button>
                        </div>
                        <div className="h-px bg-slate-800" />

                        {/* Printable Area Representation */}
                        <div className="bg-white text-slate-950 p-6 rounded-2xl border-2 border-slate-300 shadow-inner flex flex-col items-center text-center font-mono space-y-4 max-w-sm mx-auto">
                            <div className="w-full flex justify-between items-center border-b-2 border-slate-950 pb-2 text-[9px] font-black tracking-tighter">
                                <span>NOVA INDUSTRIAL PLANT</span>
                                <span>FDA CERTIFIED #98217A</span>
                            </div>

                            <div className="space-y-1">
                                <span className="text-[10px] text-slate-500 uppercase tracking-widest block font-sans">Código de Lote GS1</span>
                                <span className="text-base font-black tracking-tight text-slate-950 uppercase border-2 border-slate-950 px-3 py-1 rounded-md">{selectedLabel.lot_code}</span>
                            </div>

                            <div className="w-full grid grid-cols-2 gap-2 text-left text-[9px] font-semibold border-t-2 border-b-2 border-slate-950 py-3 font-sans">
                                <div>
                                    <span className="text-slate-500 block text-[7px] uppercase font-black">Producto:</span>
                                    <span className="font-extrabold capitalize text-slate-950">{selectedLabel.product_type}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block text-[7px] uppercase font-black">Presentación:</span>
                                    <span className="font-extrabold text-slate-950">{selectedLabel.presentation}</span>
                                </div>
                                <div className="mt-1">
                                    <span className="text-slate-500 block text-[7px] uppercase font-black">Cant. Envasada:</span>
                                    <span className="font-extrabold text-slate-950">{selectedLabel.units_packaged} Unidades</span>
                                </div>
                                <div className="mt-1">
                                    <span className="text-slate-500 block text-[7px] uppercase font-black">Peso Total:</span>
                                    <span className="font-extrabold text-slate-950">{selectedLabel.total_batch_weight_lbs} Lbs</span>
                                </div>
                                <div className="mt-1">
                                    <span className="text-slate-500 block text-[7px] uppercase font-black">F. Empaque:</span>
                                    <span className="font-extrabold text-slate-950">{formatDate(selectedLabel.created_at)}</span>
                                </div>
                                <div className="mt-1">
                                    <span className="text-slate-500 block text-[7px] uppercase font-black">F. Vencimiento:</span>
                                    <span className="font-extrabold text-rose-600">{formatDate(selectedLabel.expiry_date)}</span>
                                </div>
                            </div>

                            {/* Simulated Barcode block */}
                            <div className="py-2 flex flex-col items-center">
                                <div className="h-10 w-44 bg-slate-950 flex items-center justify-between px-2 text-white font-mono text-[9px] tracking-[4px] font-black rounded border border-slate-800 shadow">
                                    |||| | | ||| || ||| || |||
                                </div>
                                <span className="text-[9px] text-slate-700 font-bold font-mono mt-1">({selectedLabel.barcode})</span>
                            </div>

                            {/* Dynamic QR Code from API */}
                            <div className="flex flex-col items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                                <div className="h-28 w-28 bg-white rounded-xl flex items-center justify-center p-1 shadow-md relative overflow-hidden">
                                    <img
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(selectedLabel.qr_code_payload)}`}
                                        alt="QR Trazabilidad"
                                        className="h-full w-full object-contain"
                                    />
                                </div>
                                <span className="text-[7px] text-slate-500 font-black mt-2 tracking-tight uppercase">Escanear para verificar Trazabilidad 360°</span>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => {
                                    handlePrintLabel(selectedLabel);
                                    setSelectedLabel(null);
                                }}
                                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95"
                            >
                                <Printer size={14} />
                                Imprimir Etiqueta (PDF)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isFreezerModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                    {/* Add Blast Freezer Log Form */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl h-fit space-y-6">
                        <div>
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Snowflake className="h-4 w-4 text-cyan-400" />
                                Entrada a Blast Freezer
                            </h2>
                            <div className="h-px bg-slate-800" />
                        </div>

                        <form onSubmit={handleCreateFreezerLog} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Lote Envasado a Congelar</label>
                                <select
                                    value={freezerForm.packaging_id}
                                    onChange={(e) => setFreezerForm({ ...freezerForm, packaging_id: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none"
                                >
                                    <option value="">Seleccione Lote Envasado...</option>
                                    {packagingRecords.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.lot_code} - {p.product_type} ({p.units_packaged} Uds)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Ubicación del Túnel</label>
                                <select
                                    value={freezerForm.freezer_location}
                                    onChange={(e) => setFreezerForm({ ...freezerForm, freezer_location: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none"
                                >
                                    <option value="Túnel A - Posición 1">Túnel Rápido A - Posición 1</option>
                                    <option value="Túnel A - Posición 2">Túnel Rápido A - Posición 2</option>
                                    <option value="Túnel B - Posición 1">Túnel Rápido B - Posición 1</option>
                                    <option value="Túnel B - Posición 2">Túnel Rápido B - Posición 2</option>
                                    <option value="Túnel C (Ultra-frío)">Túnel C - Criogénico</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Temp Núcleo (°C)</label>
                                    <input
                                        type="number"
                                        value={freezerForm.core_temperature_c}
                                        onChange={(e) => setFreezerForm({ ...freezerForm, core_temperature_c: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none"
                                        placeholder="Ej: -18.5"
                                        step="0.1"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Horas en Túnel</label>
                                    <input
                                        type="number"
                                        value={freezerForm.freezing_duration_hours}
                                        onChange={(e) => setFreezerForm({ ...freezerForm, freezing_duration_hours: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none"
                                        placeholder="Ej: 4.0"
                                        step="0.1"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Estatus del Congelado</label>
                                <select
                                    value={freezerForm.status}
                                    onChange={(e) => setFreezerForm({ ...freezerForm, status: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-semibold focus:outline-none"
                                >
                                    <option value="congelando">Congelando (Activo)</option>
                                    <option value="congelado_ok">Congelado Aprobado (-18°C núcleo)</option>
                                    <option value="alarma_tiempo">Alarma de Desviación de Tiempo</option>
                                </select>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-extrabold transition-all border border-teal-500 shadow-lg shadow-teal-600/15"
                            >
                                Guardar Registro Túnel
                            </button>
                        </form>
                    </div>

                    {/* Freezer active logs */}
                    <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <Activity className="h-4 w-4 text-cyan-400" />
                            Bitácora del Blast Freezer (Cadena de Frío Ultra-baja)
                        </h2>
                        <div className="h-px bg-slate-800" />

                        <div className="space-y-3 overflow-y-auto max-h-[500px] pr-1">
                            {freezerLogs.map(log => (
                                <div key={log.id} className="bg-slate-950 border border-slate-850 rounded-2xl p-4 flex flex-col md:flex-row justify-between gap-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black text-white">{log.lot_code}</span>
                                            <span className="text-[10px] text-slate-500 capitalize">{log.product_type}</span>
                                        </div>
                                        <p className="text-[11px] text-slate-400 font-semibold">Ubicación física: <b>{log.freezer_location}</b></p>
                                        <div className="flex gap-2.5 text-[9px] text-slate-500 font-extrabold uppercase">
                                            <span>Entrado: <b>{formatDateTime(log.created_at)}</b></span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex md:flex-col justify-between items-end text-right">
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${getFreezerStatusBadge(log.status)}`}>
                                            {log.status === 'congelado_ok' ? 'Congelado Aprobado' : log.status}
                                        </span>
                                        <div className="flex gap-3 text-xs mt-2">
                                            <div className="text-center bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-xl">
                                                <span className="text-[8px] font-black block text-slate-500 uppercase">Núcleo</span>
                                                <span className="text-[11px] font-bold text-cyan-400">{log.core_temperature_c}°C</span>
                                            </div>
                                            <div className="text-center bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-xl">
                                                <span className="text-[8px] font-black block text-slate-500 uppercase">Horas</span>
                                                <span className="text-[11px] font-bold text-white">{log.freezing_duration_hours}h</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                </div>
            )}
        </div>
    );
};

export default EggPackaging;
