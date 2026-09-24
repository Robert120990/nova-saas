/**
 * Unit Test for Master Catalog Schemas (Zod validation)
 */
const assert = require('assert');
const {
    categorySchema,
    sellerSchema,
    productSchema,
    customerSchema,
    providerSchema
} = require('../../src/schemas/catalogSchemas');

async function runTests() {
    console.log('--- Iniciando Pruebas de Esquemas de Catálogos (Zod) ---');

    // ==========================================
    // 1. Categorías
    // ==========================================
    console.log('[Test 1] Validando Categorías...');
    // Válido
    const catValid = categorySchema.safeParse({ name: 'Combustibles Premium', description: 'Gasolina y diesel' });
    assert(catValid.success, 'Categoría válida debe pasar');

    // Inválido (sin nombre)
    const catInvalid1 = categorySchema.safeParse({ description: 'Sin nombre' });
    assert(!catInvalid1.success, 'Categoría sin nombre debe fallar');
    assert(catInvalid1.error.issues[0].message.includes('obligatorio'), 'Mensaje debe indicar obligatorio');

    // Inválido (nombre vacío)
    const catInvalid2 = categorySchema.safeParse({ name: '   ' });
    assert(!catInvalid2.success, 'Categoría con nombre de solo espacios debe fallar');
    console.log('[Test 1 PASS] Categorías validada.');

    // ==========================================
    // 2. Vendedores
    // ==========================================
    console.log('[Test 2] Validando Vendedores...');
    // Válido
    const sellerValid = sellerSchema.safeParse({
        nombre: 'Carlos Gómez',
        codigo: 'VEND-01',
        email: 'carlos@empresa.com',
        telefono: '7777-8888',
        branch_id: 1
    });
    assert(sellerValid.success, 'Vendedor válido debe pasar');

    // Inválido (sin nombre)
    const sellerInvalid = sellerSchema.safeParse({ email: 'invalido@empresa.com' });
    assert(!sellerInvalid.success, 'Vendedor sin nombre debe fallar');

    // Inválido (correo con formato erróneo)
    const sellerBadEmail = sellerSchema.safeParse({ nombre: 'Juan', email: 'correo-invalido' });
    assert(!sellerBadEmail.success, 'Vendedor con correo mal formado debe fallar');
    console.log('[Test 2 PASS] Vendedores validada.');

    // ==========================================
    // 3. Productos
    // ==========================================
    console.log('[Test 3] Validando Productos...');
    // Válido
    const prodValid = productSchema.safeParse({
        codigo: 'PROD-001',
        nombre: 'Aceite 20W50 Shell Helix',
        precio_unitario: 12.50,
        costo: 8.25,
        stock_minimo: 10,
        category_id: 2
    });
    assert(prodValid.success, 'Producto válido debe pasar');

    // Válido con tipos enviados por el frontend (tipo_operacion numérico, booleano afecta_inventario, branches)
    const { productUpdateSchema } = require('../../src/schemas/catalogSchemas');
    const prodFrontendPayload = {
        codigo: 'PROD-002',
        nombre: 'Galón Gasolina Regular',
        tipo_operacion: 1, // number
        tipo_combustible: 1, // number
        afecta_inventario: true, // boolean
        permitir_existencia_negativa: false, // boolean
        costo: 3.85,
        stock_minimo: 100,
        codigo_barra: 741000123, // number coerced to string
        branches: [
            { branch_id: 1, precio_unitario: 4.25 },
            { branch_id: 2, precio_unitario: 4.30 }
        ]
    };
    const prodUpdateValid = productUpdateSchema.safeParse(prodFrontendPayload);
    assert(prodUpdateValid.success, 'Actualización de producto desde frontend debe pasar sin error de tipo string/number');
    assert.equal(prodUpdateValid.data.tipo_operacion, 1);
    assert.equal(prodUpdateValid.data.tipo_combustible, 1);
    assert.equal(prodUpdateValid.data.afecta_inventario, 1);
    assert.equal(prodUpdateValid.data.permitir_existencia_negativa, 0);
    assert.equal(prodUpdateValid.data.codigo_barra, '741000123');

    // Inválido (sin código)
    const prodNoCode = productSchema.safeParse({ nombre: 'Producto sin código' });
    assert(!prodNoCode.success, 'Producto sin código debe fallar');

    // Inválido (precio negativo)
    const prodNegativePrice = productSchema.safeParse({ codigo: 'P1', nombre: 'Test', precio_unitario: -5 });
    assert(!prodNegativePrice.success, 'Producto con precio negativo debe fallar');
    assert(prodNegativePrice.error.issues[0].message.includes('negativo'), 'Mensaje debe alertar número negativo');
    console.log('[Test 3 PASS] Productos validada.');

    // ==========================================
    // 4. Clientes
    // ==========================================
    console.log('[Test 4] Validando Clientes...');
    // Válido (con DUI homologado como NIT)
    const custValid = customerSchema.safeParse({
        nombre: 'Distribuidora San José S.A. de C.V.',
        tipo_documento: '36',
        nit: '0614-121285-102-1',
        correo: 'contacto@sanjose.com',
        es_credito: 1,
        limite_credito: 5000
    });
    assert(custValid.success, 'Cliente salvadoreño válido debe pasar');

    // Inválido (sin nombre)
    const custNoName = customerSchema.safeParse({ nit: '0614-121285-102-1' });
    assert(!custNoName.success, 'Cliente sin nombre debe fallar');

    // Inválido (NIT con ceros ficticios o incompleto)
    const custBadNit = customerSchema.safeParse({
        nombre: 'Cliente Prueba',
        nit: '000000000'
    });
    assert(!custBadNit.success, 'Cliente con NIT de ceros ficticios debe fallar');
    assert(custBadNit.error.issues[0].message.includes('NIT inválido'), 'Mensaje debe detallar error de NIT');

    // Inválido (correo mal formado)
    const custBadEmail = customerSchema.safeParse({
        nombre: 'Cliente Prueba',
        correo: 'cliente@invalido'
    });
    assert(!custBadEmail.success, 'Cliente con correo inválido debe fallar');
    console.log('[Test 4 PASS] Clientes validada.');

    // ==========================================
    // 5. Proveedores
    // ==========================================
    console.log('[Test 5] Validando Proveedores...');
    // Válido
    const provValid = providerSchema.safeParse({
        nombre: 'Puma El Salvador S.A.',
        nombre_comercial: 'Puma Energy',
        nrc: '12345-6',
        nit: '0614-010190-101-2',
        correo: 'ventas@puma.com'
    });
    assert(provValid.success, 'Proveedor válido debe pasar');

    // Inválido (sin nombre)
    const provNoName = providerSchema.safeParse({ nrc: '12345-6' });
    assert(!provNoName.success, 'Proveedor sin nombre debe fallar');
    console.log('[Test 5 PASS] Proveedores validada.');

    console.log('\n--- TODAS LAS PRUEBAS DE VALIDACIÓN DE CATÁLOGOS PASARON CON ÉXITO ---');
    process.exit(0);
}

runTests().catch(err => {
    console.error('Test falló:', err);
    process.exit(1);
});
