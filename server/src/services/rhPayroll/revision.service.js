const { createHash } = require('node:crypto');

const headerFields = [
    'dias_trabajados', 'sueldo_base', 'bonificacion_fija', 'total_percepciones',
    'total_deducciones', 'descuento_isss', 'descuento_afp', 'descuento_renta', 'monto_recibir'
];

function payrollRevision(planilla, detalles = []) {
    const header = headerFields.map(field => Number(planilla[field] ?? 0));
    const rows = detalles.map(detail => [
        Number(detail.cuenta_id), String(detail.codigo ?? ''), String(detail.descripcion ?? ''),
        detail.operacion, detail.tipo_valor, Number(detail.valor_base ?? 0),
        Number(detail.valor_ingresado ?? 0), Number(detail.orden ?? 0)
    ]).map(row => JSON.stringify(row)).sort();
    return createHash('sha256').update(JSON.stringify([planilla.estado || 'pendiente', header, rows])).digest('hex');
}

async function readRevision(connection, id, companyId) {
    const [rows] = await connection.query(
        'SELECT * FROM rh_planillas WHERE id = ? AND company_id = ?', [id, companyId]
    );
    if (!rows.length) return null;
    const [details] = await connection.query(
        'SELECT * FROM rh_planilla_detalles WHERE planilla_id = ?', [id]
    );
    return payrollRevision(rows[0], details);
}

async function ensureExpectedRevision(connection, id, companyId, expectedRevision, response) {
    if (expectedRevision === undefined || expectedRevision === null) return true;
    const revision = await readRevision(connection, id, companyId);
    if (revision === expectedRevision) return true;
    response.status(409).json({
        message: 'Esta planilla cambió desde que la abrió. Vuelva a cargarla antes de guardar para conservar los cambios registrados.',
        revision
    });
    return false;
}

module.exports = { payrollRevision, readRevision, ensureExpectedRevision };
