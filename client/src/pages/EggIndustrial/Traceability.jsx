import { useTraceabilityModel, TraceabilitySolidsTab, TraceabilityIsEmailModalOpenModal, TraceabilityIsParamModalOpenModal, TraceabilityParamsTab, TraceabilityIsQualityLetterModalOpenModal, TraceabilityLabTab, TraceabilityTraceTab, TraceabilityIsDetailModalOpenModal, TraceabilityHeader } from '../../components/egg/traceability';


import { EggQualityFinishedProductModal } from '../../components/egg/quality';
export default function EggTraceability() {
 const model = useTraceabilityModel();
 const { qualityModal, setQualityModal, fetchBatchesAndLab, fetchTrace360List, fetchTrace360Stats } = model;
 return (<div className="space-y-6 text-slate-900">
            {/* Header */}
            <TraceabilityHeader model={model} />

            {/* TAB 1: TRAZABILIDAD 360° */}
            <TraceabilityTraceTab model={model} />

            {/* TAB 2: CONTROL MICROBIOLÓGICO (LAB-004) & EMISIÓN/DESPACHO DE COA */}
            <TraceabilityLabTab model={model} />

            {/* TAB 3: PARÁMETROS & NORMAS COA */}
            <TraceabilityParamsTab model={model} />

            {/* TAB 4: CALCULADORA DE SÓLIDOS HE PLUS */}
            <TraceabilitySolidsTab model={model} />

            {/* MODAL CONTROL DE CALIDAD OFICIAL MARIO 2025 (FQ / MB / LIBERACIÓN) */}
            <EggQualityFinishedProductModal
                open={qualityModal.isOpen}
                onClose={() => setQualityModal({ isOpen: false, batch: null, logId: null })}
                batch={qualityModal.batch}
                logId={qualityModal.logId}
                onSuccess={() => {
                    fetchBatchesAndLab();
                    fetchTrace360List();
                    fetchTrace360Stats();
                }}
            />

            {/* MODAL ENVIAR CORREO UNIFICADO AL CLIENTE (MULTI-LOTE) */}
            <TraceabilityIsEmailModalOpenModal model={model} />

            {/* MODAL CREAR / EDITAR PARÁMETRO DE CALIDAD */}
            <TraceabilityIsParamModalOpenModal model={model} />

            {/* MODAL: INSPECCIÓN FORENSE 360° (LUPA) */}
            <TraceabilityIsDetailModalOpenModal model={model} />

            {/* MODAL: CARTA DE CALIDAD MULTI-FORMATO (PDF, WORD, EXCEL) */}
            <TraceabilityIsQualityLetterModalOpenModal model={model} />
        </div>);
}
