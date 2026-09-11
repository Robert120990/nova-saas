/**
 * Migration v192: Clean and normalize invalid customer emails in customers table
 * Fixes minor typos (e.g. ,com -> .com, trailing gmailcom, extra spaces)
 * and sets invalid filler values (e.g. '.', 'X', 'PUMA', 'SAN MARTIN', '---') to NULL.
 */

const pool = require('../server/src/config/db');

async function run() {
    console.log('[Migration v192] Iniciando limpieza y normalización de correos de clientes...');

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const [rows] = await pool.query(
        "SELECT id, nombre, correo FROM customers WHERE correo IS NOT NULL AND TRIM(correo) != ''"
    );

    console.log(`[Migration v192] Total clientes con correo registrado: ${rows.length}`);

    let fixedCount = 0;
    let nulledCount = 0;

    for (const r of rows) {
        const raw = r.correo.trim();
        if (emailRegex.test(raw)) continue;

        // Intentar corrección de errores tipográficos comunes
        let cleaned = raw
            .replace(/,com/gi, '.com')
            .replace(/,sv/gi, '.sv')
            .replace(/@@+/g, '@')
            .replace(/\s+/g, '')
            .replace(/gmailcom$/i, 'gmail.com')
            .replace(/hotmailcom$/i, 'hotmail.com')
            .replace(/yahoocom$/i, 'yahoo.com');

        if (emailRegex.test(cleaned)) {
            await pool.query('UPDATE customers SET correo = ? WHERE id = ?', [cleaned, r.id]);
            fixedCount++;
            console.log(`[Migration v192] Corregido cliente ID ${r.id}: '${raw}' => '${cleaned}'`);
        } else {
            await pool.query('UPDATE customers SET correo = NULL WHERE id = ?', [r.id]);
            nulledCount++;
            console.log(`[Migration v192] Limpiado correo inválido cliente ID ${r.id} (${r.nombre}): '${raw}' => NULL`);
        }
    }

    // Asegurar también que los correos que solo tienen espacios en blanco queden como NULL
    const [blankRes] = await pool.query("UPDATE customers SET correo = NULL WHERE correo IS NOT NULL AND TRIM(correo) = ''");
    if (blankRes.affectedRows > 0) {
        console.log(`[Migration v192] Limpiados ${blankRes.affectedRows} registros con solo espacios en blanco a NULL`);
    }

    console.log(`[Migration v192] Resumen: ${fixedCount} correos corregidos, ${nulledCount} valores no válidos reseteados a NULL.`);
}

module.exports = { run };

if (require.main === module) {
    run()
        .then(() => {
            console.log('[Migration v192] Completada exitosamente.');
            process.exit(0);
        })
        .catch(err => {
            console.error('[Migration v192] Error:', err);
            process.exit(1);
        });
}
