const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });
const { getRrsPool } = require('../server/src/config/rrsDb');

async function migrate(pool) {
    console.log('[Migration v264] Verificando columna rrs_num_cheque en purchase_quedans...');

    const [columns] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'purchase_quedans' 
          AND COLUMN_NAME = 'rrs_num_cheque'
    `);

    if (columns.length === 0) {
        await pool.query(`
            ALTER TABLE purchase_quedans 
            ADD COLUMN rrs_num_cheque VARCHAR(50) DEFAULT NULL AFTER status
        `);
        console.log('[Migration v264] Columna rrs_num_cheque agregada con éxito.');
    } else {
        console.log('[Migration v264] Columna rrs_num_cheque ya existía.');
    }

    // Sincronizar números de cheque existentes desde RRS emision_quedan
    try {
        const rrs = getRrsPool();
        const [configs] = await pool.query('SELECT branch_id, rrs_id_empresa FROM branch_chq_config');
        const branchRrsMap = {};
        for (const cfg of configs) {
            branchRrsMap[cfg.branch_id] = cfg.rrs_id_empresa;
        }

        const [quedans] = await pool.query(`
            SELECT id, branch_id 
            FROM purchase_quedans 
            WHERE status IN ('SOLICITADO', 'ENTREGADO')
        `);

        if (quedans.length > 0) {
            const llaveToId = {};
            const llaves = [];
            for (const q of quedans) {
                const rrsId = branchRrsMap[q.branch_id];
                if (rrsId) {
                    const llave = `${rrsId}-${q.id}`;
                    llaveToId[llave] = q.id;
                    llaves.push(llave);
                }
            }

            if (llaves.length > 0) {
                const [rrsRows] = await rrs.query(`
                    SELECT llave, cheque 
                    FROM emision_quedan 
                    WHERE llave IN (?) AND cheque != '' AND cheque IS NOT NULL
                `, [llaves]);

                let updatedCount = 0;
                for (const row of rrsRows) {
                    const qId = llaveToId[row.llave];
                    const numCheque = row.cheque ? row.cheque.trim() : '';
                    if (qId && numCheque) {
                        await pool.query('UPDATE purchase_quedans SET rrs_num_cheque = ? WHERE id = ?', [numCheque, qId]);
                        updatedCount++;
                    }
                }
                console.log(`[Migration v264] Sincronizados ${updatedCount} números de cheque desde RRS para quedanes.`);
            }
        }
    } catch (rrsErr) {
        console.warn('[Migration v264] Aviso: No se pudo conectar a RRS para sincronizar cheques previos:', rrsErr.message);
    }
}

module.exports = { migrate };
