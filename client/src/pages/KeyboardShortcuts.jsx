import React, { useState, useEffect, useMemo } from 'react';
import { 
    Keyboard, 
    Flame, 
    Zap, 
    Search, 
    ShoppingCart, 
    Package, 
    Fuel, 
    Globe, 
    Calculator, 
    Sparkles, 
    ShieldCheck, 
    Info, 
    Check,
    Layers,
    ArrowRight
} from 'lucide-react';

const SHORTCUTS = [
    // --- TRUCOS OCULTOS ---
    {
        id: 'gas-edit-anterior',
        keys: ['Ctrl', 'Alt', 'A'],
        category: 'gas',
        isSecret: true,
        badgeType: 'secret',
        badgeLabel: '🔥 Truco Oculto',
        title: 'Modo Edición de Lecturas Anteriores',
        module: 'Gasolinera > Cierre de Turno',
        path: '/gas-station/cierre-lecturas',
        description: 'Habilita la edición directa de las lecturas anteriores/iniciales de los surtidores y mangueras en el cierre.',
        instructions: 'Al presionar la combinación dentro del formulario de Cierre de Lecturas, la columna de lectura anterior se vuelve editable sin necesidad de reabrir o recalcular el turno.',
        tags: ['gasolinera', 'cierre', 'lecturas', 'surtidores', 'mangueras', 'anterior']
    },
    {
        id: 'gas-superadmin-tanks',
        keys: ['5 Clics', 'Badge Estado'],
        category: 'gas',
        isSecret: true,
        badgeType: 'special',
        badgeLabel: '🔥 Modo SuperAdmin',
        title: 'Desbloqueo de Edición de Tanques Reabiertos',
        module: 'Gasolinera > Cierre de Turno',
        path: '/gas-station/cierre-lecturas',
        description: 'Desbloquea para usuarios SuperAdmin la edición de las lecturas de tanques de combustible en turnos con estado "Reabierto".',
        instructions: 'En un turno reabierto, pulsa rápidamente 5 veces (en menos de 3 segundos) sobre la insignia o badge de estado. Se solicitará confirmación y se recalcularán las variaciones de turnos posteriores.',
        tags: ['gasolinera', 'tanques', 'superadmin', 'cierre', 'reabierto', 'truco']
    },
    {
        id: 'global-wheel-protection',
        keys: ['Rueda del Ratón'],
        category: 'global',
        isSecret: true,
        badgeType: 'special',
        badgeLabel: '🛡️ Protección Oculta',
        title: 'Bloqueo de Modificación Accidental en Inputs Numéricos',
        module: 'Sistema Global',
        path: 'En todo el sistema',
        description: 'Protege todos los campos numéricos (precios, cantidades, costos) contra cambios involuntarios provocados por la rueda del ratón.',
        instructions: 'El sistema intercepta automáticamente el desplazamiento de la rueda cuando el cursor está en un campo de número y retira el foco para evitar modificaciones no deseadas.',
        tags: ['scroll', 'rueda', 'numeros', 'seguridad', 'precios', 'cantidades']
    },

    // --- PUNTO DE VENTA (POS) ---
    {
        id: 'pos-search-products',
        keys: ['F3'],
        category: 'pos',
        isSecret: false,
        badgeType: 'fast',
        badgeLabel: '⚡ Atajo Rápido',
        title: 'Búsqueda Rápida de Productos',
        module: 'Ventas > Terminal Punto de Venta (POS)',
        path: '/pos',
        description: 'Abre al instante el catálogo modal para consultar productos por código, descripción o categoría y añadirlos al carrito.',
        instructions: 'Presiona F3 en cualquier momento mientras te encuentras en la pantalla del POS para abrir la ventana flotante de productos.',
        tags: ['pos', 'ventas', 'productos', 'buscar', 'catalogo', 'f3']
    },
    {
        id: 'pos-linked-docs',
        keys: ['F9'],
        category: 'pos',
        isSecret: false,
        badgeType: 'fast',
        badgeLabel: '⚡ Atajo Rápido',
        title: 'Documentos Vinculados / Relacionados',
        module: 'Ventas > Terminal Punto de Venta (POS)',
        path: '/pos',
        description: 'Abre la modal para vincular documentos electrónicos previos emitidos a clientes.',
        instructions: 'Requerido para la emisión de Notas de Crédito (05) y Notas de Remisión (04) que hacen referencia a una factura previa.',
        tags: ['pos', 'dte', 'notas de credito', 'vinculados', 'f9', 'relacionados']
    },
    {
        id: 'pos-contextual-action',
        keys: ['F10'],
        category: 'pos',
        isSecret: false,
        badgeType: 'action',
        badgeLabel: '⚡ Acción Contextual',
        title: 'Acción Principal Inteligente',
        module: 'Ventas > Terminal Punto de Venta (POS)',
        path: '/pos',
        description: 'Tecla multifuncional que ejecuta la acción primordial según el estado actual de la venta.',
        instructions: '1) Si estás agregando productos: pasa a la pantalla de Pago. 2) Si estás en cobro: procesa la venta y emite el DTE. 3) Tras finalizar: reimprime el comprobante.',
        tags: ['pos', 'cobro', 'imprimir', 'facturar', 'pagar', 'f10']
    },
    {
        id: 'pos-cycle-dte-types',
        keys: ['↑', '↓'],
        category: 'pos',
        isSecret: false,
        badgeType: 'nav',
        badgeLabel: '⚡ Selección Rápida',
        title: 'Alternar Tipo de Comprobante DTE',
        module: 'Ventas > Terminal Punto de Venta (POS)',
        path: '/pos',
        description: 'Permite cambiar velozmente entre los tipos de documentos tributarios autorizados.',
        instructions: 'En la ventana modal de apertura del POS, usa las flechas arriba o abajo para rotar entre Factura (01), Crédito Fiscal (03), Remisión (04), Crédito (05), Retención (07) y Exportación (11).',
        tags: ['pos', 'flechas', 'tipo dte', 'factura', 'credito fiscal']
    },
    {
        id: 'pos-enter-actions',
        keys: ['Enter'],
        category: 'pos',
        isSecret: false,
        badgeType: 'action',
        badgeLabel: '⚡ Flujo Ágil',
        title: 'Escaneo Inmediato y Nueva Venta',
        module: 'Ventas > Terminal Punto de Venta (POS)',
        path: '/pos',
        description: 'Agrega artículos leídos por código de barras o inicia una nueva venta limpia tras concluir.',
        instructions: 'En el campo del lector agrega el producto directo al carrito. En la pantalla de éxito con ticket, presionar Enter cierra el diálogo y deja el terminal listo para el siguiente cliente.',
        tags: ['pos', 'enter', 'codigo de barras', 'lector', 'nueva venta']
    },
    {
        id: 'pos-escape-exit',
        keys: ['Esc'],
        category: 'pos',
        isSecret: false,
        badgeType: 'nav',
        badgeLabel: '⚡ Cancelar / Salir',
        title: 'Salir Directo al Dashboard',
        module: 'Ventas > Terminal Punto de Venta (POS)',
        path: '/pos',
        description: 'Cancela la operación actual o abandona el módulo regresando al panel principal.',
        instructions: 'En la modal de apertura de caja o en el diálogo de venta terminada, pulsa Escape para volver al Dashboard de inmediato.',
        tags: ['pos', 'escape', 'esc', 'salir', 'dashboard']
    },

    // --- INVENTARIOS Y COMPRAS ---
    {
        id: 'purchases-f3',
        keys: ['F3'],
        category: 'inventory',
        isSecret: false,
        badgeType: 'fast',
        badgeLabel: '⚡ Atajo Rápido',
        title: 'Catálogo de Productos en Compras',
        module: 'Compras > Registro de Factura de Compra',
        path: '/compras',
        description: 'Abre el buscador modal de productos para seleccionarlos e incorporarlos al documento de compra.',
        instructions: 'Selecciona primero la sucursal de destino y luego presiona F3 para buscar ítems con su último costo de compra.',
        tags: ['compras', 'f3', 'productos', 'catalogo', 'costo']
    },
    {
        id: 'purchases-continuous-enter',
        keys: ['Enter'],
        category: 'inventory',
        isSecret: false,
        badgeType: 'action',
        badgeLabel: '⚡ Flujo Continuo',
        title: 'Carga Rápida de Detalle en Compras',
        module: 'Compras > Registro de Factura de Compra',
        path: '/compras',
        description: 'Permite registrar líneas de compra sin despegar las manos del teclado.',
        instructions: 'Al ingresar el código de barras o SKU presiona Enter para saltar a Cantidad; otro Enter pasa a Costo Unitario, y el siguiente Enter añade el producto a la tabla de compra.',
        tags: ['compras', 'enter', 'flujo', 'rapido', 'detalle']
    },
    {
        id: 'transfers-f3',
        keys: ['F3'],
        category: 'inventory',
        isSecret: false,
        badgeType: 'fast',
        badgeLabel: '⚡ Atajo Rápido',
        title: 'Búsqueda de Productos para Traslado',
        module: 'Inventario > Traslados entre Sucursales',
        path: '/inventario/traslados',
        description: 'Despliega la lista de productos disponibles en la sucursal de origen para despachar a otra sucursal.',
        instructions: 'Asegúrate de estar en la pestaña de nuevo traslado y presiona F3 para seleccionar productos.',
        tags: ['inventario', 'traslados', 'f3', 'sucursales', 'stock']
    },
    {
        id: 'physical-inv-f3',
        keys: ['F3'],
        category: 'inventory',
        isSecret: false,
        badgeType: 'fast',
        badgeLabel: '⚡ Atajo Rápido',
        title: 'Catálogo en Conteo Físico',
        module: 'Inventario > Inventario Físico',
        path: '/inventario/fisico',
        description: 'Abre la selección de productos para integrarlos a la sesión de toma física de inventario.',
        instructions: 'Con la sucursal seleccionada en nuevo inventario, pulsa F3 para ver el catálogo y sus existencias teóricas.',
        tags: ['inventario', 'conteo', 'fisico', 'f3', 'auditoria']
    },
    {
        id: 'adjustments-f3',
        keys: ['F3'],
        category: 'inventory',
        isSecret: false,
        badgeType: 'fast',
        badgeLabel: '⚡ Atajo Rápido',
        title: 'Búsqueda de Productos para Ajustes',
        module: 'Inventario > Ajustes de Inventario',
        path: '/inventario/ajustes',
        description: 'Permite buscar y seleccionar los artículos a los que se les aplicará ajuste de entrada o salida.',
        instructions: 'En la pestaña "Nuevo", selecciona la sucursal y presiona F3 para abrir el catálogo.',
        tags: ['inventario', 'ajustes', 'f3', 'merma', 'ingreso']
    },
    {
        id: 'kardex-f3',
        keys: ['F3'],
        category: 'inventory',
        isSecret: false,
        badgeType: 'fast',
        badgeLabel: '⚡ Atajo Rápido',
        title: 'Consulta Rápida de Kardex',
        module: 'Inventario > Kardex de Movimientos',
        path: '/inventario/kardex',
        description: 'Abre la modal para seleccionar el producto del cual se desea auditar el historial de movimientos.',
        instructions: 'Presiona F3 en la pantalla de Kardex para elegir el producto sin escribir en el campo de búsqueda.',
        tags: ['inventario', 'kardex', 'f3', 'historial', 'movimientos']
    },

    // --- CONTABILIDAD Y RRHH ---
    {
        id: 'accounting-entries-f3',
        keys: ['F3'],
        category: 'accounting_rh',
        isSecret: false,
        badgeType: 'fast',
        badgeLabel: '⚡ Atajo Rápido',
        title: 'Catálogo de Cuentas Contables',
        module: 'Contabilidad > Partidas Contables',
        path: '/contabilidad/partidas',
        description: 'Abre la modal con el catálogo completo de cuentas para asignación de cargos y abonos.',
        instructions: 'Al editar o crear una partida contable, presiona F3 para examinar el catálogo por código o nombre de cuenta.',
        tags: ['contabilidad', 'partidas', 'f3', 'cuentas', 'libro mayor']
    },
    {
        id: 'expenses-enter-flow',
        keys: ['Enter'],
        category: 'accounting_rh',
        isSecret: false,
        badgeType: 'action',
        badgeLabel: '⚡ Flujo Continuo',
        title: 'Captura Ágil de Gastos',
        module: 'Caja > Control de Gastos',
        path: '/gastos',
        description: 'Pasa automáticamente entre los campos del formulario de gastos al pulsar Enter.',
        instructions: 'Tipo de Gasto (Enter) ➔ Monto (Enter) ➔ Tipo de Impuesto (Enter) ➔ Añadir gasto automáticamente.',
        tags: ['gastos', 'enter', 'caja', 'flujo', 'registro']
    },
    {
        id: 'rh-employee-f3',
        keys: ['F3'],
        category: 'accounting_rh',
        isSecret: false,
        badgeType: 'fast',
        badgeLabel: '⚡ Atajo Rápido',
        title: 'Búsqueda de Empleados',
        module: 'Recursos Humanos > Planillas, Vacaciones y Liquidaciones',
        path: '/rh/planillas',
        description: 'Abre la búsqueda rápida de empleados activos para procesar pagos, vacaciones o finiquitos.',
        instructions: 'En los formularios de Planilla, Vacaciones o Finiquitos, pulsa F3 para seleccionar el colaborador por nombre o código.',
        tags: ['rrhh', 'recursos humanos', 'empleados', 'f3', 'planillas', 'vacaciones', 'liquidaciones']
    },

    // --- NAVEGACIÓN GLOBAL ---
    {
        id: 'global-command-palette',
        keys: ['Ctrl / ⌘', 'K'],
        category: 'global',
        isSecret: false,
        badgeType: 'global',
        badgeLabel: '🌐 Global',
        title: 'Paleta de Comandos y Búsqueda Rápida',
        module: 'Sistema Global',
        path: 'En cualquier pantalla',
        description: 'Abre el buscador flotante central para navegar instantáneamente a cualquier módulo o reporte.',
        instructions: 'Presiona Ctrl + K (en Windows) o Cmd + K (en Mac) desde cualquier parte del sistema para saltar de pantalla.',
        tags: ['global', 'ctrl k', 'cmd k', 'paleta', 'buscador', 'navegacion']
    },
    {
        id: 'global-confirm-dialog',
        keys: ['Enter', 'Esc'],
        category: 'global',
        isSecret: false,
        badgeType: 'global',
        badgeLabel: '🌐 Global',
        title: 'Confirmación y Cancelación de Modales',
        module: 'Sistema Global',
        path: 'En todos los cuadros de confirmación',
        description: 'Control de cuadros de advertencia y confirmación del sistema sin necesidad del ratón.',
        instructions: 'Al abrirse un cuadro de diálogo ("¿Desea continuar?"), el botón principal recibe el foco: pulsa Enter para confirmar o Escape para cancelar de forma segura.',
        tags: ['global', 'confirmacion', 'dialogo', 'enter', 'escape', 'modales']
    },
    {
        id: 'global-searchable-select',
        keys: ['Enter / Espacio', '↑', '↓', 'Esc'],
        category: 'global',
        isSecret: false,
        badgeType: 'global',
        badgeLabel: '🌐 Global',
        title: 'Navegación en Menús Desplegables',
        module: 'Sistema Global',
        path: 'En todos los selectores de búsqueda',
        description: 'Control total por teclado de los desplegables avanzados de clientes, proveedores y catálogos.',
        instructions: 'Enter o Espacio para abrir el desplegable, Flechas Arriba/Abajo para desplazarse, Enter para confirmar la opción y Escape o Tab para cerrar.',
        tags: ['global', 'desplegable', 'select', 'flechas', 'teclado']
    }
];

const CATEGORIES = [
    { id: 'all', label: 'Todos', icon: Layers },
    { id: 'secret', label: '🔥 Trucos Ocultos', icon: Flame },
    { id: 'pos', label: 'Punto de Venta (POS)', icon: ShoppingCart },
    { id: 'inventory', label: 'Inventario y Compras', icon: Package },
    { id: 'gas', label: 'Gasolinera', icon: Fuel },
    { id: 'accounting_rh', label: 'Contabilidad y RRHH', icon: Calculator },
    { id: 'global', label: 'Navegación Global', icon: Globe },
];

const KeyboardShortcuts = () => {
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [lastKeyPressed, setLastKeyPressed] = useState(null);
    const [highlightedId, setHighlightedId] = useState(null);

    // Interactive key listener to test shortcuts live on the page
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Ignore when user is actively typing in the search input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            const parts = [];
            if (e.ctrlKey) parts.push('Ctrl');
            if (e.altKey) parts.push('Alt');
            if (e.shiftKey) parts.push('Shift');
            if (e.metaKey) parts.push('Cmd');

            let mainKey = e.key;
            if (mainKey === ' ') mainKey = 'Espacio';
            if (mainKey === 'Escape') mainKey = 'Esc';
            if (mainKey === 'ArrowUp') mainKey = '↑';
            if (mainKey === 'ArrowDown') mainKey = '↓';
            if (mainKey === 'ArrowLeft') mainKey = '←';
            if (mainKey === 'ArrowRight') mainKey = '→';

            // Only add main key if it's not a lonely modifier
            if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
                parts.push(mainKey.toUpperCase());
            }

            const keyString = parts.join(' + ');
            if (keyString) {
                setLastKeyPressed(keyString);

                // Find matching shortcut in our list
                const match = SHORTCUTS.find(s => {
                    // Check direct match or F-key match
                    if (e.key.toUpperCase() === s.keys[0]?.toUpperCase() && s.keys.length === 1) {
                        return true;
                    }
                    if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'a' && s.id === 'gas-edit-anterior') {
                        return true;
                    }
                    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && s.id === 'global-command-palette') {
                        return true;
                    }
                    return false;
                });

                if (match) {
                    setHighlightedId(match.id);
                    setTimeout(() => setHighlightedId(null), 2500);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Filtered items
    const filteredShortcuts = useMemo(() => {
        return SHORTCUTS.filter(shortcut => {
            // Category filter
            if (selectedCategory === 'secret') {
                if (!shortcut.isSecret) return false;
            } else if (selectedCategory !== 'all') {
                if (shortcut.category !== selectedCategory) return false;
            }

            // Search filter
            if (!searchQuery.trim()) return true;

            const q = searchQuery.toLowerCase().trim();
            const keysMatch = shortcut.keys.some(k => k.toLowerCase().includes(q));
            const titleMatch = shortcut.title.toLowerCase().includes(q);
            const descMatch = shortcut.description.toLowerCase().includes(q);
            const moduleMatch = shortcut.module.toLowerCase().includes(q);
            const tagsMatch = shortcut.tags.some(t => t.toLowerCase().includes(q));

            return keysMatch || titleMatch || descMatch || moduleMatch || tagsMatch;
        });
    }, [selectedCategory, searchQuery]);

    const secretCount = SHORTCUTS.filter(s => s.isSecret).length;

    const renderBadge = (type, label) => {
        switch (type) {
            case 'secret':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-red-500/15 text-amber-600 border border-amber-500/30 shadow-sm animate-pulse">
                        <Flame size={12} className="text-orange-500 fill-orange-500" />
                        {label}
                    </span>
                );
            case 'special':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-200">
                        <ShieldCheck size={12} />
                        {label}
                    </span>
                );
            case 'action':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-600 border border-indigo-200">
                        <Zap size={12} />
                        {label}
                    </span>
                );
            case 'global':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-600 border border-purple-200">
                        <Globe size={12} />
                        {label}
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-200">
                        <Zap size={12} />
                        {label}
                    </span>
                );
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-in fade-in duration-300">
            {/* Header section */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl md:rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-700/50 relative overflow-hidden">
                {/* Background ambient lighting */}
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-xs font-semibold text-indigo-200">
                            <Sparkles size={14} className="text-amber-400" />
                            <span>Guía Oficial de Productividad</span>
                            <span className="bg-amber-400/20 text-amber-300 px-2 py-0.2 rounded-full font-bold text-[10px]">
                                {secretCount} trucos ocultos
                            </span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white flex items-center gap-3">
                            <Keyboard className="text-indigo-400 shrink-0" size={34} />
                            <span>Atajos de Teclado y Trucos Ocultos</span>
                        </h1>
                        <p className="text-slate-300 text-sm sm:text-base max-w-2xl leading-relaxed">
                            Acelera tu operación diaria. Consulta las combinaciones de teclas, accesos rápidos y funciones ocultas configuradas para agilizar ventas, cierres y gestión de inventarios.
                        </p>
                    </div>

                    {/* Live key tester chip */}
                    <div className="bg-white/5 backdrop-blur-md border border-white/15 rounded-2xl p-4 w-full md:w-auto shrink-0 flex flex-col items-center justify-center min-w-[200px]">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Detector en Tiempo Real
                        </span>
                        {lastKeyPressed ? (
                            <div className="flex items-center gap-2 text-indigo-300 font-mono font-black text-base bg-indigo-500/20 border border-indigo-400/40 px-3 py-1.5 rounded-xl shadow-inner">
                                <Check size={16} className="text-emerald-400" />
                                <span>{lastKeyPressed}</span>
                            </div>
                        ) : (
                            <span className="text-xs text-slate-400 italic font-mono text-center">
                                Presiona teclas para probar
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Filter and search bar */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm">
                {/* Search input */}
                <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar por tecla (ej: F3, Ctrl, Enter) o por acción (gasolinera, POS, inventario)..."
                        className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold px-1.5 py-0.5 rounded"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Category tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
                    {CATEGORIES.map(cat => {
                        const Icon = cat.icon;
                        const isSelected = selectedCategory === cat.id;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 shrink-0 ${
                                    isSelected
                                        ? (cat.id === 'secret'
                                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-orange-500/20'
                                            : 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20')
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                                }`}
                            >
                                <Icon size={14} className={isSelected ? 'text-white' : 'text-slate-500'} />
                                <span>{cat.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Results counter */}
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <span>
                    Mostrando <strong className="text-slate-800 font-bold">{filteredShortcuts.length}</strong> de {SHORTCUTS.length} combinaciones y atajos
                </span>
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery('')}
                        className="text-indigo-600 hover:underline font-semibold"
                    >
                        Limpiar búsqueda
                    </button>
                )}
            </div>

            {/* Cards Grid */}
            {filteredShortcuts.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
                    <Keyboard size={48} className="mx-auto text-slate-300 animate-bounce" />
                    <h3 className="text-base font-bold text-slate-700">No se encontraron atajos o trucos</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        No hay combinaciones que coincidan con &ldquo;{searchQuery}&rdquo;. Intenta buscar con otros términos como &ldquo;F3&rdquo;, &ldquo;Enter&rdquo; o &ldquo;Gasolinera&rdquo;.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                    {filteredShortcuts.map((item) => {
                        const isHighlighted = highlightedId === item.id;
                        return (
                            <div
                                key={item.id}
                                className={`relative rounded-2xl border transition-all duration-300 p-5 flex flex-col justify-between overflow-hidden group ${
                                    item.isSecret
                                        ? 'bg-gradient-to-br from-amber-50/40 via-white to-orange-50/30 border-amber-200/70 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/10'
                                        : 'bg-white border-slate-200/80 hover:border-indigo-300 hover:shadow-lg hover:shadow-slate-200/50'
                                } ${isHighlighted ? 'ring-4 ring-indigo-500 ring-offset-2 scale-[1.02]' : ''}`}
                            >
                                {/* Secret ambient decoration */}
                                {item.isSecret && (
                                    <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-bl from-amber-500/10 to-transparent rounded-bl-full pointer-events-none" />
                                )}

                                <div className="space-y-3">
                                    {/* Top badge and module label */}
                                    <div className="flex items-center justify-between gap-2">
                                        {renderBadge(item.badgeType, item.badgeLabel)}
                                        <span className="text-[11px] font-bold text-slate-400 truncate max-w-[170px] text-right">
                                            {item.path}
                                        </span>
                                    </div>

                                    {/* Title and description */}
                                    <div>
                                        <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                            {item.title}
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                            {item.description}
                                        </p>
                                    </div>

                                    {/* Physical Keycaps Representation */}
                                    <div className="pt-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                                            Combinación de teclas
                                        </span>
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {item.keys.map((k, idx) => (
                                                <React.Fragment key={idx}>
                                                    {idx > 0 && (
                                                        <span className="text-slate-300 font-bold text-xs px-0.5">
                                                            +
                                                        </span>
                                                    )}
                                                    <kbd className={`inline-flex items-center justify-center min-w-[32px] px-2.5 py-1 text-xs font-mono font-black rounded-lg transition-all duration-150 shadow-sm select-none ${
                                                        item.isSecret
                                                            ? 'bg-amber-100/80 text-amber-900 border-2 border-amber-300/80 shadow-[0_2px_0_0_rgba(217,119,6,0.5)]'
                                                            : 'bg-slate-100 text-slate-800 border-2 border-slate-300 shadow-[0_2px_0_0_rgba(148,163,184,0.6)] group-hover:border-indigo-300 group-hover:text-indigo-700'
                                                    }`}>
                                                        {k}
                                                    </kbd>
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Detailed Instructions Box */}
                                    <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 space-y-1">
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                            <Info size={12} className="text-indigo-500" />
                                            <span>Instrucción de uso</span>
                                        </div>
                                        <p className="text-[11px] text-slate-600 leading-snug">
                                            {item.instructions}
                                        </p>
                                    </div>
                                </div>

                                {/* Footer info */}
                                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                                    <span className="font-semibold text-slate-500 flex items-center gap-1">
                                        <ArrowRight size={11} className="text-indigo-500" />
                                        {item.module}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default KeyboardShortcuts;
