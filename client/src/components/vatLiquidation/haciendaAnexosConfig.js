export const INCOME_TYPE_OPTIONS = [
    { code: '1', label: '1 - Profesiones, Artes y Oficios' },
    { code: '2', label: '2 - Actividades de Servicios' },
    { code: '3', label: '3 - Actividades Comerciales' },
    { code: '4', label: '4 - Actividades Industriales' },
    { code: '5', label: '5 - Actividades Agropecuarias' },
    { code: '6', label: '6 - Utilidades y Dividendos' },
    { code: '7', label: '7 - Exportaciones' },
    { code: '8', label: '8 - Otros Ingresos' },
    { code: '12', label: '12 - Sujetos a Retención F-14' }
];

export const F07_OPERATION_OPTIONS = [
    { code: '1', label: '1 - Gravada' },
    { code: '2', label: '2 - No Gravada o Exenta' },
    { code: '3', label: '3 - Excluido' },
    { code: '9', label: '9 - Excepciones' }
];

export const F07_CLASSIFICATION_OPTIONS = [
    { code: '1', label: '1 - Costo' },
    { code: '2', label: '2 - Gasto' },
    { code: '9', label: '9 - Excepciones' }
];

export const F07_SECTOR_OPTIONS = [
    { code: '1', label: '1 - Industria' },
    { code: '2', label: '2 - Comercio' },
    { code: '3', label: '3 - Agropecuaria' },
    { code: '4', label: '4 - Servicios / Profesiones' },
    { code: '9', label: '9 - Excepciones' }
];

export const F07_COST_TYPE_OPTIONS = [
    { code: '1', label: '1 - Gasto de Venta' },
    { code: '2', label: '2 - Gasto de Administración' },
    { code: '3', label: '3 - Gastos Financieros' },
    { code: '4', label: '4 - Costo Importaciones' },
    { code: '5', label: '5 - Costo Internos' },
    { code: '6', label: '6 - Costos Indirectos Fab.' },
    { code: '7', label: '7 - Mano de Obra' },
    { code: '9', label: '9 - Excepciones' }
];

export const ANNEX_SECTIONS = [
    {
        id: 'sales_purchases',
        title: 'Ventas, Compras y Sujetos Excluidos',
        items: [
            {
                key: 'contribuyentes',
                annexNumber: 1,
                title: 'Ventas a Contribuyentes',
                subtitle: 'ANEXO_CONTRIBUYENTES.csv',
                columnsCount: 20,
                badgeCls: 'bg-indigo-100 text-indigo-700',
                btnCls: 'bg-indigo-600 hover:bg-indigo-700',
                metrics: [
                    { field: 'gravadas', label: 'Gravadas' },
                    { field: 'debito_fiscal', label: 'Débito Fiscal' },
                    { field: 'total', label: 'Total Ventas', highlight: true }
                ]
            },
            {
                key: 'consumidor',
                annexNumber: 2,
                title: 'Ventas a Consumidor Final',
                subtitle: 'ANEXO_CONSUMIDOR_FINAL.csv (Agrupado/día)',
                columnsCount: 23,
                badgeCls: 'bg-sky-100 text-sky-700',
                btnCls: 'bg-sky-600 hover:bg-sky-700',
                metrics: [
                    { field: 'gravadas', label: 'Grav. c/IVA' },
                    { field: 'exentas_no_sujetas', label: 'Exent. / No Suj.' },
                    { field: 'total', label: 'Total Ventas', highlight: true }
                ]
            },
            {
                key: 'compras',
                annexNumber: 3,
                title: 'Compras y Gastos',
                subtitle: 'ANEXO_COMPRAS.csv',
                columnsCount: 21,
                badgeCls: 'bg-emerald-100 text-emerald-700',
                btnCls: 'bg-emerald-600 hover:bg-emerald-700',
                metrics: [
                    { field: 'gravadas', label: 'Gravadas' },
                    { field: 'credito_fiscal', label: 'Crédito Fiscal' },
                    { field: 'total', label: 'Total Compras', highlight: true }
                ]
            },
            {
                key: 'sujetos_excluidos',
                annexNumber: 5,
                title: 'Compras a Sujetos Excluidos',
                subtitle: 'Casilla 66 · DTE-14',
                columnsCount: 13,
                badgeCls: 'bg-teal-100 text-teal-700',
                btnCls: 'bg-teal-600 hover:bg-teal-700',
                metrics: [
                    { field: 'monto_operacion', label: 'Monto Operación', highlight: true },
                    { field: 'retencion_iva', label: 'Retención IVA 13%' }
                ]
            }
        ]
    },
    {
        id: 'received_credits',
        title: 'Acreditaciones Recibidas (A favor)',
        items: [
            {
                key: 'anticipo_recibido',
                annexNumber: 6,
                title: 'Anticipo a Cuenta 2% Recibido',
                subtitle: 'Casilla 161 · Tarjetas / POS',
                columnsCount: 8,
                badgeCls: 'bg-amber-100 text-amber-800',
                btnCls: 'bg-amber-600 hover:bg-amber-700',
                metrics: [
                    { field: 'monto_sujeto', label: 'Monto Sujeto' },
                    { field: 'monto_impuesto', label: 'Anticipo 2%', highlight: true }
                ]
            },
            {
                key: 'retencion_recibida',
                annexNumber: 7,
                title: 'Retención 1% IVA Recibida',
                subtitle: 'Casilla 162 · Sufrida en ventas',
                columnsCount: 9,
                badgeCls: 'bg-violet-100 text-violet-700',
                btnCls: 'bg-violet-600 hover:bg-violet-700',
                metrics: [
                    { field: 'monto_sujeto', label: 'Monto Sujeto' },
                    { field: 'monto_impuesto', label: 'Retención 1%', highlight: true }
                ]
            },
            {
                key: 'percepcion_recibida',
                annexNumber: 8,
                title: 'Percepción 1% IVA Recibida',
                subtitle: 'Casilla 163 · Soportada en compras',
                columnsCount: 9,
                badgeCls: 'bg-fuchsia-100 text-fuchsia-700',
                btnCls: 'bg-fuchsia-600 hover:bg-fuchsia-700',
                metrics: [
                    { field: 'monto_sujeto', label: 'Monto Sujeto' },
                    { field: 'monto_impuesto', label: 'Percepción 1%', highlight: true }
                ]
            }
        ]
    },
    {
        id: 'issued_withholdings',
        title: 'Retenciones y Percepciones Efectuadas (Agente)',
        items: [
            {
                key: 'percepcion_efectuada',
                annexNumber: 9,
                title: 'Percepción 1% IVA Efectuada',
                subtitle: 'Casilla 169 · Cobrada en ventas',
                columnsCount: 10,
                badgeCls: 'bg-cyan-100 text-cyan-800',
                btnCls: 'bg-cyan-600 hover:bg-cyan-700',
                metrics: [
                    { field: 'monto_sujeto', label: 'Monto Sujeto' },
                    { field: 'monto_impuesto', label: 'Percepción 1%', highlight: true }
                ]
            },
            {
                key: 'retencion_efectuada',
                annexNumber: 10,
                title: 'Retención 1% IVA Efectuada',
                subtitle: 'Casilla 170 · DTE-07 emitidos',
                columnsCount: 10,
                badgeCls: 'bg-rose-100 text-rose-700',
                btnCls: 'bg-rose-600 hover:bg-rose-700',
                metrics: [
                    { field: 'monto_sujeto', label: 'Monto Sujeto' },
                    { field: 'monto_impuesto', label: 'Retención 1%', highlight: true }
                ]
            }
        ]
    }
];
