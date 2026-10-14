const pool = require('../server/src/config/db');

async function up() {
    console.log('[Migration v290] Verificando e importando gastos faltantes de Raúl Sosa (Empresa 2) desde db_control_iva...');

    // 1. Obtener sucursales en destino (Empresa 2)
    const [targetBranches] = await pool.query(`
        SELECT id, nombre, codigo 
        FROM branches 
        WHERE company_id = 2
    `);

    // 2. Obtener sucursales en origen (cod_emp = 3) para guiarse por el NOMBRE
    const [originBranches] = await pool.query(`
        SELECT id as cod_sucursal, descripcion as nombre_sucursal
        FROM db_control_iva.sucursales
        WHERE cod_emp = 3
    `);

    const branchMapByOriginCode = {};
    for (const ob of originBranches) {
        const desc = (ob.nombre_sucursal || '').toUpperCase();
        let matchedTarget = null;

        if (desc.includes('SUPER') || desc.includes('PEDREGAL')) {
            matchedTarget = targetBranches.find(tb => tb.nombre.toUpperCase().includes('PEDREGAL') || tb.nombre.toUpperCase().includes('SUPER'));
        } else if (desc.includes('CHALCHUAPA')) {
            matchedTarget = targetBranches.find(tb => tb.nombre.toUpperCase().includes('CHALCHUAPA'));
        } else if (desc.includes('MIRAFLORES')) {
            matchedTarget = targetBranches.find(tb => tb.nombre.toUpperCase().includes('CHALCHUAPA'));
        }

        if (matchedTarget) {
            branchMapByOriginCode[ob.cod_sucursal] = {
                branch_id: matchedTarget.id,
                target_nombre: matchedTarget.nombre,
                origin_nombre: ob.nombre_sucursal
            };
        }
    }

    // 3. Proveedores en destino para Empresa 2
    const [targetProviders] = await pool.query(`
        SELECT id, nombre, nrc, nit 
        FROM providers 
        WHERE company_id = 2 AND (nrc IN ('471-5', '164936-4') OR nombre LIKE '%CASCADA%' OR nombre LIKE '%COBEA%')
    `);

    const cascadaProv = targetProviders.find(p => p.nrc === '471-5' || p.nombre.toUpperCase().includes('CASCADA'));
    const cobeaProv = targetProviders.find(p => p.nrc === '164936-4' || p.nombre.toUpperCase().includes('COBEA'));

    if (!cascadaProv || !cobeaProv) {
        console.warn('  ⚠️ No se encontraron los proveedores destino para La Cascada o Cobea en Empresa 2.');
        return;
    }

    const providerMap = {
        '471-5': cascadaProv.id,
        '164936-4': cobeaProv.id
    };

    // 4. Buscar registros pendientes (NOT EXISTS)
    const [missing] = await pool.query(`
        SELECT src.*,
               p_src.nom_proveedor, p_src.registro as p_nrc, p_src.nit_proveedor as p_nit
        FROM db_control_iva.compras_iva src
        LEFT JOIN db_control_iva.proveedores p_src ON src.cod_proveedor = p_src.cod_proveedor AND src.cod_emp = p_src.cod_emp
        WHERE src.cod_emp = 3 AND src.periodo_ano = 2026
          AND NOT EXISTS (
              SELECT 1 FROM expense_headers eh
              WHERE eh.company_id = 2
                AND eh.tipo_documento_id = src.id_tipo_documento
                AND eh.numero_documento = src.documento
                AND eh.fecha = src.fecha
          )
        ORDER BY src.fecha ASC
    `);

    if (missing.length === 0) {
        console.log('  → Todos los gastos de Raúl Sosa (Empresa 2) ya se encuentran sincronizados (0 faltantes).');
        return;
    }

    console.log(`  → Importando ${missing.length} gastos pendientes guiados por el nombre de sucursal...`);

    let count = 0;
    for (const r of missing) {
        const branchMapping = branchMapByOriginCode[r.cod_sucursal];
        const providerId = providerMap[r.p_nrc];

        if (!branchMapping || !providerId) continue;

        const totalGravada = parseFloat(r.gravadas_locales || 0);
        const totalExenta = parseFloat(r.exentas_locales || 0);
        const totalNosujeta = parseFloat(r.no_sujetas || 0);
        const iva = parseFloat(r.credito_fiscal || 0);
        const retencion = parseFloat(r.iva_retenido || 0) + parseFloat(r.retencion_a_terceros || 0);
        const percepcion = parseFloat(r.iva_percibido || 0);
        const anticipoCuenta = parseFloat(r.anticipo_a_cuenta || 0);
        const montoSujeto = parseFloat(r.monto_sujeto || 0);
        const montoTotal = Math.round((totalGravada + totalExenta + totalNosujeta + iva - retencion + percepcion) * 100) / 100;

        await pool.query(`
            INSERT INTO expense_headers (
                company_id, branch_id, usuario_id, provider_id, fecha,
                numero_documento, codigo_generacion, tipo_documento_id, condicion_operacion_id, observaciones,
                total_nosujeta, total_exenta, total_gravada, iva, retencion,
                percepcion, fovial, cotrans, anticipo_cuenta, monto_sujeto,
                monto_total, status, period_year, period_month,
                num_control, tipo_operacion, tipo_clasificacion, tipo_sector, tipo_costo,
                created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?, ?,
                ?, NULL, ?, '01', ?,
                ?, ?, ?, ?, ?,
                ?, 0, 0, ?, ?,
                ?, 'ACTIVO', ?, ?,
                ?, ?, ?, ?, ?,
                NOW(), NOW()
            )
        `, [
            2,
            branchMapping.branch_id,
            1,
            providerId,
            r.fecha,
            r.documento,
            r.id_tipo_documento,
            `GASTO IMPORTADO COMPRAS_IVA (SERIE: ${r.serie || r.documento})`,
            totalNosujeta,
            totalExenta,
            totalGravada,
            iva,
            retencion,
            percepcion,
            anticipoCuenta,
            montoSujeto,
            montoTotal,
            r.periodo_ano,
            r.periodo_mes,
            r.serie || r.documento,
            r.id_operacion || '1',
            r.id_clasificacion || '1',
            r.id_sector || '2',
            r.id_tipocosto || '5'
        ]);
        count++;
    }

    console.log(`  ✓ ${count} gastos importados exitosamente.`);
}

module.exports = { up };
