import { useState } from 'react';
import {
    Landmark,
    Receipt,
    Coins,
    Copy,
    Check,
    ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import Modal from '../ui/Modal';
import Money from '../ui/Money';
import HaciendaF07Tab from './HaciendaF07Tab';
import HaciendaF11Tab from './HaciendaF11Tab';

const HaciendaDeclarationModal = ({ isOpen, onClose, data }) => {
    const [activeTab, setActiveTab] = useState('f11');
    const [copiedAll, setCopiedAll] = useState(false);

    if (!isOpen || !data) return null;

    const meta = data.meta || {};
    const company = meta.company || {};
    const debito = data.debito_fiscal?.totales || {};
    const credito = data.credito_fiscal?.totales || {};
    const liq = data.liquidacion_iva || {};
    const pc = data.pago_cuenta || {};
    const pcTotales = pc.totales || {};
    const resumenF07 = data.resumen_f07 || {};

    const isPersonaNatural = Boolean(meta.isPersonaNatural);
    const tipoContribuyente = company.tipo_contribuyente || 'Otros';
    const isGranContribuyente = tipoContribuyente.toLowerCase() === 'grande';

    const handleCopyFullSummary = () => {
        const lines = [
            `============================================================`,
            `GUÍA DE DECLARACIÓN HACIENDA (DGII) - EL SALVADOR`,
            `============================================================`,
            `Contribuyente : ${company.razon_social || '---'}`,
            `NIT           : ${company.nit || '---'}`,
            `NRC           : ${company.nrc || '---'}`,
            `Período       : ${meta.periodText || '---'}`,
            `Clasificación : ${tipoContribuyente} | ${isPersonaNatural ? 'Persona Natural' : 'Persona Jurídica'}`,
            `Ámbito        : ${meta.branchName || 'Consolidado'}`,
            `------------------------------------------------------------`,
            `1. FORMULARIO F-11 (DECLARACIÓN MENSUAL DE IVA)`,
            `------------------------------------------------------------`,
            `[01] Ventas Gravadas CCF         : Base $${(data.debito_fiscal?.ccf?.gravado || 0).toFixed(2)} | IVA $${(data.debito_fiscal?.ccf?.iva || 0).toFixed(2)}`,
            `[02] Ventas Gravadas FCF/Tickets : Base $${(data.debito_fiscal?.fcf?.gravado || 0).toFixed(2)} | IVA $${(data.debito_fiscal?.fcf?.iva || 0).toFixed(2)}`,
            `[03] Ventas Exentas / No Sujetas : Base $${((debito.ventas_exentas_netas || 0) + (debito.ventas_nosujetas_netas || 0)).toFixed(2)}`,
            `[--] Total Débito Fiscal         : $${(debito.neto || 0).toFixed(2)}`,
            ``,
            `[10] Compras Gravadas CCF        : Base $${(credito.compras_gravadas_netas || 0).toFixed(2)} | IVA $${(credito.neto || 0).toFixed(2)}`,
            `[11] Compras Exentas/No Sujetas  : Base $${((credito.compras_exentas_netas || 0) + (credito.compras_nosujetas_netas || 0)).toFixed(2)}`,
            `[--] Total Crédito Fiscal        : $${(credito.neto || 0).toFixed(2)}`,
            ``,
            `[*] Impuesto Determinado         : $${(liq.impuesto_determinado || 0).toFixed(2)}`,
            `[*] Remanente del Mes            : $${(liq.remanente_credito_mes || 0).toFixed(2)}`,
            `[20] Remanente Meses Anteriores  : $${(liq.remanente_anterior || 0).toFixed(2)}`,
            `[21] Retenciones IVA Sufridas 1% : $${(liq.retenciones_iva_sufridas || 0).toFixed(2)}`,
            `[22] Percepciones Soportadas 1%  : $${(liq.percepciones_iva_soportadas || 0).toFixed(2)}`,
            `[40] Retención Sujetos Excluidos : $${(liq.retenciones_sujetos_excluidos || 0).toFixed(2)}`,
            `TOTAL MANDAMIENTO F-11 A PAGAR   : $${(liq.total_iva_a_enterar || 0).toFixed(2)}`,
            `NUEVO REMANENTE CRÉDITO A FAVOR  : $${(liq.nuevo_remanente_credito || 0).toFixed(2)}`,
            `------------------------------------------------------------`,
            `2. FORMULARIO F-07 (PAGO A CUENTA E IMPUESTO RETENIDO)`,
            `------------------------------------------------------------`,
            `[10] Base Comercio / Serv (1.75%): $${(pc.otros?.ingreso_bruto_neto || 0).toFixed(2)} -> Cuota: $${(pc.otros?.cuota_calculada || 0).toFixed(2)}`,
            `[15] Base Combustibles (${meta.fuelRate}%)  : $${(pc.combustibles?.ingreso_bruto_neto || 0).toFixed(2)} -> Cuota: $${(pc.combustibles?.cuota_calculada || 0).toFixed(2)}`,
            `[--] Anticipo Determinado        : $${(pcTotales.subtotal_pago_cuenta || 0).toFixed(2)}`,
            `[-]  Retenciones Renta Sufridas  : $${(pcTotales.retenciones_renta_sufridas || 0).toFixed(2)}`,
            `[-]  Anticipo en Liquidaciones   : $${(pcTotales.anticipo_cuenta_liquidaciones || 0).toFixed(2)}`,
            `TOTAL MANDAMIENTO F-07 A PAGAR   : $${(pcTotales.pago_cuenta_a_pagar || 0).toFixed(2)}`,
            `REMANENTE PAGO CUENTA A FAVOR    : $${(pcTotales.remanente_pago_cuenta || 0).toFixed(2)}`,
            `============================================================`,
            `TOTAL GENERAL F-07 + F-11        : $${(resumenF07.total_f07 || 0).toFixed(2)}`,
            `============================================================`
        ].join('\n');

        navigator.clipboard.writeText(lines);
        setCopiedAll(true);
        toast.success('Resumen completo para Hacienda copiado al portapapeles');
        setTimeout(() => setCopiedAll(false), 2500);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex items-center gap-2 text-slate-900">
                    <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                        <Landmark size={18} />
                    </div>
                    <span>Guía para Declaración en Hacienda (DGII)</span>
                </div>
            }
            maxWidth="max-w-4xl"
        >
            <div className="space-y-4">
                {/* Ficha Tributaria del Contribuyente */}
                <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/70">
                        <div>
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                                Razón Social / Nombre Registrado
                            </span>
                            <h4 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                                {company.razon_social || 'Empresa Emisora'}
                            </h4>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                NIT: <strong className="font-mono text-slate-700">{company.nit || '---'}</strong> | NRC: <strong className="font-mono text-slate-700">{company.nrc || '---'}</strong>
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                            {/* Badge Tipo Persona */}
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white text-slate-700 border border-slate-200 shadow-xs">
                                {isPersonaNatural ? '👤 Persona Natural' : '🏢 Persona Jurídica'}
                            </span>
                            {/* Badge Clasificación */}
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-xs ${
                                isGranContribuyente
                                    ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                    : 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                            }`}>
                                {isGranContribuyente ? '⭐ Gran Contribuyente' : `📌 ${tipoContribuyente} Contribuyente`}
                            </span>
                            {/* Badge Período */}
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-slate-800 text-white shadow-xs">
                                {meta.periodText}
                            </span>
                        </div>
                    </div>

                    {/* Resumen Superior Rápido F-11 + F-07 */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 text-xs">
                        <div className="bg-white p-2 rounded-xl border border-slate-100">
                            <span className="text-[9.5px] font-bold text-slate-400 uppercase block">Total IVA a Enterar (F-11)</span>
                            <span className="text-sm font-black text-emerald-600 block mt-0.5">
                                <Money value={liq.total_iva_a_enterar || 0} />
                            </span>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-slate-100">
                            <span className="text-[9.5px] font-bold text-slate-400 uppercase block">Pago a Cuenta (F-07)</span>
                            <span className="text-sm font-black text-indigo-600 block mt-0.5">
                                <Money value={pcTotales.pago_cuenta_a_pagar || 0} />
                            </span>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-slate-100">
                            <span className="text-[9.5px] font-bold text-slate-400 uppercase block">Remanente IVA Mes</span>
                            <span className="text-sm font-black text-slate-700 block mt-0.5">
                                <Money value={liq.nuevo_remanente_credito || 0} />
                            </span>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-indigo-100 bg-indigo-50/30">
                            <span className="text-[9.5px] font-bold text-indigo-600 uppercase block">Total Ambos Formularios</span>
                            <span className="text-sm font-black text-indigo-900 block mt-0.5">
                                <Money value={resumenF07.total_f07 || 0} />
                            </span>
                        </div>
                    </div>
                </div>

                {/* Selector de Pestañas del Modal */}
                <div className="flex border-b border-slate-200">
                    <button
                        type="button"
                        onClick={() => setActiveTab('f11')}
                        className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                            activeTab === 'f11'
                                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <Receipt size={15} />
                        <span>Formulario F-11 (Declaración de IVA)</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('f07')}
                        className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                            activeTab === 'f07'
                                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <Coins size={15} />
                        <span>Formulario F-07 (Pago a Cuenta / Renta)</span>
                    </button>
                </div>

                {/* Contenido de la Pestaña Activa */}
                <div className="pt-1">
                    {activeTab === 'f11' ? (
                        <HaciendaF11Tab data={data} />
                    ) : (
                        <HaciendaF07Tab data={data} />
                    )}
                </div>

                {/* Barra Inferior de Acciones */}
                <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <a
                        href="https://portaldgii.mh.gob.sv/"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
                    >
                        <Landmark size={14} />
                        <span>Ir al Portal DGII (Declaraciones en Línea)</span>
                        <ExternalLink size={12} />
                    </a>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                            type="button"
                            onClick={handleCopyFullSummary}
                            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                            {copiedAll ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            <span>{copiedAll ? '¡Copiado!' : 'Copiar Resumen para Declaración'}</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-colors cursor-pointer"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default HaciendaDeclarationModal;
