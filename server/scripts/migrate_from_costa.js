const mysql = require('mysql2/promise');

const SOURCE_DB = 'db_sipe_costa';
const COMPANY_ID = 1;
const BRANCH_ID = 1;
const POS_NAMES = ['Tienda 1', 'Tienda 2'];

function levenshtein(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
    for (let j = 0; j <= a.length; j++) { matrix[0][j] = j; }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
            }
        }
    }
    return matrix[b.length][a.length];
}

function normalize(s) {
    return (s || '').toLowerCase().trim().replace(/[^a-z0-9 ]/g, '');
}

function findMatchingCategory(srcName, existingCategories) {
    const nSrc = normalize(srcName);
    const srcWords = nSrc.split(/\s+/).filter(w => w.length > 2);

    for (const cat of existingCategories) {
        const nTgt = normalize(cat.name);
        const tgtWords = nTgt.split(/\s+/).filter(w => w.length > 2);

        // Exact match
        if (nSrc === nTgt) return cat;

        // One contains the other
        if (nSrc.includes(nTgt) || nTgt.includes(nSrc)) return cat;

        // Levenshtein distance <= 2
        if (levenshtein(nSrc, nTgt) <= 2) return cat;

        // Single significant word matches (word from src found in target or vice versa)
        for (const w of srcWords) {
            if (tgtWords.includes(w)) return cat;
        }
    }
    return null;
}

async function main() {
    const src = await mysql.createConnection({
        host: 'localhost',
        user: 'sysadmin',
        password: 'QwErTy123',
        database: SOURCE_DB
    });
    const tgt = await mysql.createConnection({
        host: '5.252.55.29',
        user: 'sysadmin',
        password: 'QwErTy?123',
        database: 'db_sistema_saas'
    });

    console.log('=== Migracion desde db_sipe_costa ===\n');

    // 0. Obtener sucursal y POS
    console.log('[0] Obteniendo sucursal y puntos de venta...');
    const [branches] = await tgt.query('SELECT id, codigo, nombre FROM branches WHERE company_id = ? AND id = ?', [COMPANY_ID, BRANCH_ID]);
    if (branches.length === 0) throw new Error('Sucursal 1 no encontrada');
    console.log('  Sucursal:', branches[0].nombre);

    const posIds = [];
    for (const posName of POS_NAMES) {
        const [pos] = await tgt.query('SELECT id FROM points_of_sale WHERE company_id = ? AND branch_id = ? AND nombre = ?', [COMPANY_ID, BRANCH_ID, posName]);
        if (pos.length > 0) { posIds.push(pos[0].id); console.log('  POS encontrado:', posName, '(id=' + pos[0].id + ')'); }
        else { console.log('  ATENCION: POS "' + posName + '" no encontrado'); }
    }

    // 1. Obtener categorias existentes en destino
    console.log('\n[1] Cargando categorias existentes en destino...');
    const [existingCats] = await tgt.query('SELECT id, name FROM product_categories WHERE company_id = ?', [COMPANY_ID]);
    const existingCatMap = new Map(existingCats.map(c => [normalize(c.name), c]));
    console.log('  Categorias existentes:', existingCats.length);

    // 2. Migrar categorias (tipos_linea -> product_categories)
    console.log('\n[2] Migrando categorias (tipos_linea -> product_categories)...');
    const [lineas] = await src.query('SELECT id, descripcion FROM tipos_linea');
    const categoryMap = new Map();
    let catCreated = 0, catMatched = 0;

    for (const line of lineas) {
        const match = findMatchingCategory(line.descripcion, existingCats);
        let catId;
        if (match) {
            catId = match.id;
            catMatched++;
            console.log('  MATCH: "' + line.descripcion + '" -> "' + match.name + '" (id=' + catId + ')');
        } else {
            const [result] = await tgt.query('INSERT INTO product_categories (name, company_id) VALUES (?, ?)', [line.descripcion, COMPANY_ID]);
            catId = result.insertId;
            catCreated++;
            console.log('  CREADA: "' + line.descripcion + '" (id=' + catId + ')');
            // Add to existing categories list for subsequent matches
            existingCats.push({ id: catId, name: line.descripcion });
        }
        categoryMap.set(line.id, catId);
    }
    console.log('  Total: ' + catMatched + ' matcheadas, ' + catCreated + ' creadas');

    // 3. Construir modelo de palabras clave por categoria
    console.log('\n[3] Analizando palabras clave por categoria para correccion por nombre...');
    const [allProducts] = await src.query('SELECT id_linea, descripcion FROM productos');
    const categoryKeywords = {};
    const STOPWORDS = new Set(['DE', 'LA', 'EL', 'EN', 'Y', 'A', 'CON', 'POR', 'PARA', 'LOS', 'LAS', 'DEL', 'E', 'O', 'SU', 'QUE', 'SE', 'NO', 'UN', 'UNA', 'AL', 'LE', 'LO', 'X', 'C', 'SIN']);

    for (const p of allProducts) {
        const catId = p.id_linea;
        if (!categoryKeywords[catId]) categoryKeywords[catId] = {};
        if (!p.descripcion) continue;
        const words = p.descripcion.toUpperCase().split(/[\s/]+/);
        for (const word of words) {
            if (word.length < 3) continue;
            if (STOPWORDS.has(word)) continue;
            categoryKeywords[catId][word] = (categoryKeywords[catId][word] || 0) + 1;
        }
    }

    const wordCategoryScore = {};
    for (const [catId, words] of Object.entries(categoryKeywords)) {
        for (const [word, count] of Object.entries(words)) {
            if (!wordCategoryScore[word]) wordCategoryScore[word] = {};
            wordCategoryScore[word][catId] = count;
        }
    }

    const strongKeywordCategory = {};
    for (const [word, catScores] of Object.entries(wordCategoryScore)) {
        const cats = Object.keys(catScores);
        if (cats.length === 1 && catScores[cats[0]] >= 3) {
            strongKeywordCategory[word] = cats[0];
        } else if (cats.length > 1) {
            let total = 0, maxCat = null, maxCount = 0;
            for (const [catId, count] of Object.entries(catScores)) {
                total += count;
                if (count > maxCount) { maxCount = count; maxCat = catId; }
            }
            if (maxCount > 0 && maxCount / total > 0.7 && maxCount >= 3) {
                strongKeywordCategory[word] = maxCat;
            }
        }
    }
    console.log('  Palabras clave significativas:', Object.keys(strongKeywordCategory).length);

    function detectCategoryByName(descripcion) {
        if (!descripcion) return null;
        const words = descripcion.toUpperCase().split(/[\s/]+/);
        const scores = {};
        for (const word of words) {
            const cat = strongKeywordCategory[word];
            if (cat) scores[cat] = (scores[cat] || 0) + (categoryKeywords[cat][word] || 1);
        }
        let bestCat = null, bestScore = 0;
        for (const [catId, score] of Object.entries(scores)) {
            if (score > bestScore) { bestScore = score; bestCat = catId; }
        }
        return bestCat;
    }

    // Pre-load existing product codes
    const [existingCodes] = await tgt.query('SELECT codigo FROM products WHERE company_id = ?', [COMPANY_ID]);
    const existingCodeSet = new Set(existingCodes.map(r => r.codigo));
    console.log('  Codigos existentes cargados:', existingCodeSet.size);

    // 4. Migrar productos
    console.log('\n[4] Migrando productos...');
    const [srcProducts] = await src.query('SELECT p.*, t.descripcion as linea_desc FROM productos p LEFT JOIN tipos_linea t ON p.id_linea = t.id ORDER BY p.codigo');
    let created = 0, skipped = 0, categoryCorrected = 0;

    for (const p of srcProducts) {
        // Skip if codigo already exists in target
        if (existingCodeSet.has(p.codigo)) {
            skipped++;
            continue;
        }

        // Determine category with keyword correction
        let catId = categoryMap.get(p.id_linea) || null;
        const detectedCatId = detectCategoryByName(p.descripcion);
        if (detectedCatId && detectedCatId !== p.id_linea) {
            const newCatId = categoryMap.get(detectedCatId);
            if (newCatId) {
                const oldCatName = p.linea_desc || 'desconocida';
                const newCat = lineas.find(l => l.id === detectedCatId);
                const newCatName = newCat ? newCat.descripcion : 'desconocida';
                console.log('  CORREGIDO: [' + p.codigo + '] ' + (p.descripcion || '').trim() + ' -> ' + oldCatName + ' => ' + newCatName);
                catId = newCatId;
                categoryCorrected++;
            }
        }

        const tributes = [];
        if (p.con_fovial) tributes.push('FOVIAL');
        if (p.con_cotrans) tributes.push('COTRANS');
        tributes.push('01');

        const productData = {
            company_id: COMPANY_ID,
            codigo: p.codigo,
            nombre: (p.descripcion || '').trim(),
            codigo_barra: p.barra || null,
            descripcion: (p.descripcion || '').trim(),
            unidad_medida: '59',
            tipo_item: 'bien',
            tipo_operacion: 1,
            tipo_combustible: 0,
            category_id: catId,
            provider_id: null,
            costo: p.costo || 0,
            es_exento: p.es_exento || 0,
            status: 'activo',
            afecta_inventario: 1,
            stock_minimo: 0,
            permitir_existencia_negativa: 1
        };

        try {
            await tgt.query('START TRANSACTION');

            const [result] = await tgt.query('INSERT INTO products SET ?', [productData]);
            const productId = result.insertId;

            // Assign to branch
            await tgt.query('INSERT INTO product_branch (product_id, branch_id) VALUES (?, ?)', [productId, BRANCH_ID]);

            // Set per-branch price
            await tgt.query('INSERT INTO product_branch_prices (product_id, branch_id, precio_unitario) VALUES (?, ?, ?)',
                [productId, BRANCH_ID, p.precio_sugerido || 0]);

            // Assign to POS terminals
            for (const posId of posIds) {
                await tgt.query('INSERT IGNORE INTO product_pos (product_id, pos_id) VALUES (?, ?)', [productId, posId]);
            }

            // Initialize inventory
            await tgt.query('INSERT IGNORE INTO inventory (product_id, branch_id, stock) VALUES (?, ?, 0)', [productId, BRANCH_ID]);

            // Insert tributes
            if (tributes.length > 0) {
                const tributeValues = tributes.map(tc => [productId, tc]);
                await tgt.query('INSERT INTO product_tributes (product_id, tribute_code) VALUES ?', [tributeValues]);
            }

            await tgt.query('COMMIT');
            created++;

            if (created % 500 === 0) process.stdout.write('  Progreso: ' + created + ' productos creados...\n');
        } catch (err) {
            await tgt.query('ROLLBACK');
            console.error('  ERROR: ' + p.codigo + ': ' + err.message);
        }
    }

    console.log('\n=== Resumen Final ===');
    console.log('  Categorias: ' + catMatched + ' matcheadas, ' + catCreated + ' creadas');
    console.log('  Productos: ' + created + ' creados, ' + skipped + ' omitidos (ya existian), ' + categoryCorrected + ' corregidos por nombre');

    await src.end();
    await tgt.end();
    console.log('\n=== Migracion Finalizada ===');
}

main().catch(err => { console.error('Error fatal:', err); process.exit(1); });



