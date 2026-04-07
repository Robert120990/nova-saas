require('dotenv').config();
const mysql = require('mysql2/promise');

const fullCatalogs = {
    cat_001_ambiente: [['1', 'Pruebas'], ['2', 'Producci\u00F3n']],
    cat_002_tipo_dte: [
        ['01', 'Factura Electr\u00F3nica'], ['03', 'Cr\u00E9dito Fiscal Electr\u00F3nico'], ['05', 'Nota de Remisi\u00F3n Electr\u00F3nica'],
        ['06', 'Nota de Cr\u00E9dito Electr\u00F3nica'], ['07', 'Nota de D\u00E9bito Electr\u00F3nica'], ['08', 'Comprobante de Retenci\u00F3n Electr\u00F3nico'],
        ['09', 'Comprobante de Liquidaci\u00F3n Electr\u00F3nico'], ['11', 'Factura de Sujeci\u00F3n Excluida Electr\u00F3nica'],
        ['14', 'Factura de Exportaci\u00F3n Electr\u00F3nica'], ['15', 'Documento Contable de Liquidaci\u00F3n Electr\u00F3nico']
    ],
    cat_003_modelo_facturacion: [['1', 'Modelo de facturaci\u00F3n Previa'], ['2', 'Modelo de facturaci\u00F3n Diferida']],
    cat_004_tipo_transmision: [['1', 'Normal'], ['2', 'Contingencia']],
    cat_005_tipo_contingencia: [
        ['1', 'No disponibilidad de sistema del MH'], ['2', 'No disponibilidad de sistema del emisor'],
        ['3', 'Falla en el suministro de servicio de Internet del Emisor'], ['4', 'Falla en el suministro de servicio de energ\u00EDa el\u00E9ctrica del emisor'],
        ['5', 'Otro']
    ],
    cat_006_retencion_iva: [['C1', 'Retenci\u00F3n IVA 1%'], ['C2', 'Retenci\u00F3n IVA 13%'], ['C3', 'Otras retenciones']],
    cat_007_tipo_generacion: [['1', 'F\u00EDsico'], ['2', 'Electr\u00F3nico']],
    cat_009_tipo_establecimiento: [
        ['01', 'Sucursal / Establecimiento'], ['02', 'Casa Matriz'], ['04', 'Bodega'], ['07', 'Predio'], ['20', 'Otro']
    ],
    cat_011_tipo_item: [['1', 'Bienes'], ['2', 'Servicios'], ['3', 'Bienes y Servicios'], ['4', 'Otro']],
    cat_012_departamento: [
        ['01', 'Ahuachap\u00E1n'], ['02', 'Santa Ana'], ['03', 'Sonsonate'], ['04', 'Chalatenango'],
        ['05', 'La Libertad'], ['06', 'San Salvador'], ['07', 'Cuscatlan'], ['08', 'La Paz'],
        ['09', 'Caba\u00F1as'], ['10', 'San Vicente'], ['11', 'Usulutlan'], ['12', 'San Miguel'],
        ['13', 'Morazan'], ['14', 'La Uni\u00F3n']
    ],
    cat_014_unidad_medida: [
        ['59', 'Unidad'], ['39', 'Kilogramo'], ['41', 'Libra'], ['57', 'Metro'], ['18', 'Litro'],
        ['23', 'Mililitro'], ['01', 'Gramo'], ['05', 'Caja'], ['10', 'Bolsa'], ['99', 'Otro']
    ],
    cat_015_tributo: [
        ['20', 'IVA'], ['C3', 'FOVIAL'], ['C1', 'COTRANS'], ['A6', 'Impuesto Ad-valorem Bebidas Alcoh\u00F3licas'],
        ['D4', 'IVA Percibido'], ['D5', 'IVA Retenido']
    ],
    cat_016_condicion_operacion: [['1', 'Contado'], ['2', 'Cr\u00E9dito'], ['3', 'Otro']],
    cat_017_forma_pago: [
        ['01', 'Billetes y monedas'], ['02', 'Tarjeta de d\u00E9bito'], ['03', 'Tarjeta de cr\u00E9dito'],
        ['10', 'Cheque'], ['20', 'Transferencia / Dep\u00F3sito bancario'], ['30', 'Vales o cupones'],
        ['99', 'Otros']
    ],
    cat_020_pais: [['222', 'El Salvador'], ['100', 'Guatemala'], ['101', 'Honduras'], ['102', 'Nicaragua'], ['103', 'Costa Rica'], ['104', 'Panam\u00E1']],
    cat_022_tipo_documento_receptor: [
        ['13', 'DUI'], ['36', 'NIT'], ['02', 'Carnet de residente'], ['03', 'Pasaporte'], ['37', 'Otro']
    ],
    cat_023_documento_contingencia: [
        ['1', 'Formulario f\u00EDsico'], ['2', 'Formulario propio emisor'], ['3', 'Otros']
    ],
    cat_024_tipo_invalidacion: [
        ['1', 'Error en la Informaci\u00F3n del DTE'], ['2', 'Rescindir de la operaci\u00F3n realizada.'], ['3', 'Otro']
    ],
    cat_029_tipo_persona: [['1', 'Persona Natural'], ['2', 'Persona Jur\u00EDdica']],
    cat_030_transporte: [['1', 'Terrestre'], ['2', 'A\u00E9reo'], ['3', 'Mar\u00EDtimo'], ['4', 'Multimodal']]
};

const municipiosFromSQL = [
  ['0', '00', 'Otro (Para extranjeros)'],
  ['13', '01', 'AHUACHAPAN  NORTE'], ['14', '01', 'AHUACHAPAN  CENTRO'], ['15', '01', 'AHUACHAPAN  SUR'],
  ['14', '02', 'SANTA ANA NORTE'], ['15', '02', 'SANTA ANA CENTRO'], ['16', '02', 'SANTA ANA ESTE'], ['17', '02', 'SANTA ANA OESTE'],
  ['17', '03', 'SONSONATE  NORTE'], ['18', '03', 'SONSONATE CENTRO'], ['19', '03', 'SONSONATE ESTE'], ['20', '03', 'SONSONATE OESTE'],
  ['34', '04', 'CHALATENANGO  NORTE'], ['35', '04', 'CHALATENANGO  CENTRO'], ['36', '04', 'CHALATENANGO  SUR'],
  ['23', '05', 'LA LIBERTAD NORTE'], ['24', '05', 'LA LIBERTAD CENTRO'], ['25', '05', 'LA LIBERTAD OESTE'], ['26', '05', 'LA LIBERTAD ESTE'], ['27', '05', 'LA LIBERTAD COSTA'], ['28', '05', 'LA LIBERTAD SUR'],
  ['20', '06', 'SAN SALVADOR  NORTE'], ['21', '06', 'SAN SALVADOR OESTE'], ['22', '06', 'SAN SALVADOR ESTE'], ['23', '06', 'SAN SALVADOR CENTRO'], ['24', '06', 'SAN SALVADOR SUR'],
  ['17', '07', 'CUSCATLAN  NORTE'], ['18', '07', 'CUSCATLAN  SUR'],
  ['23', '08', 'LA PAZ OESTE'], ['24', '08', 'LA PAZ CENTRO'], ['25', '08', 'LA PAZ ESTE'],
  ['10', '09', 'CABA\u00D1AS OESTE'], ['11', '09', 'CABA\u00D1AS ESTE'],
  ['14', '10', 'SAN VICENTE NORTE'], ['15', '10', 'SAN VICENTE SUR'],
  ['24', '11', 'USULUTAN  NORTE'], ['25', '11', 'USULUTAN ESTE'], ['26', '11', 'USULUTAN OESTE'],
  ['21', '12', 'SAN MIGUEL NORTE'], ['22', '12', 'SAN MIGUEL CENTRO'], ['23', '12', 'SAN MIGUEL OESTE'],
  ['27', '13', 'MORAZAN NORTE'], ['28', '13', 'MORAZAN SUR'],
  ['19', '14', 'LA UNION NORTE'], ['20', '14', 'LA UNION SUR']
];

async function seed() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });

    try {
        console.log('Iniciando carga DEFINITIVA de cat\u00E1logos Hacienda (Fuente: Usuario DTE v1.1)...');
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');
        
        for (const [table, data] of Object.entries(fullCatalogs)) {
            console.log(`Cargando ${table}...`);
            await connection.query(`CREATE TABLE IF NOT EXISTS ${table} (code VARCHAR(10) PRIMARY KEY, description VARCHAR(255))`);
            await connection.query(`DELETE FROM ${table}`);
            await connection.query(`INSERT INTO ${table} (code, description) VALUES ?`, [data]);
        }

        // Cat-013 Municipios (Official 44 entities from User SQL)
        console.log('Cargando cat_013_municipio...');
        await connection.query(`DROP TABLE IF EXISTS cat_013_municipio`);
        // Use composite PK if codes are reused across depts (though SQL suggests they should be unique in the context of the user's system)
        // Actually, the user's SQL allows duplicates in ID (e.g. 14 for 01 and 02), so PK must be (code, dep_code)
        await connection.query(`CREATE TABLE cat_013_municipio (code VARCHAR(10), dep_code VARCHAR(10), description VARCHAR(255), PRIMARY KEY(code, dep_code))`);
        await connection.query(`INSERT INTO cat_013_municipio (code, dep_code, description) VALUES ?`, [municipiosFromSQL]);

        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('CARGA DEFINITIVA EXITOSA (CAT-013 Refactorizado).');

        // Check counts
        const [rows] = await connection.query('SELECT COUNT(*) as count FROM cat_013_municipio');
        console.log(`Total municipios cargados: ${rows[0].count}`);

    } catch (error) {
        console.error('Error en carga definitiva:', error);
    } finally {
        await connection.end();
    }
}
seed();
