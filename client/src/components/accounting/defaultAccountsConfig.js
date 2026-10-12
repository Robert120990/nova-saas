/**
 * defaultAccountsConfig.js
 * Metadatos y agrupaciones legibles para cuentas contables predeterminadas del sistema.
 */

export const ACCOUNT_CATEGORIES = [
    { id: 'all', label: 'Todas', icon: 'Layers', color: 'slate' },
    { id: 'turnos', label: 'Cierres de Turno', icon: 'Fuel', color: 'indigo' },
    { id: 'tarjetas', label: 'Tarjetas POS y Bancos', icon: 'CreditCard', color: 'blue' },
    { id: 'ventas', label: 'Facturación y Ventas', icon: 'ShoppingCart', color: 'emerald' },
    { id: 'compras', label: 'Compras y Proveedores', icon: 'ShoppingBag', color: 'amber' },
    { id: 'custom', label: 'Personalizadas', icon: 'Sliders', color: 'purple' },
];

export const KNOWN_ACCOUNTS = [
    // --- CIERRES DE TURNO (GASOLINERA) ---
    {
        key: 'CUENTA_VENTAS_COMBUSTIBLE',
        label: 'Ventas de Combustible',
        category: 'turnos',
        group: 'Ingresos de Pista',
        description: 'Cuenta de ingresos para combustibles (Regular, Super, Diesel, ION).'
    },
    {
        key: 'CUENTA_VENTAS_LUBRICANTES',
        label: 'Ventas de Lubricantes',
        category: 'turnos',
        group: 'Ingresos de Pista',
        description: 'Cuenta de ingresos por aceites, aditivos y lubricantes vendidos en el turno.'
    },
    {
        key: 'CUENTA_COSTO_MERCADERIA',
        label: 'Costo de Mercadería',
        category: 'turnos',
        group: 'Costos e Inventario',
        description: 'Cuenta de costo de ventas para combustibles y lubricantes consumidos.'
    },
    {
        key: 'CUENTA_INVENTARIO_COMBUSTIBLE',
        label: 'Inventario de Combustibles',
        category: 'turnos',
        group: 'Costos e Inventario',
        description: 'Cuenta de activo de inventario donde se rebajan los galones despachados.'
    },
    {
        key: 'CUENTA_INVENTARIO_LUBRICANTE',
        label: 'Inventario de Lubricantes',
        category: 'turnos',
        group: 'Costos e Inventario',
        description: 'Cuenta de activo de inventario donde se rebajan los lubricantes entregados.'
    },
    {
        key: 'CUENTA_CAJA',
        label: 'Caja General (Pista y Clientes)',
        category: 'turnos',
        group: 'Efectivo y Valores',
        description: 'Cuenta de efectivo donde ingresa el dinero líquido recaudado en el turno.'
    },
    {
        key: 'CUENTA_SOBRANTES_FALTANTES',
        label: 'Sobrantes y Faltantes de Corte',
        category: 'turnos',
        group: 'Efectivo y Valores',
        description: 'Cuenta para compensar diferencias o descuadres del corte diario.'
    },
    {
        key: 'CUENTA_CUPONES',
        label: 'Vales y Cupones',
        category: 'turnos',
        group: 'Efectivo y Valores',
        description: 'Cobros recibidos mediante vales o cupones de distribuidoras.'
    },
    {
        key: 'CUENTA_CHEQUES',
        label: 'Cheques Recibidos',
        category: 'turnos',
        group: 'Efectivo y Valores',
        description: 'Cobros recibidos mediante cheques bancarios en pista.'
    },
    {
        key: 'CUENTA_FOVIAL_POR_PAGAR',
        label: 'FOVIAL por Pagar',
        category: 'turnos',
        group: 'Impuestos de Combustible',
        description: 'Pasivo tributario para retención de FOVIAL ($0.20 por galón).'
    },
    {
        key: 'CUENTA_IVA_DEBITO',
        label: 'IVA Débito Fiscal (13%)',
        category: 'turnos',
        group: 'Impuestos de Combustible',
        description: 'Pasivo tributario por impuesto al valor agregado en ventas.'
    },
    {
        key: 'CUENTA_IVA_CREDITO',
        label: 'IVA Crédito Fiscal (Gastos)',
        category: 'turnos',
        group: 'Gastos de Turno',
        description: 'Crédito fiscal deducible en comprobantes de compras o gastos de turno.'
    },
    {
        key: 'CUENTA_ISR_RETENIDO',
        label: 'ISR Retenido en Gastos',
        category: 'turnos',
        group: 'Gastos de Turno',
        description: 'Retención de renta en gastos de servicios o compras sin factura.'
    },

    // --- TARJETAS POS Y BANCOS ---
    {
        key: 'CUENTA_TARJETAS_CREDOMATIC',
        aliases: [
            'CUENTA_TARJETAS_BAC',
            'CUENTA_TARJETAS_POS_BAC',
            'CUENTA_TARJETAS_POS_CREDOMATIC',
            'CUENTA_TARJETAS_BAC_CREDOMATIC',
            'CUENTA_TARJETAS_POSBAC',
            'CUENTA_TARJETAS_POSCREDOMATIC'
        ],
        label: 'Tarjetas BAC / Credomatic',
        category: 'tarjetas',
        group: 'Terminales POS',
        description: 'Vouchers y lotes cobrados con terminales BAC / Credomatic.'
    },
    {
        key: 'CUENTA_TARJETAS_VERSATEC',
        aliases: ['CUENTA_TARJETAS_VERSATEC_FLEET'],
        label: 'Tarjetas Versatec',
        category: 'tarjetas',
        group: 'Tarjetas de Flota',
        description: 'Cobros efectuados mediante tarjetas corporativas Versatec Fleet.'
    },
    {
        key: 'CUENTA_TARJETAS_PRISS',
        aliases: [
            'CUENTA_TARJETAS_PRIS',
            'CUENTA_TARJETAS_PUMA_PRIS',
            'CUENTA_TARJETAS_PUMA_PRIS_PAGO_CON_TARJETA',
            'CUENTA_TARJETAS_PUMA_PRIS_PAGO_CON_TARJETA_ASOCIADA',
            'CUENTA_TARJETAS_PRIS_PAGO_CON_TARJETA',
            'CUENTA_TARJETAS_PRIS_PAGO_CON_TARJETA_ASOCIADA',
            'CUENTA_TARJETAS_PUMAPRIS'
        ],
        label: 'Puma PRIS (Tarjeta Asociada)',
        category: 'tarjetas',
        group: 'Puma Loyalty',
        description: 'Cobros procesados vía app Puma PRIS con tarjeta de crédito asociada.'
    },
    {
        key: 'CUENTA_TARJETAS_FLOTA',
        aliases: ['CUENTA_TARJETAS_PUMA_FLOTA', 'CUENTA_TARJETAS_PUMAFLOTA'],
        label: 'Puma Flota',
        category: 'tarjetas',
        group: 'Tarjetas de Flota',
        description: 'Cobros realizados con tarjetas corporativas Puma Flota.'
    },
    {
        key: 'CUENTA_TARJETAS_DAVIVIENDA',
        aliases: [
            'CUENTA_TARJETAS_SERFINSA',
            'CUENTA_TARJETAS_POS_DAVIVIENDA',
            'CUENTA_TARJETAS_POS_SERFINSA',
            'CUENTA_TARJETAS_DAVIVIENDA_SERFINSA',
            'CUENTA_TARJETAS_POSDAVIVIENDA',
            'CUENTA_TARJETAS_POSSERFINSA'
        ],
        label: 'Tarjetas Davivienda / Serfinsa',
        category: 'tarjetas',
        group: 'Terminales POS',
        description: 'Vouchers procesados por terminales de Davivienda o red Serfinsa.'
    },
    {
        key: 'CUENTA_TARJETAS_PROMERICA',
        aliases: [
            'CUENTA_TARJETAS_POS_PROMERICA',
            'CUENTA_TARJETAS_PROMERICA_POS',
            'CUENTA_TARJETAS_POSPROMERICA'
        ],
        label: 'Tarjetas Banco Promerica',
        category: 'tarjetas',
        group: 'Terminales POS',
        description: 'Vouchers y cobros procesados por terminal POS Banco Promerica.'
    },
    {
        key: 'CUENTA_TARJETAS_AGRICOLA',
        aliases: [
            'CUENTA_TARJETAS_POS_AGRICOLA',
            'CUENTA_TARJETAS_BANCO_AGRICOLA',
            'CUENTA_TARJETAS_POS_BANCO_AGRICOLA',
            'CUENTA_TARJETAS_POSAGRICOLA'
        ],
        label: 'Tarjetas Banco Agrícola',
        category: 'tarjetas',
        group: 'Terminales POS',
        description: 'Vouchers y cobros procesados por POS Banco Agrícola.'
    },
    {
        key: 'CUENTA_TARJETAS_CUSCATLAN',
        aliases: [
            'CUENTA_TARJETAS_POS_CUSCATLAN',
            'CUENTA_TARJETAS_BANCO_CUSCATLAN',
            'CUENTA_TARJETAS_POSCUSCATLAN'
        ],
        label: 'Tarjetas Banco Cuscatlán',
        category: 'tarjetas',
        group: 'Terminales POS',
        description: 'Vouchers y cobros procesados por POS Banco Cuscatlán.'
    },
    {
        key: 'CUENTA_TARJETAS_HIPOTECARIO',
        aliases: [
            'CUENTA_TARJETAS_POS_HIPOTECARIO',
            'CUENTA_TARJETAS_BANCO_HIPOTECARIO',
            'CUENTA_TARJETAS_POSHIPOTECARIO'
        ],
        label: 'Tarjetas Banco Hipotecario',
        category: 'tarjetas',
        group: 'Terminales POS',
        description: 'Vouchers y cobros procesados por POS Banco Hipotecario.'
    },
    {
        key: 'CUENTA_TARJETAS_SHELL_GO',
        aliases: [
            'CUENTA_TARJETAS_SHELL',
            'CUENTA_TARJETAS_SHELL_GO_TARJETA_ASOCIADA',
            'CUENTA_TARJETAS_SHELLGO'
        ],
        label: 'Tarjetas Shell GO+',
        category: 'tarjetas',
        group: 'Shell Loyalty',
        description: 'Cobros efectuados mediante aplicación Shell GO+ con tarjeta asociada.'
    },
    {
        key: 'CUENTA_TARJETAS_TRANSFERENCIA_BANCARIA',
        aliases: [
            'CUENTA_TARJETAS_TRANSFERENCIA',
            'CUENTA_TARJETAS_TRANSFERENCIABANCARIA',
            'CUENTA_TRANSFERENCIA_BANCARIA',
            'CUENTA_TRANSFERENCIA'
        ],
        label: 'Transferencia Bancaria',
        category: 'tarjetas',
        group: 'Terminales POS y Bancos',
        description: 'Cobros o liquidaciones registradas como transferencia bancaria directa.'
    },
    {
        key: 'CUENTA_TARJETAS_NECTAR',
        aliases: ['CUENTA_TARJETAS_TARJETA_NECTAR'],
        label: 'Tarjetas Nectar',
        category: 'tarjetas',
        group: 'Tarjetas de Fidelización',
        description: 'Cobros procesados mediante programa o tarjeta Nectar.'
    },

    // --- FACTURACIÓN Y VENTAS ---
    {
        key: 'CUENTA_CLIENTES_CXC',
        label: 'Cuentas por Cobrar Clientes',
        category: 'ventas',
        group: 'Operaciones de Venta',
        description: 'Cuenta principal de clientes para registro de ventas al crédito.'
    },
    {
        key: 'CUENTA_BANCOS',
        label: 'Bancos / Depósitos',
        category: 'ventas',
        group: 'Operaciones de Venta',
        description: 'Cuenta bancaria general para transferencias y remesas de ventas.'
    },
    {
        key: 'CUENTA_VENTAS_GRAVADAS',
        label: 'Ventas Gravadas Locales',
        category: 'ventas',
        group: 'Ingresos por Facturación',
        description: 'Ingresos por ventas de bienes o servicios afectos al 13% de IVA.'
    },
    {
        key: 'CUENTA_VENTAS_EXENTAS',
        label: 'Ventas Exentas',
        category: 'ventas',
        group: 'Ingresos por Facturación',
        description: 'Ingresos por ventas de bienes o servicios exentos de IVA.'
    },
    {
        key: 'CUENTA_VENTAS_NOSUJETAS',
        label: 'Ventas No Sujetas',
        category: 'ventas',
        group: 'Ingresos por Facturación',
        description: 'Ingresos por operaciones no sujetas al impuesto de IVA.'
    },
    {
        key: 'CUENTA_IVA_PERCIBIDO',
        label: 'IVA Percibido (1%)',
        category: 'ventas',
        group: 'Impuestos de Venta',
        description: 'Pasivo por percepción del 1% aplicada a clientes según normativa.'
    },
    {
        key: 'CUENTA_COTRANS_POR_PAGAR',
        label: 'COTRANS por Pagar',
        category: 'ventas',
        group: 'Impuestos de Venta',
        description: 'Pasivo tributario para retención de COTRANS ($0.10 por galón).'
    },

    // --- COMPRAS Y PROVEEDORES ---
    {
        key: 'CUENTA_COMPRAS_GRAVADAS',
        label: 'Compras Gravadas Locales',
        category: 'compras',
        group: 'Compras y Costos',
        description: 'Gastos o compras afectas a crédito fiscal (CCF).'
    },
    {
        key: 'CUENTA_COMPRAS_EXENTAS',
        label: 'Compras Exentas',
        category: 'compras',
        group: 'Compras y Costos',
        description: 'Compras de bienes o servicios no afectos o exentos de IVA.'
    },
    {
        key: 'CUENTA_PROVEEDORES_CXP',
        label: 'Cuentas por Pagar Proveedores',
        category: 'compras',
        group: 'Proveedores',
        description: 'Cuenta de pasivo para facturas de compra pendientes de pago.'
    },
    {
        key: 'CUENTA_IVA_RETENIDO',
        label: 'IVA Retenido (1%)',
        category: 'compras',
        group: 'Impuestos en Compras',
        description: 'Retención del 1% de IVA efectuada a proveedores.'
    }
];

export const getAccountMetadata = (key) => {
    const upper = (key || '').toUpperCase().trim();
    const found = KNOWN_ACCOUNTS.find(a => a.key === upper || (a.aliases && a.aliases.includes(upper)));
    if (found) return found;

    // Inferencia para claves dinámicas
    if (upper.startsWith('CUENTA_TARJETAS_')) {
        const suffix = upper.replace('CUENTA_TARJETAS_', '').replace(/_/g, ' ');
        return {
            key: upper,
            label: `Tarjeta / POS ${suffix}`,
            category: 'tarjetas',
            group: 'Terminales POS',
            description: `Configuración automática para cobros con ${suffix}.`
        };
    }

    return {
        key: upper,
        label: upper.replace(/^CUENTA_/, '').replace(/_/g, ' '),
        category: 'custom',
        group: 'Personalizadas',
        description: 'Clave personalizada definida por la empresa.'
    };
};

export const findKnownAccountByPosName = (posName) => {
    if (!posName) return null;
    const norm = posName.toUpperCase().replace(/[^A-Z0-9]/g, '');

    const candidates = [
        { term: 'CREDOMATIC', key: 'CUENTA_TARJETAS_CREDOMATIC' },
        { term: 'BAC', key: 'CUENTA_TARJETAS_CREDOMATIC' },
        { term: 'VERSATEC', key: 'CUENTA_TARJETAS_VERSATEC' },
        { term: 'PRIS', key: 'CUENTA_TARJETAS_PRISS' },
        { term: 'FLOTA', key: 'CUENTA_TARJETAS_FLOTA' },
        { term: 'DAVIVIENDA', key: 'CUENTA_TARJETAS_DAVIVIENDA' },
        { term: 'SERFINSA', key: 'CUENTA_TARJETAS_DAVIVIENDA' },
        { term: 'PROMERICA', key: 'CUENTA_TARJETAS_PROMERICA' },
        { term: 'AGRICOLA', key: 'CUENTA_TARJETAS_AGRICOLA' },
        { term: 'CUSCATLAN', key: 'CUENTA_TARJETAS_CUSCATLAN' },
        { term: 'HIPOTECARIO', key: 'CUENTA_TARJETAS_HIPOTECARIO' },
        { term: 'SHELL', key: 'CUENTA_TARJETAS_SHELL_GO' },
        { term: 'TRANSFERENCIA', key: 'CUENTA_TARJETAS_TRANSFERENCIA_BANCARIA' },
        { term: 'NECTAR', key: 'CUENTA_TARJETAS_NECTAR' },
    ];

    for (const c of candidates) {
        if (norm.includes(c.term)) {
            return KNOWN_ACCOUNTS.find(a => a.key === c.key) || null;
        }
    }

    return null;
};
