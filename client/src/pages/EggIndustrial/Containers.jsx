import {
    useContainersModel,
    ContainersHeader,
    ContainersCutoffBar,
    ContainersSummaryCards,
    ContainersGrid,
    ContainersTableSection,
    ContainerFormModal,
    ContainerCutoffModal
} from '../../components/egg/containers';
import PdfViewerModal from '../../components/ui/PdfViewerModal';

export default function EggContainers() {
    const model = useContainersModel();
    const {
        containers,
        summary,
        cutoffChain,
        periodStart,
        setPeriodStart,
        periodEnd,
        setPeriodEnd,
        customerName,
        setCustomerName,
        modalState,
        closeModal,
        handleModalSave,
        cutoffModalOpen,
        setCutoffModalOpen,
        createCutoffMutation,
        pdfViewer,
        closePdfViewer,
        handleOpenStatementPdf,
        isMutating
    } = model;

    const maxContainerNumber = containers.reduce(
        (max, c) => Math.max(max, Number(c.container_number) || 0),
        10
    );

    return (
        <div className="space-y-4 sm:space-y-6 text-slate-900">
            {/* Encabezado Principal con Tarifa Diaria ($195 + IVA) y Botón Adicionar */}
            <ContainersHeader model={model} />

            {/* Panel de Estado de Cuenta al Cliente y Corte por Fechas (Parte desde el último corte) */}
            <ContainersCutoffBar model={model} />

            {/* Tarjetas Visuales de Disponibilidad, Encendidos, Días y Cobro Total */}
            <ContainersSummaryCards model={model} />

            {/* Representación Gráfica de los Contenedores (10 iniciales + adicionados) */}
            <ContainersGrid model={model} />

            {/* Tabla Ordenable de Estados de Cuenta Emitidos, Período Actual y Bitácora */}
            <ContainersTableSection model={model} />

            {/* Modal para Adicionar Contenedores, Editar Contenedor o Cambiar Tarifa Diaria */}
            <ContainerFormModal
                open={modalState.open}
                onClose={closeModal}
                onSave={handleModalSave}
                mode={modalState.mode}
                container={modalState.container}
                defaultDailyRate={summary.default_daily_rate}
                nextContainerNumber={maxContainerNumber + 1}
                isSubmitting={isMutating}
            />

            {/* Modal para Realizar Corte por Fechas y Emitir Estado de Cuenta */}
            <ContainerCutoffModal
                open={cutoffModalOpen}
                onClose={() => setCutoffModalOpen(false)}
                onConfirm={(payload) => createCutoffMutation.mutate(payload)}
                containers={containers}
                cutoffChain={cutoffChain}
                periodStart={periodStart}
                periodEnd={periodEnd}
                setPeriodStart={setPeriodStart}
                setPeriodEnd={setPeriodEnd}
                customerName={customerName}
                setCustomerName={setCustomerName}
                isSubmitting={createCutoffMutation.isPending}
            />

            {/* Visor Interactivo Oficial del Estado de Cuenta en PDF */}
            <PdfViewerModal
                isOpen={pdfViewer.isOpen}
                onClose={closePdfViewer}
                title={pdfViewer.title}
                subtitle={pdfViewer.subtitle}
                badge="Estado de Cuenta Oficial"
                pdfUrl={pdfViewer.pdfUrl}
                isLoading={pdfViewer.isLoading}
                error={pdfViewer.error}
                onRetry={() => handleOpenStatementPdf()}
                fileName={pdfViewer.fileName}
            />
        </div>
    );
}
