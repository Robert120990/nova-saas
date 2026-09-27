const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const number = (value, label, minimum = 0) => {
    const result = Number(value);
    if (value === null || value === undefined || value === '' || !Number.isFinite(result) || result < minimum) fail(`${label}: valor inválido.`);
    return result;
};
const normalizeCatalogCodes = codes => [...new Set((Array.isArray(codes) ? codes : String(codes || '').split(','))
    .map(code => String(code || '').trim()).filter(Boolean))];

function normalizeMaterials(materials) {
    if (!Array.isArray(materials) || !materials.length) fail('Seleccione materia prima aprobada para iniciar producción.');
    const grouped = new Map();
    for (const material of materials) {
        const id = number(material.raw_material_id, 'Materia prima', 1);
        if (!Number.isInteger(id)) fail('Materia prima inválida.');
        const quantity = number(material.quantity_lbs, 'Libras', 0.001);
        const boxes = number(material.boxes_count ?? material.total_boxes ?? 0, 'Cajas');
        if (!Number.isInteger(boxes)) fail('Las cajas deben ser enteras.');
        const previous = grouped.get(id) || { raw_material_id: id, quantity_lbs: 0, boxes_count: 0, tarimas: [] };
        previous.quantity_lbs += quantity;
        previous.boxes_count += boxes;
        if (Array.isArray(material.tarimas)) previous.tarimas.push(...material.tarimas);
        grouped.set(id, previous);
    }
    return [...grouped.values()].sort((a, b) => a.raw_material_id - b.raw_material_id);
}

async function owned(connection, table, id, companyId, lock = false) {
    const allowed = ['egg_raw_materials', 'egg_production_batches', 'egg_packaging_records', 'egg_scheduled_productions', 'egg_batch_remanentes', 'providers', 'branches', 'customers'];
    if (!allowed.includes(table)) fail('Entidad no permitida.');
    const [rows] = await connection.query(`SELECT * FROM ${table} WHERE id = ? AND company_id = ?${lock ? ' FOR UPDATE' : ''}`, [id, companyId]);
    if (!rows.length) fail('Registro no encontrado en la empresa seleccionada.', 404);
    return rows[0];
}

function evaluatePasteurization(productType, temperature, seconds) {
    const profiles = { 'huevo entero': 64, 'clara': 56.5, 'yema': 65, 'yema salada': 65, 'yema azucarada': 65 };
    // Nuevas formulaciones necesitan un perfil validado; no se infieren umbrales.
    const products = String(productType || '').toLowerCase().split(',').map(p => p.trim());
    const temperatureValue = number(temperature, 'Temperatura');
    const duration = number(seconds, 'Tiempo de retención', 0.001);
    const unknown = products.filter(p => profiles[p] === undefined);
    if (unknown.length) return { compliant: false, reason: `Producto sin perfil térmico validado: ${unknown.join(', ')}.` };
    const minimum = Math.max(...products.map(p => profiles[p]));
    const compliant = temperatureValue >= minimum && duration >= 200;
    return { compliant, reason: compliant ? null : `Desviación del perfil: mínimo ${minimum} °C y 200 segundos.` };
}

function evaluateLab(body) {
    const numeric = (key, alias) => {
        const value = body[key] ?? body[alias];
        return value === null || value === undefined || value === '' ? null : number(value, key);
    };
    const aero = numeric('mesophilic_aerobic_cfu', 'mesofilos_aerobios');
    const coli = numeric('total_coliforms_mpn', 'coliformes_totales');
    const ecoli = numeric('e_coli_mpn', 'escherichia_coli');
    const fungi = numeric('fungi_yeasts_cfu', 'hongos_levaduras');
    const salmonella = String(body.salmonella_25g ?? body.salmonella_spp ?? '').toLowerCase();
    const staph = String(body.staph_aureus ?? '').toLowerCase();
    const rejected = salmonella.includes('presencia') || /positi|presencia/.test(staph) || aero > 1000 || coli > 10 || body.fq_status === 'rechazado' || body.mb_status === 'rechazado';
    const complete = [aero, coli, ecoli, fungi].every(v => v !== null) && salmonella === 'ausencia' && ['negativo', 'ausencia'].includes(staph)
        && [body.ph, body.brix, body.solids_percentage ?? body.solidos_totales_pct].every(v => v !== '' && v != null && Number.isFinite(Number(v)));
    const released = complete && !rejected && body.fq_status === 'aprobado' && body.mb_status === 'aprobado';
    return {
        fq: body.fq_status || 'pendiente', mb: rejected ? 'rechazado' : (body.mb_status || 'pendiente'),
        release: rejected ? 'bloqueado_haccp' : released ? 'liberado' : 'cuarentena',
        status: rejected ? 'rechazado' : released ? 'aprobado' : 'cuarentena'
    };
}

module.exports = { fail, number, normalizeCatalogCodes, normalizeMaterials, owned, evaluatePasteurization, evaluateLab };
