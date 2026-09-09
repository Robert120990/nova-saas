const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env' });

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'db_sistema_saas',
      port: process.env.DB_PORT || 3306
    });

    const columns = [
      { name: 'documento_afectado', def: 'VARCHAR(50) NULL' },
      { name: 'fecha_afectada', def: 'DATE NULL' },
      { name: 'num_control', def: 'VARCHAR(100) NULL' },
      { name: 'sello_recepcion', def: 'VARCHAR(100) NULL' },
      { name: 'tipo_operacion', def: "VARCHAR(10) DEFAULT '1'" },
      { name: 'tipo_clasificacion', def: "VARCHAR(10) DEFAULT '2'" },
      { name: 'tipo_sector', def: "VARCHAR(10) DEFAULT '4'" },
      { name: 'tipo_costo', def: "VARCHAR(10) DEFAULT '2'" },
      { name: 'gravadas_importaciones', def: 'DECIMAL(18, 6) DEFAULT 0' },
      { name: 'gravadas_internaciones', def: 'DECIMAL(18, 6) DEFAULT 0' },
      { name: 'iva_importaciones', def: 'DECIMAL(18, 6) DEFAULT 0' }
    ];

    const [existingCols] = await conn.query('DESCRIBE expense_headers');
    const existingColNames = existingCols.map(c => c.Field);

    for (const col of columns) {
      if (!existingColNames.includes(col.name)) {
        console.log('Adding column:', col.name);
        await conn.query(`ALTER TABLE expense_headers ADD COLUMN ${col.name} ${col.def}`);
      } else {
        console.log('Column already exists:', col.name);
      }
    }

    console.log('Migration completed successfully!');
    await conn.end();
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
})();
