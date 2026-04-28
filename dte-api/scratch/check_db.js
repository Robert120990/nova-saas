const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'sysadmin',
        password: process.env.DB_PASSWORD || 'QwErTy123',
        database: process.env.DB_NAME || 'db_sistema_saas'
    };
    
    const connection = await mysql.createConnection(config);
    
    console.log('--- CAT_019_ACTIVIDAD_ECONOMICA ---');
    const [actCols] = await connection.query('DESCRIBE cat_019_actividad_economica');
    console.table(actCols);
    
    console.log('--- POINTS_OF_SALE ---');
    const [posCols] = await connection.query('DESCRIBE points_of_sale');
    console.table(posCols);

    console.log('--- SAMPLE POS ---');
    const [posData] = await connection.query('SELECT * FROM points_of_sale LIMIT 1');
    console.log(JSON.stringify(posData[0], null, 2));
    
    await connection.end();
}

check().catch(console.error);
