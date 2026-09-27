import { useInventoryModel, InventoryHeader, InventoryFiltersBar, InventoryContent, InventoryActionBar, InventorySection5 } from '../../components/egg/inventory';


export default function EggInventory() {
 const model = useInventoryModel();

 return (<div className="space-y-6 animate-in fade-in duration-300 pb-12">
            {/* Header del módulo de Inventario Traducido */}
            <InventoryHeader model={model} />

            {/* BANNER DE ADVERTENCIA SI HAY PRODUCTOS SIN VINCULAR */}
            <InventoryFiltersBar model={model} />

            {/* KPI CARDS RESUMEN */}
            <InventoryContent model={model} />

            {/* Barra de Búsqueda y Filtros de Inventario */}
            <InventoryActionBar model={model} />

            {/* TABLA PRINCIPAL DE INVENTARIO TRADUCIDO (SIN COLUMNAS TIPO Y PRESENTACIÓN) */}
            <InventorySection5 model={model} />
        </div>);
}
