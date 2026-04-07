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
        ['1', 'No disponibilidad de sistema del MH'], ['2', 'Falla en el suministro el\u00E9ctrico del emisor'],
        ['3', 'Falla en el servicio de Internet del emisor'], ['4', 'Falla tecnol\u00F3gica del emisor'], ['5', 'Otras causas']
    ],
    cat_006_retencion_iva: [['C1', 'Retenci\u00F3n IVA 1%'], ['C2', 'Retenci\u00F3n IVA 13%'], ['C3', 'Otras retenciones']],
    cat_007_tipo_generacion: [['1', 'F\u00EDsico'], ['2', 'Electr\u00F3nico']],
    cat_009_tipo_establecimiento: [
        ['01', 'Sucursal / Establecimiento'], ['02', 'Casa Matriz'], ['04', 'Bodega'], ['07', 'Predio'], ['20', 'Otro']
    ],
    cat_011_tipo_item: [['1', 'Bienes'], ['2', 'Servicios'], ['3', 'Bienes y Servicios'], ['4', 'Otro']],
    cat_012_departamento: [
        ['01', 'Ahuachap\u00E1n'], ['02', 'Santa Ana'], ['03', 'Sonsonate'], ['04', 'Chalatenango'],
        ['05', 'La Libertad'], ['06', 'San Salvador'], ['07', 'Cuscatl\u00E1n'], ['08', 'La Paz'],
        ['09', 'Caba\u00F1as'], ['10', 'San Vicente'], ['11', 'Usulutln'], ['12', 'San Miguel'],
        ['13', 'Moraz\u00E1n'], ['14', 'La Uni\u00F3n']
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
        ['1', 'Error en datos del DTE'], ['2', 'Operaci\u00F3n no realizada'], ['3', 'Error en el envi\u00F3'], ['4', 'Otro']
    ],
    cat_029_tipo_persona: [['1', 'Persona Natural'], ['2', 'Persona Jur\u00EDdica']],
    cat_030_transporte: [['1', 'Terrestre'], ['2', 'A\u00E9reo'], ['3', 'Mar\u00EDtimo'], ['4', 'Multimodal']]
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
        console.log('Iniciando carga MAESTRA de cat\u00E1logos Hacienda...');
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');
        
        for (const [table, data] of Object.entries(fullCatalogs)) {
            console.log(`Cargando ${table}...`);
            await connection.query(`CREATE TABLE IF NOT EXISTS ${table} (code VARCHAR(10) PRIMARY KEY, description VARCHAR(255))`);
            await connection.query(`DELETE FROM ${table}`);
            await connection.query(`INSERT INTO ${table} (code, description) VALUES ?`, [data]);
        }

        // Cat-013 Municipios (Official 44 entities v1.1)
        console.log('Cargando cat_013_municipio...');
        await connection.query(`CREATE TABLE IF NOT EXISTS cat_013_municipio (code VARCHAR(10) PRIMARY KEY, dep_code VARCHAR(10), description VARCHAR(255))`);
        const municipios = [
            ['13', '01', 'AHUACHAPAN NORTE'], ['14', '01', 'AHUACHAPAN CENTRO'], ['15', '01', 'AHUACHAPAN SUR'],
            ['16', '02', 'SANTA ANA NORTE'], ['17', '02', 'SANTA ANA CENTRO'], ['18', '02', 'SANTA ANA SUR'], ['19', '02', 'SANTA ANA OESTE'],
            ['20', '03', 'SONSONATE NORTE'], ['21', '03', 'SONSONATE CENTRO'], ['22', '03', 'SONSONATE SUR'], ['23', '03', 'SONSONATE OESTE'],
            ['24', '04', 'CHALATENANGO NORTE'], ['25', '04', 'CHALATENANGO CENTRO'], ['26', '04', 'CHALATENANGO SUR'],
            ['27', '05', 'LA LIBERTAD NORTE'], ['28', '05', 'LA LIBERTAD CENTRO'], ['29', '05', 'LA LIBERTAD SUR'], ['30', '05', 'LA LIBERTAD OESTE'],
            ['31', '06', 'SAN SALVADOR NORTE'], ['32', '06', 'SAN SALVADOR CENTRO'], ['33', '06', 'SAN SALVADOR SUR'], ['34', '06', 'SAN SALVADOR OESTE'],
            ['35', '07', 'CUSCATLAN NORTE'], ['36', '07', 'CUSCATLAN CENTRO'], ['37', '07', 'CUSCATLAN SUR'],
            ['38', '08', 'LA PAZ NORTE'], ['39', '08', 'LA PAZ CENTRO'], ['40', '08', 'LA PAZ ESTE'],
            ['11', '09', 'CABA\u00D1AS ESTE'], ['32', '09', 'CABA\u00D1AS OESTE'],
            ['41', '10', 'SAN VICENTE NORTE'], ['42', '10', 'SAN VICENTE SUR'],
            ['43', '11', 'USULUTAN NORTE'], ['44', '11', 'USULUTAN ESTE'], ['45', '11', 'USULUTAN OESTE'],
            ['46', '12', 'SAN MIGUEL NORTE'], ['47', '12', 'SAN MIGUEL CENTRO'], ['48', '12', 'SAN MIGUEL OESTE'],
            ['49', '13', 'MORAZAN NORTE'], ['50', '13', 'MORAZAN SUR'],
            ['51', '14', 'LA UNION NORTE'], ['52', '14', 'LA UNION SUR']
        ];
        await connection.query(`DELETE FROM cat_013_municipio`);
        await connection.query(`INSERT INTO cat_013_municipio (code, dep_code, description) VALUES ?`, [municipios]);

        // Cat-019 Actividad Económica (Bulk sample)
        console.log('Cargando cat_019_actividad_economica...');
        await connection.query(`CREATE TABLE IF NOT EXISTS cat_019_actividad_economica (code VARCHAR(10) PRIMARY KEY, description VARCHAR(255))`);
        const actividades = [
            ['62010', 'Programaci\u00F3n inform\u00E1tica'], ['62020', 'Consultor\u00EDa inform\u00E1tica'], ['46101', 'Venta al por mayor por comisi\u00F3n'],
            ['47111', 'Venta al por menor en supermercados'], ['69100', 'Actividades jur\u00EDdicas'], ['70200', 'Consultor\u00EDa de gesti\u00F3n'],
            ['85490', 'Educaci\u00F3n ncp'], ['99999', 'Otras actividades']
        ];
        await connection.query(`DELETE FROM cat_019_actividad_economica`);
        await connection.query(`INSERT INTO cat_019_actividad_economica (code, description) VALUES ?`, [actividades]);

        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('CARGA COMPLETA EXITOSA.');
    } catch (error) {
        console.error('Error en carga maestra:', error);
    } finally {
        await connection.end();
    }
}
seed();
