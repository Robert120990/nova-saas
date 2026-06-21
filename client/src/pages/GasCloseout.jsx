import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
    Calculator, Lock, Unlock, Loader2, User, Calendar, Hash, X,
    Fuel, Receipt, CreditCard, Gift, Percent, Truck, Droplets,
    FlaskConical, Banknote, ArrowLeft, Plus, Trash2, Save
} from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams, useNavigate } from 'react-router-dom';

const GasCloseout = () => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const editId = searchParams.get('editId');

    const [closeoutId, setCloseoutId] = useState(null);
    const [estado, setEstado] = useState(null);
    const [readings, setReadings] = useState([]);
    const [sellerId, setSellerId] = useState('');
    const [sellerName, setSellerName] = useState('');
    const [fechaTurno, setFechaTurno] = useState(new Date().toISOString().split('T')[0]);
    const [numeroTurno, setNumeroTurno] = useState('');
    const [showReadingsModal, setShowReadingsModal] = useState(false);
    const [editAnterior, setEditAnterior] = useState(false);
    const [showGastosModal, setShowGastosModal] = useState(false);
    const [gastos, setGastos] = useState([]);
    const [expenseCategories, setExpenseCategories] = useState([]);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);

    const inputRefs = useRef({});

    useEffect(() => {
        const handler = (e) => {
            if (e.ctrlKey && e.altKey && e.key === 'a') {
                e.preventDefault();
                setEditAnterior(prev => !prev);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const { data: editData, isLoading: editLoading } = useQuery({
        queryKey: ['gas-closeout-edit', editId],
        queryFn: async () => (await axios.get(`/api/gas-station/closeouts/${editId}`)).data,
        enabled: !!editId
    });

    useEffect(() => {
        if (editData) {
            setCloseoutId(editData.id);
            setReadings(editData.readings);
            setEstado(editData.estado);
            setSellerId(editData.seller_id);
            setSellerName(editData.seller_name);
            setFechaTurno(editData.fecha_turno?.split('T')[0] || editData.fecha_turno);
            setNumeroTurno(editData.numero_turno);
        }
    }, [editData]);

    const { data: sellers = [] } = useQuery({
        queryKey: ['sellers-all'],
        queryFn: async () => (await axios.get('/api/sellers', { params: { limit: 200 } })).data?.data || []
    });

    const initMutation = useMutation({
        mutationFn: (data) => axios.post('/api/gas-station/closeouts/init', data),
        onSuccess: (res) => {
            setCloseoutId(res.data.id);
            setReadings(res.data.readings.map(r => ({ ...r, lectura_actual: r.lectura_anterior })));
            setEstado('abierto');
            toast.success('Cierre de lecturas iniciado');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al iniciar')
    });

    const updateMutation = useMutation({
        mutationFn: ({ readingId, data }) =>
            axios.patch(`/api/gas-station/closeouts/${closeoutId}/readings/${readingId}`, data),
        onError: (error) => toast.error(error.response?.data?.message || 'Error al guardar')
    });

    const closeMutation = useMutation({
        mutationFn: () => axios.post(`/api/gas-station/closeouts/${closeoutId}/close`),
        onSuccess: () => {
            setEstado('cerrado');
            toast.success('Cierre cerrado exitosamente');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al cerrar')
    });

    const saveExpensesMutation = useMutation({
        mutationFn: (expenses) => axios.post(`/api/gas-station/closeouts/${closeoutId}/expenses`, {
            expenses: expenses.map(e => ({
                ...e,
                provider_id: e.provider_id || null
            }))
        }),
        onSuccess: (res) => {
            setGastos(res.data);
            toast.success('Gastos guardados');
        },
        onError: (error) => toast.error(error.response?.data?.message || 'Error al guardar gastos')
    });

    const gastosTotal = useMemo(() =>
        gastos.reduce((s, e) => s + (parseFloat(e.valor) || 0), 0),
    [gastos]);

    const { data: existingExpenses } = useQuery({
        queryKey: ['gas-closeout-expenses', closeoutId],
        queryFn: async () => (await axios.get(`/api/gas-station/closeouts/${closeoutId}/expenses`)).data,
        enabled: !!closeoutId
    });

    useEffect(() => {
        if (existingExpenses) setGastos(existingExpenses);
    }, [existingExpenses]);

    const { data: providersData } = useQuery({
        queryKey: ['providers-all'],
        queryFn: async () => (await axios.get('/api/providers', { params: { limit: 500 } })).data?.data || [],
    });
    const providers = providersData || [];

    const loadExpenseCategories = async () => {
        try {
            const res = await axios.get('/api/gas-station/expense-categories');
            setExpenseCategories(res.data);
        } catch { }
    };

    const handleOpenGastos = () => {
        loadExpenseCategories();
        setShowGastosModal(true);
    };

    const handleAddGastoRow = () => {
        setGastos(prev => [...prev, {
            id: Date.now(),
            rubro: '',
            fecha: new Date().toISOString().split('T')[0],
            documento: '',
            tipo: 'ccf',
            provider_id: '',
            proveedor: '',
            valor: 0
        }]);
    };

    const handleGastoChange = (id, field, value) => {
        setGastos(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g));
    };

    const handleRemoveGasto = (id) => {
        setGastos(prev => prev.filter(g => g.id !== id));
    };

    const handleCreateCategory = async () => {
        if (!newCategoryName.trim()) return;
        try {
            const res = await axios.post('/api/gas-station/expense-categories', { name: newCategoryName.trim() });
            setExpenseCategories(prev => [...prev, res.data]);
            setNewCategoryName('');
            setShowNewCategoryInput(false);
            toast.success('Rubro creado');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error al crear rubro');
        }
    };

    const summaryByProduct = useMemo(() => {
        const map = {};
        readings.forEach(r => {
            const key = r.codigo_producto;
            if (!map[key]) {
                map[key] = {
                    codigo_producto: r.codigo_producto,
                    descripcion_producto: r.descripcion_producto,
                    precio: r.precio,
                    total_lectura: 0,
                    total_monto: 0
                };
            }
            const diferencia = r.lectura_actual - r.lectura_anterior - r.calibracion;
            const monto = diferencia * r.precio;
            map[key].total_lectura += diferencia;
            map[key].total_monto += monto;
        });
        return Object.values(map);
    }, [readings]);

    const totals = useMemo(() => ({
        totalLectura: readings.reduce((s, r) => s + (r.lectura_actual - r.lectura_anterior - r.calibracion), 0),
        totalMonto: readings.reduce((s, r) => s + ((r.lectura_actual - r.lectura_anterior - r.calibracion) * r.precio), 0)
    }), [readings]);

    const handleInit = (e) => {
        e.preventDefault();
        if (!sellerId || !fechaTurno || !numeroTurno) {
            toast.error('Todos los campos son requeridos');
            return;
        }
        const name = sellers.find(s => s.id === parseInt(sellerId))?.nombre || '';
        setSellerName(name);
        initMutation.mutate({ seller_id: parseInt(sellerId), seller_name: name, fecha_turno: fechaTurno, numero_turno: numeroTurno });
    };

    const handleReadingChange = (nozzleId, field, value) => {
        if (estado === 'cerrado') return;
        setReadings(prev => prev.map(r =>
            r.nozzle_id === nozzleId ? { ...r, [field]: parseFloat(value) || 0 } : r
        ));
    };

    const handleReadingBlur = (readingId, nozzleId) => {
        const r = readings.find(x => x.nozzle_id === nozzleId);
        if (!r) return;
        updateMutation.mutate({
            readingId,
            data: { lectura_actual: r.lectura_actual, calibracion: r.calibracion, lectura_anterior: r.lectura_anterior }
        });
    };

    const handleKeyDown = (e, index, field) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const currentReading = readings[index];
            if (!currentReading) return;

            if (field === 'lectura_anterior') {
                const actualKey = `lectura_actual-${currentReading.nozzle_id}`;
                const actualEl = inputRefs.current[actualKey];
                if (actualEl) { actualEl.focus(); return; }
            }

            if (field === 'lectura_actual') {
                const calibKey = `calibracion-${currentReading.nozzle_id}`;
                const calibEl = inputRefs.current[calibKey];
                if (calibEl) { calibEl.focus(); return; }
            }

            if (field === 'calibracion') {
                const nextReading = readings[index + 1];
                if (nextReading) {
                    const nextKey = editAnterior ? `anterior-${nextReading.nozzle_id}` : `lectura_actual-${nextReading.nozzle_id}`;
                    const nextEl = inputRefs.current[nextKey];
                    if (nextEl) nextEl.focus();
                }
            }
        }
    };

    const actionButtons = [
        { label: 'Lecturas', icon: Fuel, key: 'lecturas', enabled: true },
        { label: 'Gastos', icon: Receipt, key: 'gastos', enabled: true },
        { label: 'Cupones', icon: CreditCard, key: 'cupones' },
        { label: 'Créditos', icon: CreditCard, key: 'creditos' },
        { label: 'Vales', icon: Gift, key: 'vales' },
        { label: 'Descuentos', icon: Percent, key: 'descuentos' },
        { label: 'Anticipos Desp.', icon: Truck, key: 'anticipos' },
        { label: 'Remesas', icon: Banknote, key: 'remesas' },
        { label: 'Lubricantes', icon: Droplets, key: 'lubricantes' },
        { label: 'Tanques', icon: FlaskConical, key: 'tanques' },
        { label: 'Tarjetas', icon: CreditCard, key: 'tarjetas' },
        { label: 'Adelantos', icon: Banknote, key: 'adelantos' },
    ];

    const inputCls = "w-28 px-1.5 py-0.5 bg-white border border-slate-200 rounded outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-[11px] text-right font-mono";
    const inputDisabledCls = "w-28 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[11px] text-right font-mono text-slate-500";
    const inputCalibCls = "w-20 px-1.5 py-0.5 bg-white border border-slate-200 rounded outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-[11px] text-right font-mono";
    const inputCalibDisabledCls = "w-20 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[11px] text-right font-mono text-slate-500";

    if (editLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 size={24} className="animate-spin text-indigo-600" />
                <span className="ml-3 text-sm font-medium text-slate-500">Cargando cierre...</span>
            </div>
        );
    }

    if (closeoutId && readings.length > 0) {
        return (
            <>
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {editId && (
                                <button
                                    onClick={() => navigate('/gas-station/historial-lecturas')}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                    title="Volver al historial"
                                >
                                    <ArrowLeft size={18} />
                                </button>
                            )}
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                    <Calculator size={20} className="text-indigo-600" />
                                    Cierre de Lecturas
                                    {editId && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Editando</span>}
                                </h2>
                                <p className="text-slate-500 text-[11px] font-medium">
                                    Turno #{numeroTurno} — {fechaTurno} — {sellerName}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                                estado === 'cerrado'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                                {estado === 'cerrado' ? <Lock size={12} /> : <Unlock size={12} />}
                                {estado === 'cerrado' ? 'Cerrado' : 'Abierto'}
                            </span>
                            {estado === 'abierto' && (
                                <button
                                    onClick={() => closeMutation.mutate()}
                                    disabled={closeMutation.isPending}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-xl font-bold text-sm transition-all shadow-lg disabled:opacity-50"
                                >
                                    {closeMutation.isPending ? 'Cerrando...' : 'Cerrar Turno'}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="flex-1 flex flex-col gap-4 min-w-0">
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                                <div className="px-4 py-2 border-b border-slate-100">
                                    <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Resumen de Lecturas</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                                                <th className="px-3 py-1.5">Código</th>
                                                <th className="px-3 py-1.5">Descripción</th>
                                                <th className="px-3 py-1.5 text-right">Precio</th>
                                                <th className="px-3 py-1.5 text-right">Total Lectura</th>
                                                <th className="px-3 py-1.5 text-right">Total Monto</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 text-xs">
                                            {summaryByProduct.map(p => (
                                                <tr key={p.codigo_producto} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-3 py-1.5 font-mono font-bold text-slate-800">{p.codigo_producto}</td>
                                                    <td className="px-3 py-1.5 text-slate-600">{p.descripcion_producto}</td>
                                                    <td className="px-3 py-1.5 text-right font-mono text-slate-700">${parseFloat(p.precio).toFixed(2)}</td>
                                                    <td className="px-3 py-1.5 text-right font-mono font-bold text-indigo-600">{p.total_lectura.toFixed(5)}</td>
                                                    <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-900">${p.total_monto.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-slate-50 border-t border-slate-100 text-xs font-bold">
                                            <tr>
                                                <td colSpan={3} className="px-3 py-1.5 text-right text-slate-600 uppercase tracking-wider">Totales</td>
                                                <td className="px-3 py-1.5 text-right font-mono text-indigo-600">{totals.totalLectura.toFixed(5)}</td>
                                                <td className="px-3 py-1.5 text-right font-mono text-slate-900">${totals.totalMonto.toFixed(2)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1">
                                    <div className="px-4 py-2 border-b border-slate-100">
                                        <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Ingresos</h3>
                                    </div>
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                                                <th className="px-3 py-1.5">Descripción</th>
                                                <th className="px-3 py-1.5 text-right w-28">Monto</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 text-xs">
                                            <tr className="hover:bg-slate-50 transition-colors">
                                                <td className="px-3 py-1.5 text-slate-600">Combustible (Ventas)</td>
                                                <td className="px-3 py-1.5 text-right font-mono font-bold text-emerald-600">${totals.totalMonto.toFixed(2)}</td>
                                            </tr>
                                            <tr className="hover:bg-slate-50 transition-colors">
                                                <td className="px-3 py-1.5 text-slate-600">Lubricantes</td>
                                                <td className="px-3 py-1.5 text-right font-mono text-slate-400">$0.00</td>
                                            </tr>
                                        </tbody>
                                        <tfoot className="bg-slate-50 border-t border-slate-100 text-xs font-bold">
                                            <tr>
                                                <td className="px-3 py-1.5 text-right text-slate-600 uppercase tracking-wider">Total Ingresos</td>
                                                <td className="px-3 py-1.5 text-right font-mono text-emerald-600">${totals.totalMonto.toFixed(2)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1">
                                    <div className="px-4 py-2 border-b border-slate-100">
                                        <h3 className="text-xs font-bold text-red-600 uppercase tracking-wider">Egresos</h3>
                                    </div>
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                                                <th className="px-3 py-1.5">Descripción</th>
                                                <th className="px-3 py-1.5 text-right w-28">Monto</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 text-xs">
                                            {[
                                                'Cupones', 'Créditos', 'Vales', 'Descuentos',
                                                'Anticipos Desp.', 'Remesas', 'Tarjetas', 'Adelantos'
                                            ].map(label => (
                                                <tr key={label} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-3 py-1.5 text-slate-600">{label}</td>
                                                    <td className="px-3 py-1.5 text-right font-mono text-slate-400">$0.00</td>
                                                </tr>
                                            ))}
                                            <tr className="hover:bg-slate-50 transition-colors bg-slate-50/50">
                                                <td className="px-3 py-1.5 text-slate-700 font-semibold">Gastos</td>
                                                <td className="px-3 py-1.5 text-right font-mono font-semibold text-red-600">${gastosTotal.toFixed(2)}</td>
                                            </tr>
                                        </tbody>
                                        <tfoot className="bg-slate-50 border-t border-slate-100 text-xs font-bold">
                                            <tr>
                                                <td className="px-3 py-1.5 text-right text-slate-600 uppercase tracking-wider">Total Egresos</td>
                                                <td className="px-3 py-1.5 text-right font-mono text-red-600">${gastosTotal.toFixed(2)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="px-4 py-2 border-b border-slate-100">
                                    <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Diferencia</h3>
                                </div>
                                <div className="px-4 py-3 flex items-center justify-between">
                                    <span className="text-xs font-medium text-slate-500">Ingresos - Egresos</span>
                                    <span className={`text-lg font-black font-mono ${(totals.totalMonto - gastosTotal) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                        ${(totals.totalMonto - gastosTotal).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="w-72 shrink-0">
                            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Opciones del Turno</h3>
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
                                <div className="grid grid-cols-2 gap-1.5">
                                    {actionButtons.map(btn => {
                                        const Icon = btn.icon;
                                        const isLectura = btn.key === 'lecturas';
                                        const isGastos = btn.key === 'gastos';
                                        const canClick = isLectura || isGastos || (btn.enabled && estado === 'abierto');
                                        return (
                                            <button
                                                key={btn.key}
                                                onClick={() => {
                                                    if (isLectura) { setShowReadingsModal(true); setEditAnterior(false); }
                                                    if (isGastos) handleOpenGastos();
                                                }}
                                                disabled={!canClick}
                                                className={`flex flex-col items-center gap-1 py-3 px-1 rounded-xl border transition-all text-[9px] font-bold uppercase leading-tight ${
                                                    canClick
                                                    ? 'bg-white border-slate-200 text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 cursor-pointer shadow-sm'
                                                    : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                                                }`}
                                            >
                                                <Icon size={18} className={canClick ? 'text-slate-500' : 'text-slate-200'} />
                                                {btn.label}
                                            </button>
                                        );
                                    })}
                        </div>
                    </div>
                        </div>
                    </div>
                </div>

                {showReadingsModal && (
                    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
                        <div className="fixed inset-0 bg-black/40" onClick={() => { setShowReadingsModal(false); setEditAnterior(false); }} />
                        <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-5xl max-h-[90vh] flex flex-col">
                            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <Fuel size={16} className="text-indigo-600" />
                                    Lecturas por Pistola
                                    {estado === 'cerrado' && (
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Solo lectura</span>
                                    )}
                                </h3>
                                <button
                                    onClick={() => { setShowReadingsModal(false); setEditAnterior(false); }}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <X size={16} className="text-slate-400" />
                                </button>
                            </div>
                            <div className="overflow-auto px-4 pb-4 flex-1 relative">
                                <table className="w-full text-left border-separate border-spacing-0">
                                    <thead className="sticky top-0 z-20">
                                        <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                            <th className="px-1.5 py-1 w-16 bg-slate-50 border-b border-slate-100">Pistola</th>
                                            <th className="px-1.5 py-1 max-w-[120px] bg-slate-50 border-b border-slate-100">Producto</th>
                                            <th className="px-1.5 py-1 text-right w-16 bg-slate-50 border-b border-slate-100">Precio</th>
                                            <th className={`px-1.5 py-1 text-right w-32 bg-slate-50 border-b border-slate-100 ${editAnterior ? 'text-amber-600' : ''}`}>Lect. Ant{editAnterior && '*'}</th>
                                            <th className="px-1.5 py-1 text-right w-32 bg-slate-50 border-b border-slate-100">Lect. Actual</th>
                                            <th className="px-1.5 py-1 text-right w-24 bg-slate-50 border-b border-slate-100">Calibr</th>
                                            <th className="px-1.5 py-1 text-right w-16 bg-slate-50 border-b border-slate-100">Difer</th>
                                            <th className="px-1.5 py-1 text-right w-20 bg-slate-50 border-b border-slate-100">Monto</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {readings.map((r, idx) => {
                                            const diferencia = r.lectura_actual - r.lectura_anterior - r.calibracion;
                                            const monto = diferencia * r.precio;
                                            return (
                                                <tr key={r.nozzle_id} className="hover:bg-slate-50 transition-colors text-[11px]">
                                                    <td className="px-1.5 py-0.5 font-bold text-slate-900 whitespace-nowrap">{r.codigo_pistola}</td>
                                                    <td className="px-1.5 py-0.5 max-w-[120px] truncate">
                                                        <span className="font-medium text-slate-800">{r.codigo_producto}</span>
                                                        <span className="text-[10px] text-slate-400 ml-1">— {r.descripcion_producto}</span>
                                                    </td>
                                                    <td className="px-1.5 py-0.5 text-right font-mono text-slate-700 whitespace-nowrap">${parseFloat(r.precio).toFixed(2)}</td>
                                                    <td className="px-1.5 py-0.5 text-right">
                                                        {editAnterior ? (
                                                            <input
                                                                ref={el => { inputRefs.current[`anterior-${r.nozzle_id}`] = el; }}
                                                                type="number"
                                                                step="0.00001"
                                                                value={r.lectura_anterior || ''}
                                                                onChange={(e) => handleReadingChange(r.nozzle_id, 'lectura_anterior', e.target.value)}
                                                                onBlur={() => handleReadingBlur(r.id, r.nozzle_id)}
                                                                onKeyDown={(e) => handleKeyDown(e, idx, 'lectura_anterior')}
                                                                onFocus={(e) => e.target.select()}
                                                                disabled={estado === 'cerrado'}
                                                                className={`${estado === 'cerrado' ? inputDisabledCls : inputCls} ml-auto`}
                                                            />
                                                    ) : (
                                                        <span className="font-mono text-slate-500 whitespace-nowrap">{r.lectura_anterior.toFixed(5)}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-1.5 py-0.5 text-right">
                                                        <input
                                                            ref={el => { inputRefs.current[`lectura_actual-${r.nozzle_id}`] = el; }}
                                                            type="number"
                                                            step="0.00001"
                                                            value={r.lectura_actual || ''}
                                                            onChange={(e) => handleReadingChange(r.nozzle_id, 'lectura_actual', e.target.value)}
                                                            onBlur={() => handleReadingBlur(r.id, r.nozzle_id)}
                                                            onKeyDown={(e) => handleKeyDown(e, idx, 'lectura_actual')}
                                                            onFocus={(e) => e.target.select()}
                                                            disabled={estado === 'cerrado'}
                                                            className={`${estado === 'cerrado' ? inputDisabledCls : inputCls} ml-auto`}
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-0.5 text-right">
                                                        <input
                                                            ref={el => { inputRefs.current[`calibracion-${r.nozzle_id}`] = el; }}
                                                            type="number"
                                                            step="0.00001"
                                                            value={r.calibracion || ''}
                                                            onChange={(e) => handleReadingChange(r.nozzle_id, 'calibracion', e.target.value)}
                                                            onBlur={() => handleReadingBlur(r.id, r.nozzle_id)}
                                                            onKeyDown={(e) => handleKeyDown(e, idx, 'calibracion')}
                                                            onFocus={(e) => e.target.select()}
                                                            disabled={estado === 'cerrado'}
                                                            className={`${estado === 'cerrado' ? inputCalibDisabledCls : inputCalibCls} ml-auto`}
                                                        />
                                                    </td>
                                                    <td className="px-1.5 py-0.5 text-right font-mono font-bold text-indigo-600 whitespace-nowrap">{diferencia.toFixed(5)}</td>
                                                    <td className="px-1.5 py-0.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">${monto.toFixed(2)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {showGastosModal && (
                    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8">
                        <div className="fixed inset-0 bg-black/40" onClick={() => setShowGastosModal(false)} />
                        <div className="relative bg-white rounded-2xl shadow-2xl w-[95%] max-w-4xl max-h-[90vh] flex flex-col">
                            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 shrink-0">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <Receipt size={16} className="text-indigo-600" />
                                    Gastos del Turno
                                    {estado === 'cerrado' && (
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Solo lectura</span>
                                    )}
                                </h3>
                                <button
                                    onClick={() => setShowGastosModal(false)}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <X size={16} className="text-slate-400" />
                                </button>
                            </div>
                            <div className="overflow-auto px-4 pb-4 flex-1">
                                <table className="w-full text-left border-separate border-spacing-0">
                                    <thead className="sticky top-0 z-20">
                                        <tr className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-40">Rubro</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-28">Fecha</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-28">Documento</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-20">Tipo</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-40">Proveedor</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 text-right w-24">Valor</th>
                                            <th className="px-1.5 py-1 bg-slate-50 border-b border-slate-100 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {gastos.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="px-3 py-8 text-center text-xs text-slate-400">
                                                    No hay gastos registrados. Agregue un gasto para comenzar.
                                                </td>
                                            </tr>
                                        )}
                                        {gastos.map(g => (
                                            <tr key={g.id} className="text-[11px] hover:bg-slate-50 transition-colors">
                                                <td className="px-1.5 py-1">
                                                    {showNewCategoryInput ? (
                                                        <div className="flex gap-1">
                                                            <input
                                                                type="text"
                                                                value={newCategoryName}
                                                                onChange={(e) => setNewCategoryName(e.target.value)}
                                                                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateCategory(); if (e.key === 'Escape') setShowNewCategoryInput(false); }}
                                                                placeholder="Nuevo rubro..."
                                                                className="w-full px-1.5 py-0.5 bg-white border border-indigo-300 rounded text-[11px] outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                                autoFocus
                                                            />
                                                            <button onClick={handleCreateCategory} className="p-0.5 text-indigo-600 hover:text-indigo-800">
                                                                <Plus size={14} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <select
                                                            value={g.rubro}
                                                            onChange={(e) => {
                                                                if (e.target.value === '__new__') {
                                                                    setShowNewCategoryInput(true);
                                                                    setNewCategoryName('');
                                                                } else {
                                                                    handleGastoChange(g.id, 'rubro', e.target.value);
                                                                }
                                                            }}
                                                            disabled={estado === 'cerrado'}
                                                            className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        >
                                                            <option value="">Seleccionar...</option>
                                                            {expenseCategories.map(c => (
                                                                <option key={c.id} value={c.name}>{c.name}</option>
                                                            ))}
                                                            <option value="__new__">+ Nuevo rubro...</option>
                                                        </select>
                                                    )}
                                                </td>
                                                <td className="px-1.5 py-1">
                                                    <input
                                                        type="date"
                                                        value={g.fecha}
                                                        onChange={(e) => handleGastoChange(g.id, 'fecha', e.target.value)}
                                                        disabled={estado === 'cerrado'}
                                                        className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                    />
                                                </td>
                                                <td className="px-1.5 py-1">
                                                    <input
                                                        type="text"
                                                        value={g.documento}
                                                        onChange={(e) => handleGastoChange(g.id, 'documento', e.target.value)}
                                                        disabled={estado === 'cerrado'}
                                                        placeholder="N° documento"
                                                        className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                    />
                                                </td>
                                                <td className="px-1.5 py-1">
                                                    <select
                                                        value={g.tipo}
                                                        onChange={(e) => handleGastoChange(g.id, 'tipo', e.target.value)}
                                                        disabled={estado === 'cerrado'}
                                                        className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                    >
                                                        <option value="ccf">CCF</option>
                                                        <option value="cmp">CMP</option>
                                                        <option value="fac">FAC</option>
                                                        <option value="tic">TIC</option>
                                                    </select>
                                                </td>
                                                <td className="px-1.5 py-1">
                                                    <select
                                                        value={g.provider_id}
                                                        onChange={(e) => {
                                                            const id = e.target.value;
                                                            const prov = providers.find(p => p.id === parseInt(id));
                                                            handleGastoChange(g.id, 'provider_id', id);
                                                            handleGastoChange(g.id, 'proveedor', prov ? prov.nombre : '');
                                                        }}
                                                        disabled={estado === 'cerrado'}
                                                        className="w-full bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                    >
                                                        <option value="">Seleccionar...</option>
                                                        {providers.map(p => (
                                                            <option key={p.id} value={p.id}>{p.nombre}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-1.5 py-1 text-right">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={g.valor || ''}
                                                        onChange={(e) => handleGastoChange(g.id, 'valor', parseFloat(e.target.value) || 0)}
                                                        onFocus={(e) => e.target.select()}
                                                        disabled={estado === 'cerrado'}
                                                        placeholder="0.00"
                                                        className="w-20 text-right bg-white border border-slate-200 rounded text-[11px] py-0.5 px-1 outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                                                    />
                                                </td>
                                                <td className="px-1.5 py-1 text-center">
                                                    {estado !== 'cerrado' && (
                                                        <button
                                                            onClick={() => handleRemoveGasto(g.id)}
                                                            className="p-0.5 text-slate-300 hover:text-red-500 transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {estado !== 'cerrado' && (
                                    <div className="flex items-center justify-between mt-3">
                                        <button
                                            onClick={handleAddGastoRow}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all"
                                        >
                                            <Plus size={14} />
                                            Agregar Gasto
                                        </button>
                                        <div className="flex items-center gap-4">
                                            <span className="text-xs text-slate-500">
                                                Total Gastos: <strong className="text-red-600 font-mono text-sm">${gastosTotal.toFixed(2)}</strong>
                                            </span>
                                            <button
                                                onClick={() => saveExpensesMutation.mutate(gastos)}
                                                disabled={saveExpensesMutation.isPending}
                                                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all disabled:opacity-50"
                                            >
                                                {saveExpensesMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                {saveExpensesMutation.isPending ? 'Guardando...' : 'Guardar Gastos'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </>
        );
    }

    return (
        <div className="max-w-lg mx-auto mt-12 space-y-6">
            <div className="text-center">
                <h2 className="text-xl font-bold text-slate-900 flex items-center justify-center gap-2">
                    <Calculator size={22} className="text-indigo-600" />
                    Cierre de Lecturas
                </h2>
                <p className="text-slate-500 text-[11px] font-medium mt-1">Gasolinera — Iniciar nuevo cierre</p>
            </div>

            <form onSubmit={handleInit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Vendedor</label>
                    <div className="relative">
                        <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <select
                            value={sellerId}
                            onChange={(e) => setSellerId(e.target.value)}
                            required
                            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-xs font-medium appearance-none cursor-pointer"
                        >
                            <option value="">Seleccionar vendedor...</option>
                            {sellers.filter(s => s.status === 'activo').map(s => (
                                <option key={s.id} value={s.id}>{s.nombre}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Fecha de Turno</label>
                    <div className="relative">
                        <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="date"
                            value={fechaTurno}
                            onChange={(e) => setFechaTurno(e.target.value)}
                            required
                            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-xs font-medium"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Número de Turno</label>
                    <div className="relative">
                        <Hash size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="number"
                            min="1"
                            step="1"
                            value={numeroTurno}
                            onChange={(e) => setNumeroTurno(e.target.value)}
                            required
                            placeholder="Ej: 1"
                            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-xs font-medium"
                        />
                    </div>
                </div>
                <button
                    type="submit"
                    disabled={initMutation.isPending}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {initMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
                    {initMutation.isPending ? 'Iniciando...' : 'Iniciar Lectura'}
                </button>
            </form>
        </div>
    );
};

export default GasCloseout;
