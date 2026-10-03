async function validateDetails(connection, companyId, details, response) {
    if (details === undefined) return true;
    if (!Array.isArray(details) || !details.length) {
        response.status(400).json({ message: 'La planilla debe contener un arreglo de detalles no vacío.' });
        return false;
    }
    const invalid = details.some(detail => !detail || !Number.isInteger(Number(detail.cuenta_id)) || Number(detail.cuenta_id) <= 0 ||
        !['sumar', 'restar'].includes(detail.operacion) || !['valor', 'dias', 'horas', 'porcentaje'].includes(detail.tipo_valor) ||
        !Number.isFinite(Number(detail.valor_ingresado ?? 0)) || !Number.isFinite(Number(detail.valor_base ?? detail.cantidad ?? 0)));
    if (invalid) {
        response.status(400).json({ message: 'Los detalles de planilla contienen valores o cuentas inválidos.' });
        return false;
    }
    const ids = [...new Set(details.map(detail => Number(detail.cuenta_id)))];
    const [accounts] = await connection.query(
        'SELECT id FROM rh_cuentas_planillas WHERE company_id = ? AND id IN (?)', [companyId, ids]
    );
    if (accounts.length !== ids.length) {
        response.status(400).json({ message: 'Todas las cuentas de planilla deben pertenecer a la empresa seleccionada.' });
        return false;
    }
    return true;
}

module.exports = { validateDetails };
