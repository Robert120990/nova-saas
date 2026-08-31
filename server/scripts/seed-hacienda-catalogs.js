require('dotenv').config();
const mysql = require('mysql2/promise');

const catalogs = {
    cat_departamento: [
        ['01', 'Ahuachapä\u00A1n'], ['02', 'Santa Ana'], ['03', 'Sonsonate'], ['04', 'Chalatenango'],
        ['05', 'La Libertad'], ['06', 'San Salvador'], ['07', 'Cuscatlä\u00A1n'], ['08', 'La Paz'],
        ['09', 'Caba\u00F1as'], ['10', 'San Vicente'], ['11', 'Usulutlä\u00A1n'], ['12', 'San Miguel'],
        ['13', 'Morazlä\u00A1n'], ['14', 'La Uni\u00F3n']
    ],
    cat_tipo_documento_dte: [
        ['01', 'Factura Electr\u00F3nica'], ['03', 'Comprobante de Cr\u00E9dito Fiscal Electr\u00F3nico'],
        ['05', 'Nota de Remisi\u00F3n Electr\u00F3nica'], ['06', 'Nota de Cr\u00E9dito Electr\u00F3nica'],
        ['07', 'Nota de D\u00E9bito Electr\u00F3nica'], ['08', 'Comprobante de Retenci\u00F3n Electr\u00F3nico'],
        ['09', 'Comprobante de Liquidaci\u00F3n Electr\u00F3nico'], ['11', 'Factura de Sujeci\u00F3n Excluida Electr\u00F3nica'],
        ['14', 'Factura de Exportaci\u00F3n Electr\u00F3nica'], ['15', 'Documento Contable de Liquidaci\u00F3n Electr\u00F3nico']
    ],
    cat_condicion_operacion: [
        ['1', 'Contado'], ['2', 'Cr\u00E9dito'], ['3', 'Otro']
    ],
    cat_forma_pago: [
        ['01', 'Billetes y monedas'], ['02', 'Tarjeta de d\u00E9bito'], ['03', 'Tarjeta de cr\u00E9dito'],
        ['04', 'Cheque'], ['05', 'Transferencia - Dep\u00F3sito bancario'],
        ['08', 'Dinero electr\u00F3nico'], ['09', 'Monedero electr\u00F3nico'], ['11', 'Bitcoin'],
        ['12', 'Otras Criptomonedas'], ['13', 'Cuentas por pagar del receptor'], ['14', 'Giro bancario'],
        ['99', 'Otros (se debe indicar el medio de pago)']
    ],
    cat_tipo_tributo: [
        ['20', 'IVA'], ['C3', 'FOVIAL'], ['C1', 'COTRANS'], ['A6', 'Impuesto Ad-valorem Bebidas Alcoh\u00F3licas'],
        ['D4', 'IVA Percibido'], ['D5', 'IVA Retenido']
    ],
    cat_unidad_medida: [
        ['1', 'Kilogramo'], ['2', 'Litro'], ['3', 'Metro'], ['4', 'Metro cuadrado'],
        ['5', 'Metro cúbico'], ['6', 'Tonelada métrica'], ['7', 'Tonelada corta'], ['8', 'Tonelada larga'],
        ['9', 'Barril'], ['10', 'Botella'], ['11', 'Libra'], ['12', 'Onza'],
        ['13', 'Onza troy'], ['14', 'Galón imperial'], ['15', 'Galón US'], ['16', 'Centímetro'],
        ['17', 'Pie'], ['18', 'Yarda'], ['19', 'Pulgada'], ['20', 'Milímetro'],
        ['21', 'Kilómetro'], ['22', 'Hectolitro'], ['23', 'Mililitro'], ['24', 'Miligramo'],
        ['25', 'Gramo neto'], ['26', 'Kilowatt'], ['27', 'Megawatt'], ['28', 'Minuto'],
        ['29', 'Hora'], ['30', 'Día'], ['31', 'Segundo'], ['32', 'Par'],
        ['33', 'Docena'], ['34', 'Ciento'], ['35', 'Millar'], ['36', 'Fardo'],
        ['37', 'Saco'], ['38', 'Quintal'], ['39', 'Quintal métrico'], ['40', 'Caja'],
        ['41', 'Bolsa'], ['42', 'Rollo'], ['43', 'Resma'], ['44', 'Pliego'],
        ['45', 'Juego'], ['46', 'Tambor'], ['47', 'Gruesa'], ['48', 'Plato'],
        ['49', 'Millar de hojas'], ['50', 'Metro lineal'], ['51', 'Pie cuadrado'], ['52', 'Yarda cuadrada'],
        ['53', 'Centímetro cuadrado'], ['54', 'Pulgada cuadrada'], ['55', 'Galón'], ['56', 'Centilitro'],
        ['57', 'Decilitro'], ['58', 'Kilolitro'], ['59', 'Unidad'], ['60', 'Servicio'],
        ['61', 'Kilómetro cuadrado'], ['99', 'Otras']
    ],
    cat_tipo_documento_identificacion: [
        ['13', 'DUI'], ['36', 'NIT'], ['02', 'Carnet de residente'], ['03', 'Pasaporte'], ['37', 'Otro']
    ],
    cat_tipo_establecimiento: [
        ['01', 'Sucursal / Establecimiento'], ['02', 'Casa Matriz'], ['04', 'Bodega'], ['07', 'Predio y similares'], ['20', 'Otro']
    ],
    cat_tipo_item: [
        ['1', 'Bienes'], ['2', 'Servicios'], ['3', 'Bienes y Servicios'], ['4', 'Otro']
    ]
};

async function seed() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });

    try {
        console.log('Iniciando carga de cat\u00E1logos...');
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');
        
        for (const [table, data] of Object.entries(catalogs)) {
            console.log(`Cargando ${table}...`);
            await connection.query(`CREATE TABLE IF NOT EXISTS ${table} (code VARCHAR(10) PRIMARY KEY, description VARCHAR(255))`);
            await connection.query(`DELETE FROM ${table}`);
            await connection.query(`INSERT INTO ${table} (code, description) VALUES ?`, [data]);
        }

        // Municipios (Muestra representativa, para "completa" se suele usar JSON externo)
        console.log('Cargando cat_municipio...');
        await connection.query(`CREATE TABLE IF NOT EXISTS cat_municipio (code VARCHAR(10) PRIMARY KEY, dep_code VARCHAR(10), description VARCHAR(255), FOREIGN KEY (dep_code) REFERENCES cat_departamento(code))`);
        const municipios = [
            ['0101', '01', 'Ahuachap\u00E1n'], ['0201', '02', 'Santa Ana'], ['0601', '06', 'San Salvador'], ['0614', '06', 'Soyapango']
        ];
        await connection.query(`DELETE FROM cat_municipio`);
        await connection.query(`INSERT INTO cat_municipio (code, dep_code, description) VALUES ?`, [municipios]);

        console.log('Cat\u00E1logos cargados exitosamente.');
    } catch (error) {
        console.error('Error cargando cat\u00E1logos:', error);
    } finally {
        await connection.end();
    }
}
seed();
