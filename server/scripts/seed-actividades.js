require('dotenv').config();
const mysql = require('mysql2/promise');

const actividades = [
    ['01111', 'Cultivo de ma\u00EDz'], ['10101', 'Matanza de ganado vacuno'],
    ['46101', 'Venta al por mayor a cambio de una retribuci\u00F3n o por contrata'],
    ['47111', 'Venta al por menor en comercios no especializados con predominio de la venta de alimentos, bebidas o tabaco'],
    ['47591', 'Venta al por menor de muebles para el hogar'],
    ['62010', 'Actividades de programaci\u00F3n inform\u00E1tica'],
    ['62020', 'Actividades de consultor\u00EDa de inform\u00E1tica y de gesti\u00F3n de instalaciones inform\u00E1ticas'],
    ['69100', 'Actividades jur\u00EDdicas'],
    ['70200', 'Actividades de consultor\u00EDa de gesti\u00F3n'],
    ['85490', 'Otros tipos de ense\u00F1anza n.c.p.'],
    ['94990', 'Actividades de otras asociaciones n.c.p.'],
    ['99999', 'Otras actividades n.c.p.']
];

async function seed() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        console.log('Cargando cat_actividad_economica...');
        await connection.query(`CREATE TABLE IF NOT EXISTS cat_actividad_economica (code VARCHAR(10) PRIMARY KEY, description VARCHAR(255))`);
        await connection.query(`DELETE FROM cat_actividad_economica`);
        await connection.query(`INSERT INTO cat_actividad_economica (code, description) VALUES ?`, [actividades]);
        console.log('Actividades cargadas.');
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}
seed();
