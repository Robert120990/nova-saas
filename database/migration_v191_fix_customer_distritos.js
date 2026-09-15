const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

async function runMigration() {
    console.log('=== INICIANDO MIGRACIÓN V191: NORMALIZACIÓN Y CORRECCIÓN DE DISTRITOS (CAT-008) ===');

    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'db_sistema_saas'
    });

    try {
        // 1. Cargar catálogo oficial CAT-008 y CAT-013
        const [distritos] = await conn.query('SELECT code, dep_code, muni_code, description FROM cat_008_distrito');
        const [municipios] = await conn.query('SELECT code, dep_code, description FROM cat_013_municipio');

        console.log(`Catálogos cargados: ${distritos.length} distritos en cat_008, ${municipios.length} municipios en cat_013.`);

        const validTriplet = new Set();
        const distritosByDep = new Map();
        const distritosByDepMuni = new Map();

        for (const d of distritos) {
            validTriplet.add(`${d.dep_code}-${d.muni_code}-${d.code}`);

            const dmKey = `${d.dep_code}-${d.muni_code}`;
            if (!distritosByDepMuni.has(dmKey)) distritosByDepMuni.set(dmKey, []);
            distritosByDepMuni.get(dmKey).push(d);

            if (!distritosByDep.has(d.dep_code)) distritosByDep.set(d.dep_code, []);
            distritosByDep.get(d.dep_code).push(d);
        }

        // Función de resolución inteligente de dirección
        function resolveAddress(row) {
            let dep = String(row.departamento || '').replace(/\D/g, '').slice(-2).padStart(2, '0');
            if (!dep || dep === '00' || parseInt(dep) > 14) dep = '06';

            let muni = String(row.municipio || '').replace(/\D/g, '').slice(-2).padStart(2, '0');
            let dist = String(row.distrito || '').replace(/\D/g, '').slice(-2).padStart(2, '0');
            const dir = (row.direccion || '').toLowerCase();

            // 1. Si ya es una terna 100% válida en CAT-008
            if (validTriplet.has(`${dep}-${muni}-${dist}`)) {
                return { dep, muni, dist, status: 'valid' };
            }

            // 2. Buscar si el texto de la dirección menciona un distrito del departamento
            const depDistricts = distritosByDep.get(dep) || [];
            depDistricts.sort((a, b) => b.description.length - a.description.length);

            for (const d of depDistricts) {
                const name = d.description.toLowerCase();
                if (name.length >= 4 && (
                    dir.includes(name) ||
                    (name === 'san salvador' && (dir.includes('san benito') || dir.includes('escalon') || dir.includes('escalón') || dir.includes('sagrado corazon') || dir.includes('centro historico') || dir.includes('mercado central'))) ||
                    (name === 'antgo cuscatlán' && (dir.includes('antiguo cuscatlan') || dir.includes('antiguo cuscatlán') || dir.includes('santa elena') || dir.includes('la sultana')))
                )) {
                    return { dep, muni: d.muni_code, dist: d.code, status: 'address_dep_match' };
                }
            }

            // 3. Buscar si la dirección menciona un distrito importante de cualquier departamento
            const allDistricts = [...distritos].sort((a, b) => b.description.length - a.description.length);
            for (const d of allDistricts) {
                const name = d.description.toLowerCase();
                if (name.length >= 6 && dir.includes(name)) {
                    return { dep: d.dep_code, muni: d.muni_code, dist: d.code, status: 'address_global_match' };
                }
            }

            // 4. Si el municipio es válido para este depto, tomar la cabecera del municipio
            const muniDistricts = distritosByDepMuni.get(`${dep}-${muni}`);
            if (muniDistricts && muniDistricts.length > 0) {
                let chosen = muniDistricts[0];
                const cabecera = muniDistricts.find(d => 
                    d.description.toUpperCase().includes('SAN SALVADOR') || 
                    d.description.toUpperCase().includes('SANTA TECLA') ||
                    d.description.toUpperCase().includes('SANTA ANA') ||
                    d.description.toUpperCase().includes('SAN MIGUEL') ||
                    d.description.toUpperCase().includes('SONSONATE') ||
                    d.description.toUpperCase().includes('AHUACHAP') ||
                    d.description.toUpperCase().includes('ZACATECOLUCA') ||
                    d.description.toUpperCase().includes('COJUTEPEQUE') ||
                    d.description.toUpperCase().includes('SAN VICENTE') ||
                    d.description.toUpperCase().includes('USULUT') ||
                    d.description.toUpperCase().includes('CHALATENANGO') ||
                    d.description.toUpperCase().includes('GOTERA') ||
                    d.description.toUpperCase().includes('LA UNION')
                );
                if (cabecera) chosen = cabecera;
                return { dep, muni, dist: chosen.code, status: 'muni_cabecera' };
            }

            // 5. Fallback para San Salvador (06) -> San Salvador Centro (23), distrito 14
            if (dep === '06') {
                return { dep: '06', muni: '23', dist: '14', status: 'default_06' };
            }

            // 6. Fallback general para otros departamentos -> cabecera departamental
            const firstMuni = depDistricts[0]?.muni_code || '01';
            const candidateDist = depDistricts.find(d => d.muni_code === firstMuni) || depDistricts[0];
            return {
                dep,
                muni: candidateDist?.muni_code || '01',
                dist: candidateDist?.code || '01',
                status: 'dep_default'
            };
        }

        // 2. Procesar tabla customers
        console.log('\n--- Actualizando tabla customers ---');
        const [customers] = await conn.query('SELECT id, departamento, municipio, distrito, direccion FROM customers');
        console.log(`Total clientes a evaluar: ${customers.length}`);

        let custUpdates = 0;
        const batchSize = 500;
        let batchUpdates = [];

        for (const c of customers) {
            const resolved = resolveAddress(c);
            const oldDep = String(c.departamento || '').padStart(2, '0');
            const oldMuni = String(c.municipio || '').padStart(2, '0');
            const oldDist = String(c.distrito || '').padStart(2, '0');

            if (oldDep !== resolved.dep || oldMuni !== resolved.muni || oldDist !== resolved.dist) {
                batchUpdates.push({ id: c.id, dep: resolved.dep, muni: resolved.muni, dist: resolved.dist });
                custUpdates++;
            }

            if (batchUpdates.length >= batchSize) {
                await executeCustomerBatch(conn, batchUpdates);
                batchUpdates = [];
                process.stdout.write(`Clientes actualizados: ${custUpdates}...\r`);
            }
        }

        if (batchUpdates.length > 0) {
            await executeCustomerBatch(conn, batchUpdates);
        }
        console.log(`\nClientes actualizados exitosamente: ${custUpdates} de ${customers.length}.`);

        // 3. Procesar tabla customer_branches
        console.log('\n--- Actualizando tabla customer_branches ---');
        const [branches] = await conn.query('SELECT id, departamento, municipio, distrito, direccion FROM customer_branches');
        let branchUpdates = 0;
        for (const b of branches) {
            const resolved = resolveAddress(b);
            const oldDep = String(b.departamento || '').padStart(2, '0');
            const oldMuni = String(b.municipio || '').padStart(2, '0');
            const oldDist = String(b.distrito || '').padStart(2, '0');

            if (oldDep !== resolved.dep || oldMuni !== resolved.muni || oldDist !== resolved.dist) {
                await conn.query(
                    'UPDATE customer_branches SET departamento = ?, municipio = ?, distrito = ? WHERE id = ?',
                    [resolved.dep, resolved.muni, resolved.dist, b.id]
                );
                branchUpdates++;
            }
        }
        console.log(`Sucursales actualizadas: ${branchUpdates} de ${branches.length}.`);

        // 4. Verificación final de integridad
        const [[{ invalidCustomers }]] = await conn.query(`
            SELECT COUNT(*) as invalidCustomers
            FROM customers c
            LEFT JOIN cat_008_distrito d 
              ON d.dep_code = c.departamento 
             AND d.muni_code = c.municipio 
             AND d.code = c.distrito
            WHERE d.code IS NULL
        `);

        console.log(`\n=== VERIFICACIÓN FINAL ===`);
        console.log(`Clientes con combinación inválida en CAT-008: ${invalidCustomers}`);
        if (invalidCustomers === 0) {
            console.log('✓ 100% DE LOS CLIENTES TIENEN DISTRITO, MUNICIPIO Y DEPARTAMENTO OFICIALES VÁLIDOS.');
        } else {
            console.warn(`⚠ Aún hay ${invalidCustomers} clientes pendientes de revisión.`);
        }

    } catch (err) {
        console.error('Error durante la migración v191:', err);
        throw err;
    } finally {
        await conn.end();
    }
}

async function executeCustomerBatch(conn, items) {
    if (!items || items.length === 0) return;
    const ids = items.map(i => i.id);
    let sql = 'UPDATE customers SET ';
    
    sql += 'departamento = CASE id ';
    for (const item of items) {
        sql += `WHEN ${item.id} THEN '${item.dep}' `;
    }
    sql += 'END, ';

    sql += 'municipio = CASE id ';
    for (const item of items) {
        sql += `WHEN ${item.id} THEN '${item.muni}' `;
    }
    sql += 'END, ';

    sql += 'distrito = CASE id ';
    for (const item of items) {
        sql += `WHEN ${item.id} THEN '${item.dist}' `;
    }
    sql += 'END ';

    sql += `WHERE id IN (${ids.join(',')})`;

    await conn.query(sql);
}

module.exports = runMigration;

if (require.main === module) {
    runMigration().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
