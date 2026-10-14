const pool = require('../src/config/db');

(async () => {
    try {
        const [tables] = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'db_control_iva'");
        for (const t of tables) {
            const tbl = t.TABLE_NAME;
            try {
                const [cols] = await pool.query(`DESCRIBE db_control_iva.${tbl}`);
                const hasCol = (name) => cols.some(c => c.Field.toLowerCase() === name.toLowerCase());

                // Check tables with documento / num_doc / etc
                const docCol = cols.find(c => ['documento', 'num_doc', 'numero', 'num_documento'].includes(c.Field.toLowerCase()));
                if (docCol) {
                    const [rows] = await pool.query(`SELECT * FROM db_control_iva.${tbl} WHERE ${docCol.Field} IN ('66', '67', '68', '69')`);
                    if (rows.length > 0) {
                        console.log(`Found docs 66-69 in table ${tbl}:`, rows.length, 'records');
                        console.log(rows.slice(0, 3));
                    }
                }
            } catch (e) {}
        }
    } catch (err) {
        console.error(err);
    }
    process.exit(0);
})();
