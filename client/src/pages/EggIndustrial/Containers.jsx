import {
    useContainersModel,
    ContainersHeader,
    ContainersSummaryCards,
    ContainersGrid,
    ContainersTableSection,
    ContainerFormModal
} from '../../components/egg/containers';

export default function EggContainers() {
    const model = useContainersModel();
    const {
        containers,
        summary,
        modalState,
        closeModal,
        handleModalSave,
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

            {/* Tarjetas Visuales de Disponibilidad, Encendidos, Días y Cobro Total */}
            <ContainersSummaryCards model={model} />

            {/* Representación Gráfica de los Contenedores (10 iniciales + adicionados) */}
            <ContainersGrid model={model} />

            {/* Tabla Ordenable de Liquidación y Bitácora de Ciclos */}
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
        </div>
    );
}
