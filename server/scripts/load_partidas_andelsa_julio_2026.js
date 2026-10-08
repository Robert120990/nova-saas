const pool = require('../src/config/db');

// Configuración de empresa y sucursal para ANDELSA
const COMPANY_ID = 9;
const BRANCH_ID = 5; // Sede Central
const CREATED_BY = 25; // xiomara (contabilidad@andelsa.com.sv)
const ENTRY_TYPE_ID = 1; // DIARIO
const ENTRY_DATE = '2026-07-31';

const PARTIDAS = [
    {
        number: 'CON-070001',
        date: ENTRY_DATE,
        description: 'CF JULIO 2026 ANDELSA',
        lines: [
            // FERELI S, S.A. DE C.V. (1103010101)
            { code: '1103010101', description: 'CF 703', debit: 495.39, credit: 0 },
            { code: '1103010101', description: '736', debit: 470.08, credit: 0 },
            { code: '1103010101', description: '786', debit: 495.39, credit: 0 },
            { code: '1103010101', description: '820', debit: 376.06, credit: 0 },
            { code: '1103010101', description: '840', debit: 495.39, credit: 0 },

            // CRIO INVERSIONES, S.A. DE C.V. (1103010104)
            { code: '1103010104', description: '708', debit: 144.64, credit: 0 },
            { code: '1103010104', description: '838', debit: 28.93, credit: 0 },
            { code: '1103010104', description: '843', debit: 115.71, credit: 0 },

            // PRICESMART EL SALVADOR (1103010113)
            { code: '1103010113', description: 'CF 704', debit: 1066.24, credit: 0 },
            { code: '1103010113', description: '737', debit: 1066.24, credit: 0 },
            { code: '1103010113', description: '738', debit: 1066.24, credit: 0 },
            { code: '1103010113', description: '744', debit: 426.49, credit: 0 },
            { code: '1103010113', description: '760', debit: 639.75, credit: 0 },
            { code: '1103010113', description: '774', debit: 852.99, credit: 0 },
            { code: '1103010113', description: '775', debit: 1279.49, credit: 0 },
            { code: '1103010113', description: '793', debit: 426.49, credit: 0 },
            { code: '1103010113', description: '796', debit: 426.49, credit: 0 },
            { code: '1103010113', description: '797', debit: 426.49, credit: 0 },
            { code: '1103010113', description: '805', debit: 1279.49, credit: 0 },
            { code: '1103010113', description: '823', debit: 1279.49, credit: 0 },
            { code: '1103010113', description: '826', debit: 426.49, credit: 0 },
            { code: '1103010113', description: '841', debit: 1066.24, credit: 0 },
            { code: '1103010113', description: '842', debit: 1279.49, credit: 0 },
            { code: '1103010113', description: '848', debit: 639.75, credit: 0 },

            // CARIBE HOSPITALITY EL SALVADOR, S.A. DE C.V. (1103010114)
            { code: '1103010114', description: '720', debit: 179.20, credit: 0 },
            { code: '1103010114', description: '750', debit: 408.57, credit: 0 },
            { code: '1103010114', description: '789', debit: 408.57, credit: 0 },
            { code: '1103010114', description: '811', debit: 358.40, credit: 0 },

            // GOTERA, S.A. DE C .V. (1103010120)
            { code: '1103010120', description: '724', debit: 831.68, credit: 0 },
            { code: '1103010120', description: '753', debit: 873.26, credit: 0 },
            { code: '1103010120', description: '787', debit: 873.26, credit: 0 },
            { code: '1103010120', description: '803', debit: 1039.60, credit: 0 },

            // ROSAMELIA, S.A. DE C.V. (1103010122)
            { code: '1103010122', description: '712', debit: 969.54, credit: 0 },
            { code: '1103010122', description: '731', debit: 1080.39, credit: 0 },
            { code: '1103010122', description: '742', debit: 1169.55, credit: 0 },
            { code: '1103010122', description: '769', debit: 969.54, credit: 0 },
            { code: '1103010122', description: '777', debit: 1175.31, credit: 0 },
            { code: '1103010122', description: '799', debit: 774.62, credit: 0 },
            { code: '1103010122', description: '812', debit: 779.70, credit: 0 },
            { code: '1103010122', description: '831', debit: 1359.39, credit: 0 },
            { code: '1103010122', description: '844', debit: 1121.53, credit: 0 },

            // CORPORACION PRIMAVERA, S.A. DE C.V. (1103010125)
            { code: '1103010125', description: '710', debit: 6154.85, credit: 0 },
            { code: '1103010125', description: '717', debit: 340.03, credit: 0 },
            { code: '1103010125', description: '729', debit: 3763.20, credit: 0 },
            { code: '1103010125', description: '730', debit: 37.97, credit: 0 },
            { code: '1103010125', description: '741', debit: 5984.83, credit: 0 },
            { code: '1103010125', description: '743', debit: 37.97, credit: 0 },
            { code: '1103010125', description: '768', debit: 37.97, credit: 0 },
            { code: '1103010125', description: '770', debit: 3071.49, credit: 0 },
            { code: '1103010125', description: '776', debit: 5493.60, credit: 0 },
            { code: '1103010125', description: '795', debit: 3726.91, credit: 0 },
            { code: '1103010125', description: '798', debit: 75.94, credit: 0 },
            { code: '1103010125', description: '810', debit: 5644.80, credit: 0 },
            { code: '1103010125', description: '813', debit: 540.85, credit: 0 },
            { code: '1103010125', description: '814', debit: 37.97, credit: 0 },
            { code: '1103010125', description: '815', debit: 61.47, credit: 0 },
            { code: '1103010125', description: '828', debit: 3386.88, credit: 0 },
            { code: '1103010125', description: '829', debit: 37.97, credit: 0 },
            { code: '1103010125', description: '832', debit: 30.74, credit: 0 },
            { code: '1103010125', description: '846', debit: 37.97, credit: 0 },
            { code: '1103010125', description: '847', debit: 92.21, credit: 0 },
            { code: '1103010125', description: '850', debit: 5644.80, credit: 0 },

            // INVERSIONES ELPA, S.A. DE C.V. (1103010129)
            { code: '1103010129', description: '849', debit: 56.95, credit: 0 },

            // GRUPO NORTEÑO, S.A. DE C.V. (1103010133)
            { code: '1103010133', description: '739', debit: 410.53, credit: 0 },

            // CLAUDIA MARIA LARA LAINEZ (1103010136)
            { code: '1103010136', description: '722', debit: 32.54, credit: 0 },
            { code: '1103010136', description: '761', debit: 39.78, credit: 0 },
            { code: '1103010136', description: '785', debit: 27.12, credit: 0 },
            { code: '1103010136', description: '821', debit: 47.01, credit: 0 },

            // ERNESTINA CASTRO, S.A. DE C.V. (1103010137)
            { code: '1103010137', description: '754', debit: 90.40, credit: 0 },

            // COMIDAS E INDUSTRIAS ESPECIALIZADAS DE EL SALVADOR (1103010142)
            { code: '1103010142', description: '772', debit: 11954.50, credit: 0 },

            // CARBE TERRANUM EL SALVADOR, S.A. DE C.V. (1103010145)
            { code: '1103010145', description: '726', debit: 358.40, credit: 0 },
            { code: '1103010145', description: '804', debit: 358.40, credit: 0 },

            // MICOMI, S.A. DE C.V. (1103010146)
            { code: '1103010146', description: '719', debit: 9072.00, credit: 0 },
            { code: '1103010146', description: '827', debit: 9072.00, credit: 0 },
            { code: '1103010146', description: '837', debit: 9991.29, credit: 0 },

            // OFFICE SHOP SA DE CV (1103010183)
            { code: '1103010183', description: '709', debit: 8.14, credit: 0 },
            { code: '1103010183', description: '749', debit: 8.14, credit: 0 },
            { code: '1103010183', description: '773', debit: 8.14, credit: 0 },
            { code: '1103010183', description: '790', debit: 2.71, credit: 0 },
            { code: '1103010183', description: '792', debit: 9.04, credit: 0 },

            // MANUEL DE JESUS LOPEZ (1103010184)
            { code: '1103010184', description: '711', debit: 1075.76, credit: 0 },
            { code: '1103010184', description: '751', debit: 1008.52, credit: 0 },
            { code: '1103010184', description: '778', debit: 1008.52, credit: 0 },
            { code: '1103010184', description: '816', debit: 1008.52, credit: 0 },
            { code: '1103010184', description: '845', debit: 1075.76, credit: 0 },

            // CLIENTES VARIOS (11030222)
            { code: '11030222', description: '718', debit: 85.43, credit: 0 },
            { code: '11030222', description: '721', debit: 117.52, credit: 0 },
            { code: '11030222', description: '723', debit: 50.62, credit: 0 },
            { code: '11030222', description: '727', debit: 12.00, credit: 0 },
            { code: '11030222', description: '732', debit: 79.55, credit: 0 },
            { code: '11030222', description: '735', debit: 987.17, credit: 0 },
            { code: '11030222', description: '740', debit: 155.49, credit: 0 },
            { code: '11030222', description: '755', debit: 61.02, credit: 0 },
            { code: '11030222', description: '762', debit: 63.28, credit: 0 },
            { code: '11030222', description: '763', debit: 117.52, credit: 0 },
            { code: '11030222', description: '783', debit: 103.96, credit: 0 },
            { code: '11030222', description: '784', debit: 37.97, credit: 0 },
            { code: '11030222', description: '788', debit: 136.50, credit: 0 },
            { code: '11030222', description: '801', debit: 3423.90, credit: 0 },
            { code: '11030222', description: '802', debit: 12.00, credit: 0 },
            { code: '11030222', description: '806', debit: 124.75, credit: 0 },
            { code: '11030222', description: '822', debit: 718.68, credit: 0 },
            { code: '11030222', description: '824', debit: 73.22, credit: 0 },
            { code: '11030222', description: '836', debit: 105.77, credit: 0 },
            { code: '11030222', description: '839', debit: 50.62, credit: 0 },
            { code: '11030222', description: '851', debit: 24.00, credit: 0 },
            { code: '11030222', description: '852', debit: 795.52, credit: 0 },
            { code: '11030222', description: '853', debit: 55.14, credit: 0 },

            // TUTTO SA DE CV (11030239)
            { code: '11030239', description: '728', debit: 90.40, credit: 0 },
            { code: '11030239', description: '791', debit: 54.24, credit: 0 },
            { code: '11030239', description: '830', debit: 54.24, credit: 0 },

            // CALLEJA SA DE CV (11030240)
            { code: '11030240', description: '705', debit: 151.54, credit: 0 },
            { code: '11030240', description: '706', debit: 76.44, credit: 0 },
            { code: '11030240', description: '707', debit: 151.54, credit: 0 },
            { code: '11030240', description: '713', debit: 76.44, credit: 0 },
            { code: '11030240', description: '714', debit: 76.44, credit: 0 },
            { code: '11030240', description: '715', debit: 76.44, credit: 0 },
            { code: '11030240', description: '725', debit: 227.30, credit: 0 },
            { code: '11030240', description: '734', debit: 227.30, credit: 0 },
            { code: '11030240', description: '745', debit: 151.54, credit: 0 },
            { code: '11030240', description: '746', debit: 151.54, credit: 0 },
            { code: '11030240', description: '747', debit: 151.54, credit: 0 },
            { code: '11030240', description: '748', debit: 151.54, credit: 0 },
            { code: '11030240', description: '752', debit: 76.44, credit: 0 },
            { code: '11030240', description: '756', debit: 151.54, credit: 0 },
            { code: '11030240', description: '757', debit: 227.30, credit: 0 },
            { code: '11030240', description: '758', debit: 151.54, credit: 0 },
            { code: '11030240', description: '759', debit: 227.30, credit: 0 },
            { code: '11030240', description: '764', debit: 151.54, credit: 0 },
            { code: '11030240', description: '766', debit: 227.30, credit: 0 },
            { code: '11030240', description: '767', debit: 151.54, credit: 0 },
            { code: '11030240', description: '779', debit: 76.44, credit: 0 },
            { code: '11030240', description: '781', debit: 151.54, credit: 0 },
            { code: '11030240', description: '782', debit: 76.44, credit: 0 },
            { code: '11030240', description: '807', debit: 76.44, credit: 0 },
            { code: '11030240', description: '808', debit: 151.54, credit: 0 },
            { code: '11030240', description: '809', debit: 151.54, credit: 0 },
            { code: '11030240', description: '817', debit: 76.44, credit: 0 },
            { code: '11030240', description: '818', debit: 76.44, credit: 0 },
            { code: '11030240', description: '819', debit: 151.54, credit: 0 },
            { code: '11030240', description: '825', debit: 303.07, credit: 0 },
            { code: '11030240', description: '833', debit: 76.44, credit: 0 },
            { code: '11030240', description: '834', debit: 151.54, credit: 0 },
            { code: '11030240', description: '835', debit: 76.44, credit: 0 },

            // IMPUESTOS POR RECUPERAR (1% Retención)
            { code: '11070104', description: 'CF JULIO 2026 ANDELSA', debit: 815.32, credit: 0 },

            // AJUSTES CONTABLES (Para cuadratura exacta de 9 centavos)
            { code: '520102', description: 'CF JULIO 2024 ANDELSA', debit: 0.09, credit: 0 },

            // IMPUESTOS Y CONTRIBUCIONES POR PAGAR (IVA Débito Fiscal)
            { code: '21060601', description: 'CF JULIO 2026 ANDELSA', debit: 0, credit: 15489.79 },

            // VENTAS DE MERCADERIA (Huevo Entero 100%)
            { code: '51010103', description: 'CF JULIO 2026 ANDELSA', debit: 0, credit: 119152.23 }
        ]
    },
    {
        number: 'CON-070002',
        date: ENTRY_DATE,
        description: 'FACTURAS JULIO 2026',
        lines: [
            // COCINA DE VUELOS, S.A. DE C.V. (1103010102)
            { code: '1103010102', description: '89', debit: 716.80, credit: 0 },
            { code: '1103010102', description: '90', debit: 512.00, credit: 0 },
            { code: '1103010102', description: '91', debit: 307.20, credit: 0 },
            { code: '1103010102', description: '92', debit: 921.60, credit: 0 },
            { code: '1103010102', description: '93', debit: 716.80, credit: 0 },

            // CLIENTES VARIOS (11030222)
            { code: '11030222', description: 'FACTURAS JULIO 2026', debit: 320.90, credit: 0 },

            // IVA DEBITO FISCAL (21060601)
            { code: '21060601', description: 'FACTURAS JULIO 2026', debit: 0, credit: 36.92 },

            // VENTAS DE MERCADERIA (51010103)
            { code: '51010103', description: 'FACTURAS JULIO 2026', debit: 0, credit: 283.98 },
            { code: '51010103', description: 'FACTURAS JULIO 2026', debit: 0, credit: 3174.40 }
        ]
    },
    {
        number: 'CON-070005',
        date: ENTRY_DATE,
        description: 'MATERIA PRIMA ANDELSA',
        lines: [
            // COSTO DE PRODUCCION -> MATERIA PRIMA ANDELSA (41040101)
            { code: '41040101', description: 'MATERIA PRIMA ANDELSA', debit: 108152.17, credit: 0 },

            // PRESTAMOS A CORTO PLAZO -> RAUL RAFAEL SOSA CASTELLANOS (21010215)
            { code: '21010215', description: 'MATERIA PRIMA ANDELSA', debit: 0, credit: 108152.17 }
        ]
    },
    {
        number: 'CON-070009',
        date: ENTRY_DATE,
        description: 'REGISTRO MOVIMIENTOS ANDELSA',
        lines: [
            // GASTOS DE VENTA -> COMBUSTIBLE Y LUBRICANTES (410621)
            { code: '410621', description: 'REGISTRO MOVIMIENTOS ANDELSA', debit: 76.72, credit: 0 },

            // GASTOS DE ADMINISTRACION -> SUELDOS Y SALARIOS (410501)
            { code: '410501', description: 'REGISTRO MOVIMIENTOS ANDELSA', debit: 13456.89, credit: 0 },

            // GASTOS DE ADMINISTRACION -> ENERGIA ELECTRICA (410529)
            { code: '410529', description: 'REGISTRO MOVIMIENTOS ANDELSA', debit: 15469.54, credit: 0 },

            // GASTOS DE ADMINISTRACION -> AGUA - ANDA (410528)
            { code: '410528', description: 'REGISTRO MOVIMIENTOS ANDELSA', debit: 2548.63, credit: 0 },

            // GASTOS DE VENTA -> CIEX IMPORTACIONES (410663)
            { code: '410663', description: 'REGISTRO MOVIMIENTOS ANDELSA', debit: 7786.16, credit: 0 },

            // GASTOS DE ADMINISTRACION -> SEGUROS (410536)
            { code: '410536', description: 'REGISTRO MOVIMIENTOS ANDELSA', debit: 548.96, credit: 0 },

            // GASTOS DE ADMINISTRACION -> SERVICIO DE SEGURIDAD Y GPS (410530)
            { code: '410530', description: 'REGISTRO MOVIMIENTOS ANDELSA', debit: 57.63, credit: 0 },
            { code: '410530', description: 'REGISTRO MOVIMIENTOS ANDELSA', debit: 1264.78, credit: 0 },

            // COSTO DE PRODUCCION -> MATERIALES E INSUMOS PARA LABORATORIO (41040362)
            { code: '41040362', description: 'REGISTRO MOVIMIENTOS ANDELSA', debit: 4569.78, credit: 0 },

            // COSTO DE PRODUCCION -> MANTENIMIENTO DE MAQUINARIA Y EQUIPO (41040358)
            { code: '41040358', description: 'REGISTRO MOVIMIENTOS ANDELSA', debit: 3967.98, credit: 0 },

            // GASTOS DE ADMINISTRACION -> HORAS EXTRAS (410502)
            { code: '410502', description: 'REGISTRO MOVIMIENTOS ANDELSA', debit: 6987.45, credit: 0 },

            // GASTOS FINANCIEROS -> INTERESES (410701)
            { code: '410701', description: 'REGISTRO MOVIMIENTOS ANDELSA', debit: 3928.54, credit: 0 },

            // PRESTAMOS A CORTO PLAZO -> RAUL RAFAEL SOSA CASTELLANOS (21010215)
            { code: '21010215', description: 'REGISTRO MOVIMIENTOS ANDELSA', debit: 0, credit: 60663.06 }
        ]
    }
];

async function main() {
    console.log('=== CARGA DE PARTIDAS CONTABLES ANDELSA - JULIO 2026 ===\n');

    const conn = await pool.getConnection();

    try {
        // 1. Obtener todas las cuentas del catálogo de ANDELSA
        const [allAccounts] = await conn.query(
            'SELECT id, code, name, allows_entries, active FROM chart_of_accounts WHERE company_id = ?',
            [COMPANY_ID]
        );
        const accountMap = new Map(allAccounts.map(a => [a.code, a]));

        console.log(`Catálogo de ANDELSA cargado: ${allAccounts.length} cuentas.`);

        // 2. Pre-validación exhaustiva de todas las partidas antes de abrir transacción
        console.log('\n--- FASE 1: PRE-VALIDACIÓN DE CUENTAS Y CUADRATURAS ---');
        for (const p of PARTIDAS) {
            let totalDebitCents = 0;
            let totalCreditCents = 0;

            for (let i = 0; i < p.lines.length; i++) {
                const line = p.lines[i];
                const acc = accountMap.get(line.code);

                if (!acc) {
                    throw new Error(`[Partida ${p.number}] Cuenta no existe en catálogo: ${line.code}`);
                }
                if (!acc.active) {
                    throw new Error(`[Partida ${p.number}] Cuenta inactiva: ${line.code} (${acc.name})`);
                }
                if (!acc.allows_entries) {
                    throw new Error(`[Partida ${p.number}] Cuenta es de mayor y no permite partidas: ${line.code} (${acc.name})`);
                }

                line.account_id = acc.id;
                line.account_name = acc.name;

                const dCents = Math.round(Number(line.debit || 0) * 100);
                const cCents = Math.round(Number(line.credit || 0) * 100);

                totalDebitCents += dCents;
                totalCreditCents += cCents;
            }

            p.totalDebit = totalDebitCents / 100;
            p.totalCredit = totalCreditCents / 100;

            if (totalDebitCents !== totalCreditCents) {
                throw new Error(
                    `[Partida ${p.number}] Descuadre: Debe=${p.totalDebit.toFixed(2)} vs Haber=${p.totalCredit.toFixed(2)} (Diff=${((totalDebitCents - totalCreditCents) / 100).toFixed(2)})`
                );
            }

            console.log(`✔ Partida ${p.number}: ${p.lines.length} líneas | Total: $${p.totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })} (CUADRADA)`);
        }

        // 3. Verificar si alguna partida ya existe para evitar duplicación
        const partidaNumbers = PARTIDAS.map(p => p.number);
        const [existing] = await conn.query(
            'SELECT id, number FROM accounting_entries WHERE company_id = ? AND number IN (?)',
            [COMPANY_ID, partidaNumbers]
        );

        if (existing.length > 0) {
            console.warn('\n⚠ Ya existen partidas registradas con estos números:', existing.map(e => `${e.number} (ID: ${e.id})`).join(', '));
            console.warn('Abortando proceso para no duplicar datos.');
            process.exit(0);
        }

        // 4. Iniciar transacción e insertar partidas
        console.log('\n--- FASE 2: INSERCIÓN TRANSACCIONAL EN BASE DE DATOS ---');
        await conn.beginTransaction();

        const createdEntries = [];

        for (const p of PARTIDAS) {
            const [entryRes] = await conn.query(
                `INSERT INTO accounting_entries (
                    company_id, branch_id, entry_type_id, number, date, description,
                    total_debit, total_credit, status, created_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'posted', ?, NOW(), NOW())`,
                [
                    COMPANY_ID,
                    BRANCH_ID,
                    ENTRY_TYPE_ID,
                    p.number,
                    p.date,
                    p.description,
                    p.totalDebit,
                    p.totalCredit,
                    CREATED_BY
                ]
            );

            const entryId = entryRes.insertId;

            for (const line of p.lines) {
                await conn.query(
                    `INSERT INTO accounting_entry_lines (
                        entry_id, account_id, description, debit, credit
                    ) VALUES (?, ?, ?, ?, ?)`,
                    [
                        entryId,
                        line.account_id,
                        line.description,
                        line.debit,
                        line.credit
                    ]
                );
            }

            createdEntries.push({
                id: entryId,
                number: p.number,
                description: p.description,
                total: p.totalDebit,
                linesCount: p.lines.length
            });

            console.log(`✔ Insertada Partida ID ${entryId} [${p.number}] con ${p.lines.length} líneas.`);
        }

        await conn.commit();
        console.log('\n✅ TRANSACCIÓN COMPLETADA Y CONFIRMADA EXITOSAMENTE (COMMIT).');

        // 5. Verificación final desde la base de datos
        console.log('\n--- FASE 3: AUDITORÍA DE VERIFICACIÓN POST-CARGA ---');
        for (const entry of createdEntries) {
            const [[dbEntry]] = await conn.query(
                'SELECT * FROM accounting_entries WHERE id = ?',
                [entry.id]
            );
            const [dbLines] = await conn.query(
                'SELECT COUNT(*) as lineCount, SUM(debit) as sumDebit, SUM(credit) as sumCredit FROM accounting_entry_lines WHERE entry_id = ?',
                [entry.id]
            );

            console.log(`Partida #${dbEntry.number} (ID: ${dbEntry.id}):`);
            console.log(`  Fecha: ${dbEntry.date.toISOString().split('T')[0]}`);
            console.log(`  Concepto: ${dbEntry.description}`);
            console.log(`  Líneas registradas: ${dbLines[0].lineCount}`);
            console.log(`  Total Debe:  $${Number(dbLines[0].sumDebit).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
            console.log(`  Total Haber: $${Number(dbLines[0].sumCredit).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
            console.log(`  Estado: ${dbEntry.status}\n`);
        }

        console.log('=== TODAS LAS PARTIDAS HAN SIDO CARGADAS CORRECTAMENTE ===');

    } catch (err) {
        await conn.rollback();
        console.error('\n❌ ERROR EN EL PROCESO, TRANSACCIÓN REVERTIDA (ROLLBACK):', err.message);
        process.exit(1);
    } finally {
        conn.release();
        process.exit(0);
    }
}

main();
