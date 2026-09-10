import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
    Ticket,
    Plus,
    Search,
    Loader2,
    Eye,
    Barcode,
    Printer,
    FileSpreadsheet,
    Trash2,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    CheckCheck,
    RotateCcw,
    Building2
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import Money, { MoneyInput } from '../components/ui/Money';
import Pagination from '../components/ui/Pagination';
import Modal from '../components/ui/Modal';
import { getTodayString, getFirstDayOfMonth } from '../utils/dateUtils';

const today = () => getTodayString();
const firstDayOfMonth = () => getFirstDayOfMonth();

const GasCouponLiquidation = () => {
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const { user } = useAuth();

    // Filtros de listado principal
    const [listSearch, setListSearch] = useState('');
    const [listPage, setListPage] = useState(1);
    const [listBranchId, setListBranchId] = useState(user?.branch_id || '');
    const [listStartDate, setListStartDate] = useState(firstDayOfMonth());
    const [listEndDate, setListEndDate] = useState(today());
    const [listEstado, setListEstado] = useState('');

    // Modales
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedLiqId, setSelectedLiqId] = useState(null);

    // Estados del formulario de creación de liquidación
    const [formBranchId, setFormBranchId] = useState(user?.branch_id || '');
    const [formStartDate, setFormStartDate] = useState(today());
    const [formEndDate, setFormEndDate] = useState(today());
    const [formDistribuidoraId, setFormDistribuidoraId] = useState('');
    const [formFechaLiq, setFormFechaLiq] = useState(today());
    const [formResponsable, setFormResponsable] = useState(user?.name || '');
    const [formComentario, setFormComentario] = useState('');

    // Cupones en proceso de conciliación
    const [cuponesList, setCuponesList] = useState([]);
    const [isLoadingCupones, setIsLoadingCupones] = useState(false);
    const [cuponFilterTab, setCuponFilterTab] = useState('todos'); // 'todos' | 'conciliados' | 'faltantes' | 'sobrantes'

    // Escaneo rápido por código de barras / N° cupón
    const [scanCode, setScanCode] = useState('');
    const scanInputRef = useRef(null);

    // Modal para agregar sobrante físico manual
    const [showSobranteModal, setShowSobranteModal] = useState(false);
    const [sobranteCupon, setSobranteCupon] = useState('');
    const [sobranteDistribuidoraId, setSobranteDistribuidoraId] = useState('');
    const [sobranteMonto, setSobranteMonto] = useState('');
    const [sobranteProducto, setSobranteProducto] = useState('');
    const [sobranteNotas, setSobranteNotas] = useState('');

    // Consultas maestras (Sucursales y Distribuidores)
    const { data: branches = [] } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => (await axios.get('/api/branches')).data
    });

    const { data: distributors = [] } = useQuery({
        queryKey: ['gas-distributors'],
        queryFn: async () => (await axios.get('/api/gas-station/distributors')).data
    });

    // Listado de liquidaciones paginadas
    const { data: liquidationsData, isLoading: listLoading } = useQuery({
        queryKey: ['gas-coupon-liquidations', listPage, listSearch, listBranchId, listStartDate, listEndDate, listEstado],
        queryFn: async () => (await axios.get('/api/gas-station/coupon-liquidations', {
            params: {
                page: listPage,
                limit: 12,
                search: listSearch || undefined,
                branch_id: listBranchId || undefined,
                startDate: listStartDate || undefined,
                endDate: listEndDate || undefined,
                estado: listEstado || undefined
            }
        })).data
    });

    const liquidaciones = liquidationsData?.data || [];
    const totalLiquidaciones = liquidationsData?.total || 0;
    const totalPages = liquidationsData?.totalPages || 0;
    const summary = liquidationsData?.summary || {};

    // Detalle de liquidación seleccionada
    const { data: selectedLiquidation, isLoading: detailLoading } = useQuery({
        queryKey: ['gas-coupon-liquidation', selectedLiqId],
        queryFn: async () => (await axios.get(`/api/gas-station/coupon-liquidations/${selectedLiqId}`)).data,
        enabled: !!selectedLiqId && showDetailModal
    });

    // Cargar cupones pendientes del sistema
    const handleCargarCuponesSistema = async () => {
        if (!formBranchId) {
            toast.error('Debe seleccionar una sucursal para cargar cupones');
            return;
        }

        setIsLoadingCupones(true);
        try {
            const res = await axios.get('/api/gas-station/coupon-liquidations/pending-cupones', {
                params: {
                    branch_id: formBranchId,
                    startDate: formStartDate || undefined,
                    endDate: formEndDate || undefined,
                    distribuidora_id: formDistribuidoraId || undefined
                }
            });

            const items = res.data.map(c => ({
                closeout_cupon_id: c.id,
                cupon: c.cupon,
                distribuidora_id: c.distribuidora_id,
                distribuidora_nombre: c.distribuidora_nombre,
                producto_codigo: c.producto_codigo,
                producto_descripcion: c.producto_descripcion,
                despachador_id: c.despachador_id,
                despachador_nombre: c.despachador_nombre,
                closeout_id: c.closeout_id,
                fecha_turno: c.fecha_turno,
                numero_turno: c.numero_turno,
                monto_sistema: c.monto,
                monto_fisico: 0, // Inicia en 0 hasta ser verificado
                recibido_fisico: false, // Inicia no recibido (faltante)
                estado_conciliacion: 'faltante', // 'conciliado' | 'faltante' | 'sobrante'
                notas: ''
            }));

            setCuponesList(items);

            if (items.length === 0) {
                toast.info('No se encontraron cupones pendientes con los filtros seleccionados');
            } else {
                toast.success(`Se cargaron ${items.length} cupones del sistema listos para conciliar`);
            }
        } catch (error) {
            console.error('Error al cargar cupones:', error);
            toast.error('Error al cargar cupones del sistema');
        } finally {
            setIsLoadingCupones(false);
        }
    };

    // Alternar verificación de un cupón (check manual)
    const handleToggleRecibido = (idx) => {
        setCuponesList(prev => {
            const copy = [...prev];
            const item = { ...copy[idx] };
            const nuevoRecibido = !item.recibido_fisico;
            item.recibido_fisico = nuevoRecibido;

            if (item.estado_conciliacion !== 'sobrante') {
                if (nuevoRecibido) {
                    item.estado_conciliacion = 'conciliado';
                    item.monto_fisico = item.monto_sistema; // Asume el mismo monto al marcar
                } else {
                    item.estado_conciliacion = 'faltante';
                    item.monto_fisico = 0;
                }
            }
            copy[idx] = item;
            return copy;
        });
    };

    // Cambiar monto físico manual (por si difiere de lo registrado en sistema)
    const handleMontoFisicoChange = (idx, nuevoMonto) => {
        setCuponesList(prev => {
            const copy = [...prev];
            const item = { ...copy[idx] };
            const num = parseFloat(nuevoMonto) || 0;
            item.monto_fisico = num;
            if (num > 0) {
                item.recibido_fisico = true;
                if (item.estado_conciliacion === 'faltante') {
                    item.estado_conciliacion = 'conciliado';
                }
            } else {
                item.recibido_fisico = false;
                if (item.estado_conciliacion === 'conciliado') {
                    item.estado_conciliacion = 'faltante';
                }
            }
            copy[idx] = item;
            return copy;
        });
    };

    // Escaneo rápido de cupón físico con código de barras o teclado
    const handleScanSubmit = (e) => {
        e.preventDefault();
        const code = String(scanCode || '').trim();
        if (!code) return;

        // Buscar coincidencia en la lista
        const index = cuponesList.findIndex(c => String(c.cupon).trim().toLowerCase() === code.toLowerCase());

        if (index >= 0) {
            const currentItem = cuponesList[index];
            if (currentItem.recibido_fisico) {
                toast.warning(`El cupón #${code} ya fue verificado previamente.`);
            } else {
                setCuponesList(prev => {
                    const copy = [...prev];
                    copy[index] = {
                        ...copy[index],
                        recibido_fisico: true,
                        estado_conciliacion: 'conciliado',
                        monto_fisico: copy[index].monto_sistema
                    };
                    return copy;
                });
                toast.success(`Cupón #${code} verificado ($${currentItem.monto_sistema.toFixed(2)})`);
            }
        } else {
            // No existe en sistema: sugerir agregar como sobrante
            setSobranteCupon(code);
            setShowSobranteModal(true);
            toast.info(`Cupón #${code} no encontrado en sistema. Puede agregarlo como sobrante físico.`);
        }

        setScanCode('');
        if (scanInputRef.current) scanInputRef.current.focus();
    };

    // Marcar todos como recibidos
    const handleMarcarTodos = () => {
        setCuponesList(prev => prev.map(c => {
            if (c.estado_conciliacion === 'sobrante') return c;
            return {
                ...c,
                recibido_fisico: true,
                estado_conciliacion: 'conciliado',
                monto_fisico: c.monto_sistema
            };
        }));
        toast.success('Todos los cupones fueron marcados como recibidos');
    };

    // Desmarcar todos
    const handleDesmarcarTodos = () => {
        setCuponesList(prev => prev.map(c => {
            if (c.estado_conciliacion === 'sobrante') return c;
            return {
                ...c,
                recibido_fisico: false,
                estado_conciliacion: 'faltante',
                monto_fisico: 0
            };
        }));
        toast.info('Se desmarcaron todos los cupones');
    };

    // Agregar cupón sobrante manual
    const handleAgregarSobrante = () => {
        if (!sobranteCupon.trim()) {
            toast.error('Ingrese el número del cupón');
            return;
        }
        const monto = parseFloat(sobranteMonto) || 0;
        if (monto <= 0) {
            toast.error('Ingrese un monto válido mayor a 0');
            return;
        }

        const distObj = distributors.find(d => String(d.id) === String(sobranteDistribuidoraId));

        const newItem = {
            closeout_cupon_id: null,
            cupon: sobranteCupon.trim(),
            distribuidora_id: distObj ? distObj.id : null,
            distribuidora_nombre: distObj ? distObj.descripcion : 'OTRA DISTRIBUIDORA',
            producto_codigo: '',
            producto_descripcion: sobranteProducto || 'COMBUSTIBLE',
            despachador_id: null,
            despachador_nombre: 'NO REGISTRADO EN TURNO',
            closeout_id: null,
            fecha_turno: null,
            numero_turno: null,
            monto_sistema: 0,
            monto_fisico: monto,
            recibido_fisico: true,
            estado_conciliacion: 'sobrante',
            notas: sobranteNotas || 'Cupón físico sin registro previo en sistema'
        };

        setCuponesList(prev => [newItem, ...prev]);
        setShowSobranteModal(false);
        setSobranteCupon('');
        setSobranteMonto('');
        setSobranteProducto('');
        setSobranteNotas('');
        toast.success(`Cupón sobrante #${newItem.cupon} agregado`);
    };

    // Eliminar un item sobrante
    const handleEliminarSobrante = (idx) => {
        setCuponesList(prev => prev.filter((_, i) => i !== idx));
    };

    // Totales calculados en tiempo real
    const liveStats = useMemo(() => {
        let cantSistema = 0;
        let cantFisico = 0;
        let montoSistema = 0;
        let montoFisico = 0;
        let cantConciliados = 0;
        let cantFaltantes = 0;
        let cantSobrantes = 0;

        cuponesList.forEach(c => {
            const mSis = parseFloat(c.monto_sistema) || 0;
            const mFis = parseFloat(c.monto_fisico) || 0;

            if (c.estado_conciliacion === 'conciliado') {
                cantSistema++;
                montoSistema += mSis;
                cantFisico++;
                montoFisico += mFis;
                cantConciliados++;
            } else if (c.estado_conciliacion === 'faltante') {
                cantSistema++;
                montoSistema += mSis;
                cantFaltantes++;
            } else if (c.estado_conciliacion === 'sobrante') {
                cantFisico++;
                montoFisico += mFis;
                cantSobrantes++;
            }
        });

        const diferencia = montoFisico - montoSistema;
        return {
            cantSistema,
            cantFisico,
            montoSistema,
            montoFisico,
            diferencia,
            cantConciliados,
            cantFaltantes,
            cantSobrantes
        };
    }, [cuponesList]);

    // Filtrar lista para la tabla interactiva
    const filteredCupones = useMemo(() => {
        if (cuponFilterTab === 'conciliados') return cuponesList.filter(c => c.estado_conciliacion === 'conciliado');
        if (cuponFilterTab === 'faltantes') return cuponesList.filter(c => c.estado_conciliacion === 'faltante');
        if (cuponFilterTab === 'sobrantes') return cuponesList.filter(c => c.estado_conciliacion === 'sobrante');
        return cuponesList;
    }, [cuponesList, cuponFilterTab]);

    // Mutation: Guardar Liquidación
    const saveMutation = useMutation({
        mutationFn: async (payload) => (await axios.post('/api/gas-station/coupon-liquidations', payload)).data,
        onSuccess: (data) => {
            toast.success(`Liquidación ${data.correlativo} registrada exitosamente`);
            queryClient.invalidateQueries({ queryKey: ['gas-coupon-liquidations'] });
            setShowCreateModal(false);
            setCuponesList([]);
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al guardar la liquidación');
        }
    });

    const handleFinalizarLiquidacion = async () => {
        if (cuponesList.length === 0) {
            toast.error('No hay cupones para liquidar');
            return;
        }

        const distObj = distributors.find(d => String(d.id) === String(formDistribuidoraId));

        const ok = await confirm({
            title: '¿Finalizar y Procesar Liquidación?',
            message: `Se liquidarán ${liveStats.cantFisico} cupones físicos por un valor de $${liveStats.montoFisico.toFixed(2)}. Los cupones quedarán marcados en los turnos correspondientes.`,
            confirmLabel: 'Sí, liquidar ahora',
            cancelLabel: 'Cancelar',
            variant: 'info'
        });

        if (!ok) return;

        saveMutation.mutate({
            branch_id: formBranchId,
            fecha: formFechaLiq,
            distribuidora_id: formDistribuidoraId || null,
            distribuidora_nombre: distObj ? distObj.descripcion : null,
            responsable: formResponsable,
            comentario: formComentario,
            estado: 'liquidado',
            items: cuponesList
        });
    };

    // Mutation: Eliminar / Anular Liquidación
    const deleteMutation = useMutation({
        mutationFn: async (id) => (await axios.delete(`/api/gas-station/coupon-liquidations/${id}`)).data,
        onSuccess: () => {
            toast.success('Liquidación eliminada y cupones liberados correctamente');
            queryClient.invalidateQueries({ queryKey: ['gas-coupon-liquidations'] });
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || 'Error al eliminar liquidación');
        }
    });

    const handleDelete = async (id, correlativo) => {
        const ok = await confirm({
            title: `¿Eliminar liquidación ${correlativo}?`,
            message: 'Al eliminar esta liquidación, todos los cupones vinculados volverán a estar pendientes en los cierres de turno para una nueva conciliación.',
            confirmLabel: 'Sí, eliminar',
            cancelLabel: 'Cancelar',
            variant: 'danger'
        });

        if (ok) deleteMutation.mutate(id);
    };

    // Exportar PDF
    const handleDownloadPDF = (id) => {
        window.open(`/api/gas-station/coupon-liquidations/${id}/pdf`, '_blank');
    };

    // Exportar Excel
    const handleDownloadExcel = (id) => {
        window.open(`/api/gas-station/coupon-liquidations/${id}/excel`, '_blank');
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                            <Ticket size={22} />
                        </div>
                        Liquidación de Cupones
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                        Conciliación de cupones de combustible ingresados en turnos de pista versus cupones físicos recibidos
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            setCuponesList([]);
                            setShowCreateModal(true);
                        }}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20 active:scale-95"
                    >
                        <Plus size={16} />
                        Nueva Liquidación
                    </button>
                </div>
            </div>

            {/* KPIs Métricas del Mes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Sistema</div>
                    <div className="text-xl font-black text-slate-800 mt-1">
                        <Money value={summary.total_sistema || 0} />
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                        {summary.total_cupones_sistema || 0} cupones registrados
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Físico Recibido</div>
                    <div className="text-xl font-black text-sky-600 mt-1">
                        <Money value={summary.total_fisico || 0} />
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                        {summary.total_cupones_fisicos || 0} cupones entregados
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Diferencia Acumulada</div>
                    <div className={`text-xl font-black mt-1 ${(summary.total_diferencia || 0) < 0 ? 'text-rose-600' : ((summary.total_diferencia || 0) > 0 ? 'text-emerald-600' : 'text-slate-800')}`}>
                        <Money value={summary.total_diferencia || 0} />
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                        {(summary.total_diferencia || 0) === 0 ? 'Liquidaciones cuadradas' : 'Diferencias netas'}
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Liquidaciones</div>
                        <div className="text-2xl font-black text-slate-900 mt-1">{totalLiquidaciones}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">Actas generadas</div>
                    </div>
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                        <CheckCheck size={24} />
                    </div>
                </div>
            </div>

            {/* Filtros de Búsqueda */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Buscar</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                            <input
                                type="text"
                                value={listSearch}
                                onChange={(e) => {
                                    setListSearch(e.target.value);
                                    setListPage(1);
                                }}
                                placeholder="Correlativo, responsable..."
                                className="w-full pl-9 pr-3 py-2 text-[13px] font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Sucursal</label>
                        <select
                            value={listBranchId}
                            onChange={(e) => {
                                setListBranchId(e.target.value);
                                setListPage(1);
                            }}
                            className="w-full px-3 py-2 text-[13px] font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        >
                            <option value="">Todas las Sucursales</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.nombre || b.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Desde</label>
                        <input
                            type="date"
                            value={listStartDate}
                            onChange={(e) => {
                                setListStartDate(e.target.value);
                                setListPage(1);
                            }}
                            className="w-full px-3 py-2 text-[13px] font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Hasta</label>
                        <input
                            type="date"
                            value={listEndDate}
                            onChange={(e) => {
                                setListEndDate(e.target.value);
                                setListPage(1);
                            }}
                            className="w-full px-3 py-2 text-[13px] font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Estado</label>
                        <select
                            value={listEstado}
                            onChange={(e) => {
                                setListEstado(e.target.value);
                                setListPage(1);
                            }}
                            className="w-full px-3 py-2 text-[13px] font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        >
                            <option value="">Todos los Estados</option>
                            <option value="liquidado">Liquidado</option>
                            <option value="borrador">Borrador</option>
                            <option value="anulado">Anulado</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Tabla de Historial de Liquidaciones */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                <th className="px-4 py-3">Correlativo</th>
                                <th className="px-4 py-3">Fecha</th>
                                <th className="px-4 py-3">Sucursal</th>
                                <th className="px-4 py-3">Distribuidora</th>
                                <th className="px-4 py-3 text-center">Cupones (Sis / Fís)</th>
                                <th className="px-4 py-3 text-right">Monto Sistema</th>
                                <th className="px-4 py-3 text-right">Monto Físico</th>
                                <th className="px-4 py-3 text-right">Diferencia</th>
                                <th className="px-4 py-3">Responsable</th>
                                <th className="px-4 py-3 text-center">Estado</th>
                                <th className="px-4 py-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[13px]">
                            {listLoading ? (
                                <tr>
                                    <td colSpan={11} className="py-12 text-center text-slate-400">
                                        <Loader2 className="animate-spin inline mr-2 text-indigo-600" size={20} />
                                        Cargando liquidaciones...
                                    </td>
                                </tr>
                            ) : liquidaciones.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="py-12 text-center text-slate-400">
                                        No se encontraron liquidaciones de cupones registradas.
                                    </td>
                                </tr>
                            ) : (
                                liquidaciones.map(liq => {
                                    const dif = parseFloat(liq.diferencia_monto) || 0;
                                    return (
                                        <tr key={liq.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-4 py-3 font-bold text-indigo-600">
                                                {liq.correlativo}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                                {liq.fecha ? new Date(liq.fecha).toLocaleDateString('es-SV', { timeZone: 'UTC' }) : '-'}
                                            </td>
                                            <td className="px-4 py-3 font-medium text-slate-800">
                                                {liq.branch_name || 'General'}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">
                                                {liq.distribuidora_nombre || 'Todas'}
                                            </td>
                                            <td className="px-4 py-3 text-center whitespace-nowrap">
                                                <span className="font-bold text-slate-700">{liq.total_cupones_sistema}</span>
                                                <span className="text-slate-400 mx-1">/</span>
                                                <span className="font-bold text-sky-600">{liq.total_cupones_fisicos}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium text-slate-700">
                                                <Money value={liq.total_monto_sistema} />
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-900">
                                                <Money value={liq.total_monto_fisico} />
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold">
                                                <span className={dif < 0 ? 'text-rose-600' : (dif > 0 ? 'text-emerald-600' : 'text-slate-700')}>
                                                    <Money value={dif} />
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 text-xs">
                                                {liq.responsable || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {liq.estado === 'liquidado' && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        Liquidado
                                                    </span>
                                                )}
                                                {liq.estado === 'borrador' && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                        Borrador
                                                    </span>
                                                )}
                                                {liq.estado === 'anulado' && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                        Anulado
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedLiqId(liq.id);
                                                            setShowDetailModal(true);
                                                        }}
                                                        title="Ver Detalle"
                                                        className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDownloadPDF(liq.id)}
                                                        title="Imprimir PDF"
                                                        className="p-1.5 text-slate-600 hover:text-sky-600 hover:bg-slate-100 rounded-lg transition-colors"
                                                    >
                                                        <Printer size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDownloadExcel(liq.id)}
                                                        title="Descargar Excel"
                                                        className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-colors"
                                                    >
                                                        <FileSpreadsheet size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(liq.id, liq.correlativo)}
                                                        title="Eliminar y Liberar Cupones"
                                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="p-4 border-t border-slate-100">
                        <Pagination
                            currentPage={listPage}
                            totalPages={totalPages}
                            onPageChange={setListPage}
                        />
                    </div>
                )}
            </div>

            {/* Modal de Nueva Liquidación (Conciliador Sistema vs Físicos) */}
            <Modal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title="Nueva Liquidación de Cupones (Sistema vs Físicos)"
                maxWidth="max-w-6xl"
            >
                <div className="p-6 space-y-6 max-h-[85vh] overflow-y-auto">
                    {/* Paso 1: Filtros para traer cupones del sistema */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <Building2 size={16} className="text-indigo-600" />
                                1. Parámetros de Selección de Turnos
                            </h3>
                            <button
                                type="button"
                                onClick={handleCargarCuponesSistema}
                                disabled={isLoadingCupones}
                                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                            >
                                {isLoadingCupones ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                                Cargar Cupones del Sistema
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-500 uppercase">Sucursal</label>
                                <select
                                    value={formBranchId}
                                    onChange={(e) => setFormBranchId(e.target.value)}
                                    className="w-full px-3 py-1.5 text-[13px] font-medium bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    <option value="">Seleccione Sucursal</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.nombre || b.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-500 uppercase">Fecha Turno Desde</label>
                                <input
                                    type="date"
                                    value={formStartDate}
                                    onChange={(e) => setFormStartDate(e.target.value)}
                                    className="w-full px-3 py-1.5 text-[13px] font-medium bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-500 uppercase">Fecha Turno Hasta</label>
                                <input
                                    type="date"
                                    value={formEndDate}
                                    onChange={(e) => setFormEndDate(e.target.value)}
                                    className="w-full px-3 py-1.5 text-[13px] font-medium bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-500 uppercase">Distribuidora</label>
                                <select
                                    value={formDistribuidoraId}
                                    onChange={(e) => setFormDistribuidoraId(e.target.value)}
                                    className="w-full px-3 py-1.5 text-[13px] font-medium bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    <option value="">Todas las Distribuidoras</option>
                                    {distributors.map(d => (
                                        <option key={d.id} value={d.id}>{d.descripcion}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Paso 2: Escáner de Códigos de Barras y Barra de Acciones */}
                    <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-3">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <form onSubmit={handleScanSubmit} className="flex-1 flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Barcode className="absolute left-3 top-2.5 text-indigo-500" size={18} />
                                    <input
                                        ref={scanInputRef}
                                        type="text"
                                        value={scanCode}
                                        onChange={(e) => setScanCode(e.target.value)}
                                        placeholder="Escanear o digitar N° de cupón físico y presione [Enter]..."
                                        className="w-full pl-10 pr-4 py-2 text-[13px] font-bold bg-white border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 shadow-sm"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm active:scale-95"
                                >
                                    <CheckCircle2 size={16} />
                                    Validar
                                </button>
                            </form>

                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    type="button"
                                    onClick={handleMarcarTodos}
                                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm active:scale-95"
                                    title="Marcar todos los cupones cargados como recibidos físicamente"
                                >
                                    <CheckCheck size={16} />
                                    Marcar Todos
                                </button>

                                <button
                                    type="button"
                                    onClick={handleDesmarcarTodos}
                                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                                    title="Desmarcar todos los cupones"
                                >
                                    <RotateCcw size={15} />
                                    Desmarcar
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setSobranteCupon('');
                                        setShowSobranteModal(true);
                                    }}
                                    className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm active:scale-95"
                                    title="Registrar un cupón físico que no estaba digitado en el sistema"
                                >
                                    <Plus size={16} />
                                    + Cupón Sobrante
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Resumen de Conciliación en Tiempo Real */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-slate-200">
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cupones Sistema</span>
                            <span className="text-base font-black text-slate-800">{liveStats.cantSistema} uds.</span>
                            <span className="text-xs font-bold text-slate-600 block"><Money value={liveStats.montoSistema} /></span>
                        </div>

                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Físicos Recibidos</span>
                            <span className="text-base font-black text-sky-600">{liveStats.cantFisico} uds.</span>
                            <span className="text-xs font-bold text-sky-700 block"><Money value={liveStats.montoFisico} /></span>
                        </div>

                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Conciliados / Faltantes</span>
                            <span className="text-sm font-bold text-slate-700">
                                <span className="text-emerald-600 font-black">{liveStats.cantConciliados}</span> ok / <span className="text-rose-600 font-black">{liveStats.cantFaltantes}</span> faltan
                            </span>
                            <span className="text-[11px] text-amber-600 block">+{liveStats.cantSobrantes} sobrantes</span>
                        </div>

                        <div className="text-right">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Diferencia Neta</span>
                            <span className={`text-lg font-black block ${liveStats.diferencia < 0 ? 'text-rose-600' : (liveStats.diferencia > 0 ? 'text-emerald-600' : 'text-slate-800')}`}>
                                <Money value={liveStats.diferencia} />
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">
                                {liveStats.diferencia === 0 ? '✓ Cuadre exacto' : (liveStats.diferencia < 0 ? '⚠ Faltante físico' : '★ Sobrante físico')}
                            </span>
                        </div>
                    </div>

                    {/* Tabs para filtrar la tabla de cupones */}
                    <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                        <button
                            type="button"
                            onClick={() => setCuponFilterTab('todos')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${cuponFilterTab === 'todos' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                        >
                            Todos ({cuponesList.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setCuponFilterTab('conciliados')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${cuponFilterTab === 'conciliados' ? 'bg-emerald-600 text-white' : 'text-emerald-700 hover:bg-emerald-50'}`}
                        >
                            <CheckCircle2 size={14} />
                            Conciliados ({liveStats.cantConciliados})
                        </button>
                        <button
                            type="button"
                            onClick={() => setCuponFilterTab('faltantes')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${cuponFilterTab === 'faltantes' ? 'bg-rose-600 text-white' : 'text-rose-700 hover:bg-rose-50'}`}
                        >
                            <AlertTriangle size={14} />
                            Faltantes ({liveStats.cantFaltantes})
                        </button>
                        <button
                            type="button"
                            onClick={() => setCuponFilterTab('sobrantes')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${cuponFilterTab === 'sobrantes' ? 'bg-amber-600 text-white' : 'text-amber-700 hover:bg-amber-50'}`}
                        >
                            <Plus size={14} />
                            Sobrantes ({liveStats.cantSobrantes})
                        </button>
                    </div>

                    {/* Tabla de Cupones para Conciliación */}
                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="max-h-72 overflow-y-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-slate-100 z-10 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-3 py-2 w-10 text-center">Físico</th>
                                        <th className="px-3 py-2">Estado</th>
                                        <th className="px-3 py-2">N° Cupón</th>
                                        <th className="px-3 py-2">Distribuidora</th>
                                        <th className="px-3 py-2">Fecha / Turno</th>
                                        <th className="px-3 py-2">Despachador</th>
                                        <th className="px-3 py-2">Producto</th>
                                        <th className="px-3 py-2 text-right">Monto Sistema</th>
                                        <th className="px-3 py-2 text-right">Monto Físico</th>
                                        <th className="px-3 py-2 text-right">Diferencia</th>
                                        <th className="px-3 py-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-[12px]">
                                    {filteredCupones.length === 0 ? (
                                        <tr>
                                            <td colSpan={11} className="py-8 text-center text-slate-400">
                                                {cuponesList.length === 0
                                                    ? 'Haga clic en "Cargar Cupones del Sistema" para comenzar.'
                                                    : 'No hay cupones en esta pestaña.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredCupones.map((c, i) => {
                                            const realIndex = cuponesList.findIndex(item => item === c);
                                            const diff = (parseFloat(c.monto_fisico) || 0) - (parseFloat(c.monto_sistema) || 0);

                                            return (
                                                <tr
                                                    key={i}
                                                    className={`transition-colors ${c.recibido_fisico ? 'bg-emerald-50/40 hover:bg-emerald-50/70' : 'hover:bg-slate-50'}`}
                                                >
                                                    <td className="px-3 py-2 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={!!c.recibido_fisico}
                                                            onChange={() => handleToggleRecibido(realIndex)}
                                                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {c.estado_conciliacion === 'conciliado' && (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1 w-max">
                                                                <CheckCircle2 size={12} /> Coincide
                                                            </span>
                                                        )}
                                                        {c.estado_conciliacion === 'faltante' && (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 flex items-center gap-1 w-max">
                                                                <XCircle size={12} /> Faltante
                                                            </span>
                                                        )}
                                                        {c.estado_conciliacion === 'sobrante' && (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1 w-max">
                                                                <Plus size={12} /> Sobrante
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 font-bold text-slate-800">
                                                        {c.cupon}
                                                    </td>
                                                    <td className="px-3 py-2 text-slate-600 font-medium">
                                                        {c.distribuidora_nombre || '-'}
                                                    </td>
                                                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                                                        {c.fecha_turno ? `${new Date(c.fecha_turno).toLocaleDateString('es-SV', { timeZone: 'UTC' })} (T${c.numero_turno})` : '-'}
                                                    </td>
                                                    <td className="px-3 py-2 text-slate-600 truncate max-w-[130px]" title={c.despachador_nombre}>
                                                        {c.despachador_nombre || '-'}
                                                    </td>
                                                    <td className="px-3 py-2 text-slate-600 truncate max-w-[110px]" title={c.producto_descripcion}>
                                                        {c.producto_descripcion || '-'}
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-medium text-slate-600">
                                                        <Money value={c.monto_sistema} />
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        <div className="w-24 ml-auto">
                                                            <MoneyInput
                                                                value={c.monto_fisico}
                                                                onChange={(val) => handleMontoFisicoChange(realIndex, val)}
                                                                className="text-right font-bold text-xs py-1 px-1.5 border border-slate-300 rounded-lg bg-white"
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-bold">
                                                        <span className={diff < 0 ? 'text-rose-600' : (diff > 0 ? 'text-emerald-600' : 'text-slate-400')}>
                                                            <Money value={diff} />
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        {c.estado_conciliacion === 'sobrante' && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleEliminarSobrante(realIndex)}
                                                                className="text-slate-400 hover:text-rose-600"
                                                                title="Eliminar sobrante manual"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Paso 3: Metadatos de la Liquidación y Botón Final */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-500 uppercase">Fecha de Liquidación</label>
                            <input
                                type="date"
                                value={formFechaLiq}
                                onChange={(e) => setFormFechaLiq(e.target.value)}
                                className="w-full px-3 py-2 text-[13px] font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-500 uppercase">Responsable</label>
                            <input
                                type="text"
                                value={formResponsable}
                                onChange={(e) => setFormResponsable(e.target.value)}
                                placeholder="Nombre de quien liquida..."
                                className="w-full px-3 py-2 text-[13px] font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-500 uppercase">Observaciones / Comentario</label>
                            <input
                                type="text"
                                value={formComentario}
                                onChange={(e) => setFormComentario(e.target.value)}
                                placeholder="Notas adicionales..."
                                className="w-full px-3 py-2 text-[13px] font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>
                    </div>

                    {/* Botones de Acción */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => setShowCreateModal(false)}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleFinalizarLiquidacion}
                            disabled={saveMutation.isPending || cuponesList.length === 0}
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50"
                        >
                            {saveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                            Finalizar y Liquidar Cupones
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Modal para Agregar Cupón Sobrante Manual */}
            <Modal
                isOpen={showSobranteModal}
                onClose={() => setShowSobranteModal(false)}
                title="Registrar Cupón Físico Sobrante (Sin Registro Previo)"
                maxWidth="max-w-md"
            >
                <div className="p-6 space-y-4">
                    <p className="text-xs text-slate-500">
                        Este cupón fue recibido físicamente pero no se encuentra registrado en los turnos seleccionados. Ingrese los datos para incluirlo como sobrante:
                    </p>

                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">N° de Cupón</label>
                        <input
                            type="text"
                            value={sobranteCupon}
                            onChange={(e) => setSobranteCupon(e.target.value)}
                            placeholder="Ej: 5014110"
                            className="w-full px-3 py-2 text-[13px] font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Distribuidora</label>
                        <select
                            value={sobranteDistribuidoraId}
                            onChange={(e) => setSobranteDistribuidoraId(e.target.value)}
                            className="w-full px-3 py-2 text-[13px] font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        >
                            <option value="">Seleccione Distribuidora</option>
                            {distributors.map(d => (
                                <option key={d.id} value={d.id}>{d.descripcion}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Monto Físico ($)</label>
                        <MoneyInput
                            value={sobranteMonto}
                            onChange={setSobranteMonto}
                            placeholder="0.00"
                            className="w-full px-3 py-2 text-[13px] font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Producto (Opcional)</label>
                        <input
                            type="text"
                            value={sobranteProducto}
                            onChange={(e) => setSobranteProducto(e.target.value)}
                            placeholder="Ej: DIESEL AUTO"
                            className="w-full px-3 py-2 text-[13px] font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500 uppercase">Observación</label>
                        <input
                            type="text"
                            value={sobranteNotas}
                            onChange={(e) => setSobranteNotas(e.target.value)}
                            placeholder="Motivo o detalle..."
                            className="w-full px-3 py-2 text-[13px] font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => setShowSobranteModal(false)}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleAgregarSobrante}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm active:scale-95"
                        >
                            <Plus size={16} />
                            Agregar a la Liquidación
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Modal de Detalle de Liquidación Previa */}
            <Modal
                isOpen={showDetailModal}
                onClose={() => setShowDetailModal(false)}
                title={`Detalle de Liquidación: ${selectedLiquidation?.correlativo || ''}`}
                maxWidth="max-w-5xl"
            >
                <div className="p-6 space-y-6 max-h-[85vh] overflow-y-auto">
                    {detailLoading ? (
                        <div className="py-12 text-center text-slate-400">
                            <Loader2 className="animate-spin inline mr-2 text-indigo-600" size={24} />
                            Cargando detalle de la liquidación...
                        </div>
                    ) : selectedLiquidation ? (
                        <>
                            {/* Cabecera de Datos */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Sucursal</span>
                                    <span className="font-bold text-slate-800 text-[13px]">{selectedLiquidation.branch_name || 'General'}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Fecha</span>
                                    <span className="font-bold text-slate-800 text-[13px]">
                                        {selectedLiquidation.fecha ? new Date(selectedLiquidation.fecha).toLocaleDateString('es-SV', { timeZone: 'UTC' }) : '-'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Distribuidora</span>
                                    <span className="font-bold text-slate-800 text-[13px]">{selectedLiquidation.distribuidora_nombre || 'Todas'}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Responsable</span>
                                    <span className="font-bold text-slate-800 text-[13px]">{selectedLiquidation.responsable || '-'}</span>
                                </div>
                            </div>

                            {/* Resumen Financiero */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Monto en Sistema</span>
                                    <div className="text-lg font-black text-slate-800 mt-0.5">
                                        <Money value={selectedLiquidation.total_monto_sistema} />
                                    </div>
                                    <span className="text-[11px] text-slate-400">{selectedLiquidation.total_cupones_sistema} cupones</span>
                                </div>

                                <div className="p-4 bg-sky-50 rounded-2xl border border-sky-100">
                                    <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider block">Monto Físico Recibido</span>
                                    <div className="text-lg font-black text-sky-700 mt-0.5">
                                        <Money value={selectedLiquidation.total_monto_fisico} />
                                    </div>
                                    <span className="text-[11px] text-sky-600">{selectedLiquidation.total_cupones_fisicos} cupones</span>
                                </div>

                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Diferencia Neta</span>
                                    <div className={`text-lg font-black mt-0.5 ${(selectedLiquidation.diferencia_monto || 0) < 0 ? 'text-rose-600' : ((selectedLiquidation.diferencia_monto || 0) > 0 ? 'text-emerald-600' : 'text-slate-800')}`}>
                                        <Money value={selectedLiquidation.diferencia_monto} />
                                    </div>
                                    <span className="text-[11px] text-slate-400">
                                        {(selectedLiquidation.diferencia_monto || 0) === 0 ? 'Liquidación cuadrada' : 'Diferencia de conciliación'}
                                    </span>
                                </div>
                            </div>

                            {/* Tabla de Items Liquidados */}
                            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                <div className="max-h-72 overflow-y-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead className="sticky top-0 bg-slate-100 z-10 font-bold text-slate-600 uppercase tracking-wider">
                                            <tr>
                                                <th className="px-3 py-2">Estado</th>
                                                <th className="px-3 py-2">N° Cupón</th>
                                                <th className="px-3 py-2">Distribuidora</th>
                                                <th className="px-3 py-2">Fecha / Turno</th>
                                                <th className="px-3 py-2">Despachador</th>
                                                <th className="px-3 py-2">Producto</th>
                                                <th className="px-3 py-2 text-right">Monto Sis.</th>
                                                <th className="px-3 py-2 text-right">Monto Fís.</th>
                                                <th className="px-3 py-2 text-right">Diferencia</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {selectedLiquidation.items?.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50">
                                                    <td className="px-3 py-2">
                                                        {item.estado_conciliacion === 'conciliado' && (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                                                Conciliado
                                                            </span>
                                                        )}
                                                        {item.estado_conciliacion === 'faltante' && (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                                                Faltante
                                                            </span>
                                                        )}
                                                        {item.estado_conciliacion === 'sobrante' && (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                                                Sobrante
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 font-bold text-slate-800">{item.cupon}</td>
                                                    <td className="px-3 py-2 text-slate-600">{item.distribuidora_nombre}</td>
                                                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                                                        {item.fecha_turno ? `${new Date(item.fecha_turno).toLocaleDateString('es-SV', { timeZone: 'UTC' })} (T${item.numero_turno})` : '-'}
                                                    </td>
                                                    <td className="px-3 py-2 text-slate-600">{item.despachador_nombre || '-'}</td>
                                                    <td className="px-3 py-2 text-slate-600">{item.producto_descripcion || '-'}</td>
                                                    <td className="px-3 py-2 text-right font-medium text-slate-600">
                                                        <Money value={item.monto_sistema} />
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-bold text-slate-800">
                                                        <Money value={item.monto_fisico} />
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-bold">
                                                        <span className={item.diferencia < 0 ? 'text-rose-600' : (item.diferencia > 0 ? 'text-emerald-600' : 'text-slate-400')}>
                                                            <Money value={item.diferencia} />
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Botones de Exportación */}
                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => handleDownloadExcel(selectedLiquidation.id)}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm active:scale-95"
                                >
                                    <FileSpreadsheet size={16} />
                                    Descargar Excel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDownloadPDF(selectedLiquidation.id)}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm active:scale-95"
                                >
                                    <Printer size={16} />
                                    Imprimir PDF
                                </button>
                            </div>
                        </>
                    ) : null}
                </div>
            </Modal>
        </div>
    );
};

export default GasCouponLiquidation;
