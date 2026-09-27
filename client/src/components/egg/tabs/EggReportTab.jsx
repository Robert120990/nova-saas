import { formatDate } from '../../../utils/dateUtils';

const definitions = {
    'raw-materials': [['provider_lot','Lote'],['reception_date','Fecha','date'],['provider_name','Proveedor'],['egg_type','Tipo'],['total_boxes','Cajas'],['weight_lbs','Recibido lb'],['stock_lbs','Saldo lb'],['egg_classification','Grado'],['status','Estado']],
    production: [['batch_code_display','Lote'],['started_at','Fecha','date'],['product_type','Producto'],['egg_broken_lbs','Entrada lb'],['total_boxes','Cajas'],['additional_ingredients_lbs','Insumos lb'],['net_egg_yield_lbs','Huevo neto lb'],['yield_per_box_lbs','lb/caja'],['pure_egg_yield_pct','Rendimiento huevo %'],['actual_output_lbs','Producido lb'],['packaged_weight_lbs','Envasado lb'],['yield_pct','Rendimiento total %'],['packaging_status','Envasado'],['status','Estado']],
    packaging: [['lot_code','Lote comercial'],['batch_code_display','Producción'],['created_at','Fecha','date'],['product_type','Producto'],['presentation','Presentación'],['units_packaged','Unidades producidas'],['total_batch_weight_lbs','Peso producido lb'],['quality_status','Calidad']],
    quality: [['provider_lot','Lote'],['provider_name','Proveedor'],['egg_classification','Grado'],['quality_status','Dictamen'],['quality_defect_broken_pct','Roto %'],['quality_defect_dirty_pct','Sucio %'],['quality_brix','Brix'],['quality_inspector_name','Inspector']],
    wastes: [['batch_code_display','Lote'],['created_at','Fecha','date'],['stage','Etapa'],['waste_type','Tipo'],['weight_lbs','Peso lb'],['operator_name','Operador'],['notes','Notas']]
};

export default function EggReportTable({ type, rows, loading, error }) {
    const columns = definitions[type] || [];
    if (loading) return <p className="p-4" role="status">Cargando reporte…</p>;
    if (error) return <p className="p-4 text-rose-700" role="alert">No se pudo cargar el reporte. Intente consultar nuevamente.</p>;
    return <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-xs"><thead className="bg-slate-100 text-slate-700"><tr>{(Array.isArray(columns) ? columns : []).map(([key,label]) => <th key={key} className="p-3 text-left whitespace-nowrap">{label}</th>)}</tr></thead>
            <tbody>{(Array.isArray(rows) ? rows : []).map((row,index) => <tr key={row.id || index} className="border-t border-slate-100">{(Array.isArray(columns) ? columns : []).map(([key,,kind]) => <td key={key} className="p-3 whitespace-nowrap">{kind === 'date' ? formatDate(row[key]) : row[key] ?? '—'}</td>)}</tr>)}</tbody>
        </table>
        {!rows?.length && <p className="p-4 text-slate-500">Sin registros para los filtros seleccionados.</p>}
    </div>;
}
