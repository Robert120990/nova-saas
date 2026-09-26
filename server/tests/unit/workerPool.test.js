/**
 * Test & Benchmark for Worker Thread Pool & Excel Service
 */
const assert = require('assert');
const excelService = require('../../src/services/excel.service');
const { reportWorkerPool } = require('../../src/services/reportWorkerPool.service');

async function runTests() {
    console.log('--- Iniciando Pruebas de Worker Threads Pool ---');

    // 1. Check pool status
    console.log(`[Test 1] Verificando inicialización del pool: ${reportWorkerPool.workers.length} workers activos.`);
    assert(reportWorkerPool.workers.length > 0, 'El pool de workers debería tener al menos 1 worker');

    // 2. Generate sample dataset
    const sampleData = [];
    for (let i = 1; i <= 2000; i++) {
        sampleData.push({
            id: i,
            codigo: `PROD-${String(i).padStart(5, '0')}`,
            nombre: `Producto de Prueba No. ${i}`,
            categoria: i % 2 === 0 ? 'Combustible' : 'Lubricante',
            precio: (Math.random() * 100).toFixed(2),
            stock: Math.floor(Math.random() * 500)
        });
    }

    const testSheets = [{
        name: 'Productos',
        columns: [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Código', key: 'codigo', width: 15 },
            { header: 'Nombre', key: 'nombre', width: 35 },
            { header: 'Categoría', key: 'categoria', width: 20 },
            { header: 'Precio ($)', key: 'precio', width: 15 },
            { header: 'Stock', key: 'stock', width: 15 }
        ],
        data: sampleData
    }];

    // 3. Test non-blocking Excel generation with Worker Thread
    console.log('[Test 2] Generando Excel de 2,000 registros mediante Worker Thread...');
    const startTime = Date.now();
    const buffer = await excelService.createExcelBuffer({
        title: 'Reporte General de Productos (Test Worker)',
        sheets: testSheets
    });
    const duration = Date.now() - startTime;

    assert(Buffer.isBuffer(buffer), 'El resultado debe ser un Buffer válido');
    assert(buffer.length > 1000, `El tamaño del buffer (${buffer.length} bytes) parece insuficiente`);

    // Verify XLSX magic header: PK\x03\x04 (50 4B 03 04)
    const isZip = buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;
    assert(isZip, 'El archivo generado debe tener la firma binaria de archivo XLSX/ZIP válido (50 4B 03 04)');
    console.log(`[Test 2 PASS] Excel generado exitosamente en ${duration}ms (${(buffer.length / 1024).toFixed(2)} KB).`);

    // 4. Test fallback to synchronous execution
    console.log('[Test 3] Probando fallback síncrono createExcelBufferSync...');
    const syncStart = Date.now();
    const syncBuffer = await excelService.createExcelBufferSync({
        title: 'Reporte Síncrono Fallback',
        sheets: testSheets.slice(0, 1)
    });
    const syncDuration = Date.now() - syncStart;
    assert(Buffer.isBuffer(syncBuffer), 'El fallback debe retornar un Buffer');
    const isSyncZip = syncBuffer[0] === 0x50 && syncBuffer[1] === 0x4B && syncBuffer[2] === 0x03 && syncBuffer[3] === 0x04;
    assert(isSyncZip, 'El archivo síncrono debe ser un XLSX/ZIP válido');
    console.log(`[Test 3 PASS] Fallback síncrono completado en ${syncDuration}ms.`);

    // 5. Test concurrent requests to Worker Pool
    console.log('[Test 4] Probando 4 peticiones concurrentes simultáneas al Worker Pool...');
    const concurrentStart = Date.now();
    const tasks = [1, 2, 3, 4].map(idx => excelService.createExcelBuffer({
        title: `Reporte Concurrente ${idx}`,
        sheets: [{
            name: `Hoja ${idx}`,
            columns: [{ header: 'Item', key: 'item', width: 20 }],
            data: [{ item: `Dato ${idx}` }]
        }]
    }));

    const results = await Promise.all(tasks);
    assert(results.length === 4, 'Todas las 4 tareas concurrentes deben completarse');
    results.forEach((b, idx) => {
        assert(Buffer.isBuffer(b), `Resultado concurrente ${idx + 1} debe ser Buffer`);
    });
    console.log(`[Test 4 PASS] 4 reportes concurrentes procesados en paralelo en ${Date.now() - concurrentStart}ms.`);

    console.log('\n--- TODOS LOS TESTS DE WORKER THREADS PASARON SATISFACTORIAMENTE ---');
    await reportWorkerPool.terminateAll();
    process.exit(0);
}

runTests().catch(err => {
    console.error('Test falló:', err);
    process.exit(1);
});
