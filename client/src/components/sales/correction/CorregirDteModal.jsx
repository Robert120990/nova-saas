import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Wrench, RefreshCcw, User, Calculator, FileText, Globe } from 'lucide-react';
import Modal from '../../ui/Modal';
import CorrectionClienteTab from './tabs/CorrectionClienteTab';
import CorrectionMontosTab from './tabs/CorrectionMontosTab';
import CorrectionDocumentosTab from './tabs/CorrectionDocumentosTab';
import CorrectionExportacionTab from './tabs/CorrectionExportacionTab';
import { CorrectionIssuesBanner, CorrectionFooterBar } from './CorrectionModalSections';

export default function CorregirDteModal({
    isOpen,
    onClose,
    saleId,
    initialTab = null,
    canRegenerateDTE = false,
    onSuccess
}) {
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [recalculating, setRecalculating] = useState(false);
    const [context, setContext] = useState(null);
    const [activeTab, setActiveTab] = useState('cliente');

    const [customer, setCustomer] = useState(null);
    const [clienteNombreFallback, setClienteNombreFallback] = useState('');
    const [syncBranchAddress, setSyncBranchAddress] = useState(true);
    const [items, setItems] = useState([]);
    const [header, setHeader] = useState({});
    const [payments, setPayments] = useState([]);
    const [linkedDocuments, setLinkedDocuments] = useState([]);
    const [exportacion, setExportacion] = useState({});
    const [remision, setRemision] = useState({});
    const [observaciones, setObservaciones] = useState('');
    const [syncCustomerCountry, setSyncCustomerCountry] = useState(true);

    const [preview, setPreview] = useState(null);
    const [adjustments, setAdjustments] = useState([]);
    const [recalcRetPerc, setRecalcRetPerc] = useState(false);
    const [updateDateTime, setUpdateDateTime] = useState(false);
    const [liveHaciendaError, setLiveHaciendaError] = useState(null);

    const loadContext = useCallback(async (keepTab = false) => {
        if (!saleId) return;
        setLoading(true);
        try {
            const res = await axios.get(`/api/sales/${saleId}/dte-correction-context`);
            const ctx = res.data;
            setContext(ctx);
            setCustomer(ctx.customer);
            setClienteNombreFallback(ctx.sale?.cliente_nombre || '');
            setItems(Array.isArray(ctx.items) ? ctx.items : []);
            setHeader(ctx.header || {});
            setPayments(Array.isArray(ctx.payments) ? ctx.payments : []);
            setLinkedDocuments(Array.isArray(ctx.linkedDocuments) ? ctx.linkedDocuments : []);
            setExportacion({
                export_item_type: ctx.sale?.export_item_type || 1,
                fiscal_enclosure: ctx.sale?.fiscal_enclosure || '',
                export_regime: ctx.sale?.export_regime || 'EX-1',
                dest_country_code: ctx.sale?.dest_country_code || ctx.customer?.pais || ''
            });
            setRemision({
                remission_type: ctx.sale?.remission_type || '02',
                transporter_name: ctx.sale?.transporter_name || '',
                vehicle_plate: ctx.sale?.vehicle_plate || ''
            });
            setObservaciones(ctx.sale?.observaciones || '');
            setPreview(ctx.recalculationPreview?.dtePreview || null);
            setAdjustments(ctx.recalculationPreview?.adjustments || []);
            setUpdateDateTime(Boolean(ctx.analysis?.recommendUpdateDateTime));
            if (!keepTab) {
                setActiveTab(initialTab || ctx.analysis?.recommendedTab || 'cliente');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error al cargar datos del DTE');
            onClose();
        } finally {
            setLoading(false);
        }
    }, [saleId, initialTab, onClose]);

    useEffect(() => {
        if (isOpen && saleId) {
            setLiveHaciendaError(null);
            loadContext(false);
        } else {
            setContext(null);
        }
    }, [isOpen, saleId, loadContext]);

    if (!isOpen || !saleId) return null;

    const dteType = String(context?.sale?.dte_type || '01');
    const issues = Array.isArray(context?.analysis?.detectedIssues) ? context.analysis.detectedIssues : [];

    const tabs = [
        { id: 'cliente', label: 'Cliente / Receptor', icon: User, show: true },
        { id: 'montos', label: 'Montos / Aproximación', icon: Calculator, show: dteType !== '07' },
        { id: 'documentos', label: 'Docs. Relacionados', icon: FileText, show: ['05', '06', '07', '04'].includes(dteType) || linkedDocuments.length > 0 },
        { id: 'exportacion', label: dteType === '11' ? 'Exportación (FEX)' : dteType === '04' ? 'Remisión (NR)' : 'Obs. / Adicionales', icon: Globe, show: true }
    ].filter(t => t.show);

    const handleRunRecalculate = async () => {
        setRecalculating(true);
        try {
            const res = await axios.post(`/api/sales/${saleId}/dte-correction/recalculate`, {
                items, header, payments, linkedDocuments, customer,
                autoFixApproximation: true,
                recalcRetencionPercepcion: recalcRetPerc
            });
            setItems(res.data.items || items);
            setHeader(res.data.header || header);
            setPayments(res.data.payments || payments);
            setPreview(res.data.dtePreview || null);
            setAdjustments(res.data.adjustments || []);
            toast.success('Cálculo y cuadre aplicados en borrador');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error al recalcular');
        } finally {
            setRecalculating(false);
        }
    };

    const buildCorrectionPayload = (action) => ({
        action,
        updateDateTime,
        syncBranchAddress,
        syncCustomerCountry,
        recalcRetencionPercepcion: recalcRetPerc,
        customer: customer ? { ...customer } : (clienteNombreFallback ? { nombre: clienteNombreFallback } : null),
        items: dteType === '07' ? undefined : items,
        header: dteType === '07' ? undefined : header,
        payments: dteType === '07' ? undefined : payments,
        linkedDocuments: ['05', '06', '07', '04'].includes(dteType) || linkedDocuments.length > 0 ? linkedDocuments : undefined,
        exportacion: dteType === '11' ? exportacion : undefined,
        remision: dteType === '04' ? remision : undefined,
        observaciones
    });

    const handleAction = async (mode) => {
        setSaving(true);
        setLiveHaciendaError(null);
        try {
            if (mode === 'regenerate') {
                await axios.put(`/api/sales/${saleId}/dte-correction`, buildCorrectionPayload('save_only'));
                const regRes = await axios.post(`/api/sales/${saleId}/regenerate-dte`, { updateDateTime });
                toast.success(regRes.data?.message || 'DTE regenerado y emitido correctamente');
                queryClient.invalidateQueries(['sales-history']);
                if (onSuccess) onSuccess();
                onClose();
                return;
            }
            const res = await axios.put(`/api/sales/${saleId}/dte-correction`, buildCorrectionPayload(mode));
            queryClient.invalidateQueries(['sales-history']);
            queryClient.invalidateQueries(['customers']);
            if (mode === 'save_only') {
                toast.success(res.data?.message || 'Correcciones guardadas');
                await loadContext(true);
                if (onSuccess) onSuccess();
                return;
            }
            if (res.data?.accepted) {
                toast.success(res.data?.message || 'DTE corregido y aceptado por Hacienda');
                if (onSuccess) onSuccess();
                onClose();
            } else {
                toast.warning(res.data?.message || 'Cambios guardados, revisar nueva observación de Hacienda');
                setLiveHaciendaError(res.data?.haciendaError || res.data?.details || 'Rechazado por Hacienda');
                await loadContext(true);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'No se pudo completar la operación');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            maxWidth="max-w-5xl"
            title={
                <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-sm"><Wrench size={18} /></div>
                    <div>
                        <h3 className="text-base font-bold text-slate-900">Solventar / Corregir DTE — Venta #{saleId}</h3>
                        <p className="text-xs text-slate-500">Tipo {dteType} • {context?.sale?.numero_control || 'Sin número de control'}</p>
                    </div>
                </div>
            }
        >
            {loading && !context ? (
                <div className="py-16 text-center space-y-3">
                    <RefreshCcw size={28} className="animate-spin text-indigo-600 mx-auto" />
                    <p className="text-xs font-bold text-slate-500">Cargando datos y analizando rechazo...</p>
                </div>
            ) : context && (
                <div className="space-y-4">
                    <CorrectionIssuesBanner
                        analysis={context.analysis}
                        liveHaciendaError={liveHaciendaError}
                        onSelectTab={setActiveTab}
                    />

                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200">
                        {tabs.map(t => {
                            const Icon = t.icon;
                            const count = issues.filter(i => i.tab === t.id).length;
                            const active = activeTab === t.id;
                            return (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setActiveTab(t.id)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                                        active ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    <Icon size={13} />
                                    <span>{t.label}</span>
                                    {count > 0 && (
                                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${active ? 'bg-white text-indigo-700' : 'bg-rose-500 text-white'}`}>
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="min-h-[260px]">
                        {activeTab === 'cliente' && (
                            <CorrectionClienteTab
                                dteType={dteType} customer={customer} onChangeCustomer={setCustomer}
                                customerBranch={context.customerBranch} syncBranchAddress={syncBranchAddress}
                                onChangeSyncBranch={setSyncBranchAddress} clienteNombreFallback={clienteNombreFallback}
                                onChangeClienteNombreFallback={setClienteNombreFallback}
                            />
                        )}
                        {activeTab === 'montos' && (
                            <CorrectionMontosTab
                                dteType={dteType} items={items} header={header} payments={payments}
                                preview={preview} adjustments={adjustments} recalculating={recalculating}
                                recalcRetPerc={recalcRetPerc} onToggleRetPerc={setRecalcRetPerc}
                                onChangeItems={setItems} onChangeHeader={setHeader} onChangePayments={setPayments}
                                onRunRecalculate={handleRunRecalculate}
                            />
                        )}
                        {activeTab === 'documentos' && (
                            <CorrectionDocumentosTab
                                dteType={dteType} customerId={context.sale?.customer_id}
                                linkedDocuments={linkedDocuments} onChangeLinkedDocuments={setLinkedDocuments}
                            />
                        )}
                        {activeTab === 'exportacion' && (
                            <CorrectionExportacionTab
                                dteType={dteType} exportacion={exportacion} remision={remision}
                                observaciones={observaciones} syncCustomerCountry={syncCustomerCountry}
                                onChangeExportacion={setExportacion} onChangeRemision={setRemision}
                                onChangeObservaciones={setObservaciones} onChangeSyncCustomerCountry={setSyncCustomerCountry}
                            />
                        )}
                    </div>

                    <CorrectionFooterBar
                        analysis={context.analysis}
                        canRegenerateDTE={canRegenerateDTE}
                        hasCodigoGeneracion={Boolean(context.sale?.codigo_generacion)}
                        updateDateTime={updateDateTime}
                        onToggleUpdateDateTime={setUpdateDateTime}
                        saving={saving}
                        onClose={onClose}
                        onAction={handleAction}
                    />
                </div>
            )}
        </Modal>
    );
}
