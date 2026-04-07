require('dotenv').config();
const mysql = require('mysql2/promise');
const https = require('https');

const SOURCES = {
    municipios: 'https://raw.githubusercontent.com/arnoldou/elsalvador-departamentos-municipios/main/db.json',
    actividades: 'https://raw.githubusercontent.com/Marcomps/FacturaSV-DTE/main/Actividades%20Economicas/catalogo_CAT019_actividades_economicas.json'
};

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

async function seed() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        console.log('Iniciando descarga de datos COMPLETOS...');
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');

        // 1. Municipios (262)
        console.log('Descargando municipios...');
        const geoData = await fetchJSON(SOURCES.municipios);
        const municipiosToInsert = [];
        geoData.departamentos.forEach(dept => {
            dept.municipios.forEach(mun => {
                municipiosToInsert.push([mun.id_mun, dept.id, mun.nombre]);
            });
        });

        await connection.query('CREATE TABLE IF NOT EXISTS cat_013_municipio (code VARCHAR(10) PRIMARY KEY, dep_code VARCHAR(10), description VARCHAR(255))');
        await connection.query('DELETE FROM cat_013_municipio');
        await connection.query('INSERT INTO cat_013_municipio (code, dep_code, description) VALUES ?', [municipiosToInsert]);
        console.log(`Cargados ${municipiosToInsert.length} municipios.`);

        // 2. Actividades (1200+)
        console.log('Descargando actividades econ\u00F3micas...');
        const activitiesData = await fetchJSON(SOURCES.actividades);
        const activitiesToInsert = activitiesData.map(a => [a.codigo, a.descripcion]);

        await connection.query('CREATE TABLE IF NOT EXISTS cat_019_actividad_economica (code VARCHAR(10) PRIMARY KEY, description VARCHAR(255))');
        await connection.query('DELETE FROM cat_019_actividad_economica');
        await connection.query('INSERT INTO cat_019_actividad_economica (code, description) VALUES ?', [activitiesToInsert]);
        console.log(`Cargadas ${activitiesToInsert.length} actividades econ\u00F3micas.`);

        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('CARGA DE DATOS 100% COMPLETADA.');
    } catch (error) {
        console.error('Error durante la carga:', error);
    } finally {
        await connection.end();
    }
}
seed();
