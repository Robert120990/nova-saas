require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function setup() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'sysadmin',
        password: process.env.DB_PASSWORD || 'QwErTy123',
        multipleStatements: true
    });

    try {
        const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        console.log('Ejecutando esquema SQL...');
        await connection.query(schema);
        console.log('Base de datos inicializada correctamente.');
    } catch (error) {
        console.error('Error al inicializar la base de datos:', error);
    } finally {
        await connection.end();
    }
}

setup();
