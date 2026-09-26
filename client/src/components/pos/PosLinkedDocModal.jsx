import axios from 'axios';
import { toast } from 'sonner';
import { X, ChevronRight, Trash2 } from 'lucide-react';
import Money from '../ui/Money';

/**
 * PosLinkedDocModal Component
 * References modal for DTEs (F9 shortcut).
 * Handles Notas de Crédito (DTE-05), Comprobantes de Retención (DTE-07),
 * document lookup, automatic discount prorating, and manual document linking.
 */
const PosLinkedDocModal = ({
    isOpen,
    onClose,
    tipoDte,
    customerId,
    isLoadingCustomerSales,
    customerSales = [],
    linkedDocs = [],
    setLinkedDocs,
    setReferencingSale,
    setCart,
    setGeneralDiscount,
    setGeneralDiscountPercentage
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col">
                <div className="p-4 md:p-8 border-b bg-slate-50/30 flex justify-between items-center">
                    <h3 className="text-2xl font-black text-slate-900">Referencias Documentales</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-xl shadow-sm">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-4 md:p-8 space-y-4">
                    {tipoDte === '05' && customerId ? (
                        <div className="flex flex-col gap-4">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                Seleccionar Documento del Cliente
                            </label>
                            <div className="max-h-60 overflow-y-auto custom-scrollbar border border-slate-100 rounded-2xl divide-y">
                                {isLoadingCustomerSales ? (
                                    <div className="p-8 text-center text-slate-400 text-xs font-bold animate-pulse">Cargando documentos...</div>
                                ) : customerSales.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400 text-xs font-bold">No se encontraron documentos previos para este cliente.</div>
                                ) : (
                                    customerSales.filter(s => ['01', '03', '07'].includes(s.dte_type)).map(sale => (
                                        <button 
                                            key={sale.id}
                                            onClick={async () => {
                                                try {
                                                    const { data: fullSale } = await axios.get(`/api/sales/${sale.id}`);
                                                    setReferencingSale(fullSale);
                                                    const refDoc = fullSale.codigo_generacion || sale.codigo_generacion || fullSale.numero_control || sale.numero_control || sale.dte_control || sale.id.toString();
                                                    const isElectronic = !!(fullSale.codigo_generacion || sale.codigo_generacion);
                                                    
                                                    // Prorratear descuento general si la venta original tuvo alguno
                                                    const origGenDiscount = parseFloat(fullSale.descuento_general) || 0;
                                                    const saleItems = fullSale.items || [];

                                                    let totalGravBase = 0;
                                                    const itemBases = saleItems.map(item => {
                                                        const qty = parseFloat(item.cantidad) || 0;
                                                        const price = parseFloat(item.precio_unitario) || 0;
                                                        const disc = parseFloat(item.monto_descuento) || 0;
                                                        const isExento = item.venta_exenta > 0;
                                                        const lineBase = isExento ? 0 : Math.max(0, (qty * price) - disc);
                                                        totalGravBase += lineBase;
                                                        return lineBase;
                                                    });

                                                    let allocatedDisc = 0;
                                                    const gravCount = itemBases.filter(b => b > 0).length;
                                                    let currentGravIndex = 0;

                                                    // Cargar items al carrito con sus descuentos correspondientes
                                                    const newItems = saleItems.map((item, idx) => {
                                                        const qty = parseFloat(item.cantidad) || 0;
                                                        const price = parseFloat(item.precio_unitario) || 0;
                                                        const origItemDisc = parseFloat(item.monto_descuento) || 0;
                                                        const lineBase = itemBases[idx];

                                                        let prorratedGenDisc = 0;
                                                        if (origGenDiscount > 0 && lineBase > 0) {
                                                            currentGravIndex++;
                                                            if (currentGravIndex === gravCount) {
                                                                prorratedGenDisc = Math.max(0, Math.round((origGenDiscount - allocatedDisc) * 100) / 100);
                                                            } else {
                                                                const share = totalGravBase > 0 ? (lineBase / totalGravBase) : (1 / gravCount);
                                                                prorratedGenDisc = Math.round((origGenDiscount * share) * 100) / 100;
                                                                allocatedDisc += prorratedGenDisc;
                                                            }
                                                        }

                                                        const totalItemDisc = Math.round((origItemDisc + prorratedGenDisc) * 100) / 100;
                                                        const unitDisc = qty > 0 ? (totalItemDisc / qty) : 0;

                                                        return {
                                                            id: item.product_id,
                                                            nombre: item.descripcion,
                                                            codigo: item.codigo,
                                                            precio: price,
                                                            originalPrice: price,
                                                            cantidad: qty,
                                                            originalQty: qty,
                                                            descuento: totalItemDisc,
                                                            unitDiscount: unitDisc,
                                                            exento: item.venta_exenta > 0,
                                                            isManual: !item.product_id,
                                                            referencedDoc: refDoc
                                                        };
                                                    });
                                                    setCart(newItems);
                                                    setGeneralDiscount(0);
                                                    setGeneralDiscountPercentage(null);

                                                    // Vincular documento
                                                    setLinkedDocs([{
                                                        doc_type: sale.dte_type,
                                                        doc_number: refDoc,
                                                        control_number: fullSale.numero_control || sale.numero_control || sale.dte_control || null,
                                                        emission_date: sale.fecha_emision.split('T')[0],
                                                        generation_type: isElectronic ? 1 : 2
                                                    }]);
                                                    
                                                    onClose();
                                                    toast.success('Documento referenciado y productos cargados');
                                                } catch (error) {
                                                    toast.error('Error al cargar detalle del documento');
                                                }
                                            }}
                                            className="w-full p-4 flex items-center justify-between hover:bg-indigo-50 transition-colors text-left group"
                                        >
                                            <div>
                                                <div className="font-black text-slate-900 text-xs tracking-tight group-hover:text-indigo-600 transition-colors">
                                                    {sale.tipo_documento_name} - {sale.numero_control || sale.dte_control || sale.codigo_generacion || `ID: ${sale.id}`}
                                                </div>
                                                <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                                                    {new Date(sale.fecha_emision).toLocaleDateString()} • TOTAL: <Money value={sale.total_pagar} />
                                                </div>
                                            </div>
                                            <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-400 transition-colors" />
                                        </button>
                                    ))
                                )}
                            </div>
                            <div className="relative flex items-center gap-2">
                                <div className="flex-1 h-[1px] bg-slate-100"></div>
                                <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">O entrada manual</span>
                                <div className="flex-1 h-[1px] bg-slate-100"></div>
                            </div>
                        </div>
                    ) : null}

                    {tipoDte === '07' ? (
                        /* CR: formulario con campos de retención */
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <select id="link-type" className="p-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500/20">
                                    <option value="01">Factura (01)</option>
                                    <option value="03">Créd. Fiscal (03)</option>
                                </select>
                                <select id="link-gen-type" className="p-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500/20">
                                    <option value="1">Físico</option>
                                    <option value="2">Electrónico</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <input id="link-number" className="p-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="Número de Documento" />
                                <div>
                                    <input 
                                        id="link-date" 
                                        type="date" 
                                        min={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`}
                                        max={new Date().toISOString().split('T')[0]}
                                        defaultValue={new Date().toISOString().split('T')[0]} 
                                        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500/20" 
                                    />
                                    <span className="text-[9px] text-indigo-500 font-semibold ml-1 block mt-0.5">
                                        * Período actual: {new Date().toLocaleDateString('es-SV', { month: 'long', year: 'numeric' })}
                                    </span>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[8px] font-black text-slate-400 uppercase ml-1 block mb-1">Monto Gravado ($)</label>
                                    <input id="link-gravadas" type="number" step="0.01" className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="0.00" onChange={(e) => {
                                        const grav = parseFloat(e.target.value) || 0;
                                        const retEl = document.getElementById('link-retencion');
                                        if (retEl) retEl.value = (grav * 0.01).toFixed(2);
                                    }} />
                                </div>
                                <div>
                                    <label className="text-[8px] font-black text-slate-400 uppercase ml-1 block mb-1">Retención 1% ($)</label>
                                    <input id="link-retencion" type="number" step="0.01" className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-rose-500/20 text-rose-600" placeholder="0.00" />
                                </div>
                            </div>
                            <button 
                                onClick={async () => {
                                    const typeEl = document.getElementById('link-type');
                                    const genTypeEl = document.getElementById('link-gen-type');
                                    const numEl = document.getElementById('link-number');
                                    const dateEl = document.getElementById('link-date');
                                    const gravadasEl = document.getElementById('link-gravadas');
                                    const retencionEl = document.getElementById('link-retencion');

                                    const type = typeEl?.value;
                                    const genType = parseInt(genTypeEl?.value) || 2;
                                    const num = numEl?.value?.trim();
                                    const date = dateEl?.value;
                                    const gravadas = parseFloat(gravadasEl?.value) || 0;
                                    const retencion = parseFloat(retencionEl?.value) || 0;

                                    if(!num) return toast.error('El número de documento es obligatorio');
                                    if(!date) return toast.error('La fecha del documento es obligatoria');

                                    // Validación de período tributario para Comprobante de Retención (DTE-07)
                                    const todayStr = new Date().toISOString().split('T')[0];
                                    const currentPeriod = todayStr.substring(0, 7); // YYYY-MM
                                    const docPeriod = date.substring(0, 7); // YYYY-MM

                                    if (docPeriod !== currentPeriod) {
                                        return toast.error(`El documento a retener debe corresponder al mismo período tributario (${currentPeriod}). Hacienda rechaza comprobantes de retención para documentos de otros meses.`);
                                    }

                                    if (date > todayStr) {
                                        return toast.error('La fecha del documento a retener no puede ser una fecha futura');
                                    }

                                    if(gravadas < 100) return toast.error('El monto gravado debe ser mayor o igual a $100.00');
                                    if(retencion <= 0) return toast.error('La retención debe ser mayor a $0.00');
                                    // Validar que no esté duplicado en el CR actual
                                    if(linkedDocs.some(d => d.doc_number === num && d.doc_type === type)) {
                                        return toast.error('Este documento ya fue agregado al CR');
                                    }
                                    // Validar que no exista otro CR para este documento
                                    try {
                                        const { data: checkData } = await axios.get(`/api/sales/check-cr?doc_number=${encodeURIComponent(num)}&doc_type=${type}`);
                                        if (checkData.exists) {
                                            return toast.error(`Ya existe un Comprobante de Retención para el documento ${num}`);
                                        }
                                    } catch (err) {
                                        console.warn('No se pudo verificar CR existente:', err.message);
                                    }
                                    const dteName = type === '01' ? 'Factura' : type === '03' ? 'Créd. Fiscal' : 'DTE ' + type;
                                    const descripcion = `RETENCION IVA 1% AL DOCUMENTO ${num} (${dteName})`;
                                    setLinkedDocs([...linkedDocs, { 
                                        doc_type: type, 
                                        doc_number: num, 
                                        emission_date: date, 
                                        generation_type: genType,
                                        montoSujeto: gravadas,
                                        ivaRetenido: retencion,
                                        descripcion: descripcion
                                    }]);
                                    if (numEl) numEl.value = '';
                                    if (gravadasEl) gravadasEl.value = '';
                                    if (retencionEl) retencionEl.value = '';
                                    toast.success('Documento agregado');
                                }}
                                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-black transition-all active:scale-95"
                            >
                                Agregar Documento
                            </button>
                        </div>
                    ) : (
                        /* Formulario estándar para otros tipos de DTE */
                        <>  
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <select id="link-type" className="p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/20" defaultValue={tipoDte === '05' ? '01' : '01'}>
                                    <option value="01">Factura</option>
                                    <option value="03">C. Fiscal</option>
                                    <option value="07">C. Retención</option>
                                </select>
                                <input id="link-date" type="date" className="p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/20" defaultValue={new Date().toISOString().split('T')[0]} />
                            </div>
                            <input id="link-number" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="UUID o Número de Documento" />
                            <button 
                                onClick={() => {
                                    const typeEl = document.getElementById('link-type');
                                    const numEl = document.getElementById('link-number');
                                    const dateEl = document.getElementById('link-date');

                                    const type = typeEl?.value;
                                    const num = numEl?.value?.trim()?.toUpperCase();
                                    const date = dateEl?.value;
                                    if(!num) return toast.error('El número es obligatorio');
                                    const isUUID = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/.test(num);
                                    setLinkedDocs([...linkedDocs, { 
                                        doc_type: type, 
                                        doc_number: num, 
                                        emission_date: date, 
                                        generation_type: isUUID ? 1 : 2 
                                    }]);
                                    if (numEl) numEl.value = '';
                                }}
                                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-black transition-all active:scale-95"
                            >
                                Vincular Manualmente
                            </button>
                        </>
                    )}
                </div>

                <div className="mt-8 border-t pt-6 space-y-2 max-h-48 overflow-y-auto custom-scrollbar px-4 md:px-8 pb-6">
                    {linkedDocs.map((doc, idx) => (
                        <div key={idx} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="truncate pr-4">
                                <div className="font-black text-sm truncate">{doc.control_number || doc.doc_number}</div>
                                {doc.control_number && doc.doc_number !== doc.control_number && (
                                    <div className="text-[10px] text-slate-400 font-mono truncate">{doc.doc_number}</div>
                                )}
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    {doc.doc_type === '01' ? 'Factura' : doc.doc_type === '03' ? 'C. Fiscal' : 'DTE ' + doc.doc_type} • {doc.emission_date}
                                    {tipoDte === '07' && doc.montoSujeto ? ` • Grav $${parseFloat(doc.montoSujeto).toFixed(2)}` : ''}
                                    {tipoDte === '07' && doc.ivaRetenido ? ` • Ret $${parseFloat(doc.ivaRetenido).toFixed(2)}` : ''}
                                </div>
                            </div>
                            <button onClick={() => setLinkedDocs(linkedDocs.filter((_, i) => i !== idx))} className="text-rose-400 p-2 hover:bg-rose-50 rounded-xl transition-colors">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                    {linkedDocs.length === 0 && (
                        <p className="text-center py-8 text-slate-300 font-bold uppercase text-[10px] tracking-widest italic">
                            No hay documentos vinculados
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PosLinkedDocModal;
