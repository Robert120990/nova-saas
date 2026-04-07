const mysql = require('mysql2/promise');
const pool = mysql.createPool({
    host: 'localhost',
    user: 'sysadmin',
    password: 'QwErTy123',
    database: 'db_sistema_saas'
});

async function run() {
    try {
        console.log('--- Iniciando limpieza de certificados ---');
        
        // 1. Limpiar campos en companies
        const [updateResult] = await pool.query(`
            UPDATE companies 
            SET certificado_digital = NULL, 
                clave_privada = NULL, 
                certificate_path = NULL, 
                certificate_password = NULL
        `);
        console.log(`Empresas actualizadas: ${updateResult.affectedRows}`);

        // 2. Limpiar tabla certificates
        try {
            const [deleteResult] = await pool.query("DELETE FROM certificates");
            console.log(`Registros eliminados de 'certificates': ${deleteResult.affectedRows}`);
        } catch (e) {
            console.log("Tabla 'certificates' no existe o ya está limpia.");
        }

        console.log('--- Limpieza completada con éxito ---');

    } catch (e) {
        console.error('Error durante la limpieza:', e.message);
    } finally {
        await pool.end();
    }
}
run();
