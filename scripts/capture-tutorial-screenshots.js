const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const os = require('os');
const { spawn } = require('child_process');
const jwt = require('../server/node_modules/jsonwebtoken');
const dotenv = require('../server/node_modules/dotenv');

dotenv.config({ path: path.join(__dirname, '../server/.env') });
const pool = require('../server/src/config/db');

const OUT_DIR = path.join(__dirname, '../client/public/tutorials');
const CHROME_PATHS = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];

const SCREENS = [
    { file: 'pos-terminal-access.png', route: '/ventas/nueva', minWaitMs: 1200, maxWaitMs: 18000 },
    { file: 'sales-history.png', route: '/ventas', minWaitMs: 1000, maxWaitMs: 15000 },
    { file: 'products-list.png', route: '/products', minWaitMs: 1000, maxWaitMs: 15000 },
    { file: 'categories-list.png', route: '/categories', minWaitMs: 800, maxWaitMs: 10000 },
    { file: 'combos-list.png', route: '/ventas/combos', minWaitMs: 800, maxWaitMs: 10000 },
    { file: 'promotions-list.png', route: '/ventas/promociones', minWaitMs: 800, maxWaitMs: 10000 },
    { file: 'customer-discounts.png', route: '/ventas/descuentos', minWaitMs: 800, maxWaitMs: 10000 },
    { file: 'customers-list.png', route: '/customers', minWaitMs: 1000, maxWaitMs: 15000 },
    { file: 'cash-closing.png', route: '/ventas/cierre', minWaitMs: 1000, maxWaitMs: 12000 },
    { file: 'sales-remesas.png', route: '/ventas/entrega-remesas', minWaitMs: 800, maxWaitMs: 12000 },
    { file: 'store-shift-report.png', route: '/ventas/reportes/tienda-turno', minWaitMs: 1000, maxWaitMs: 12000 },
    { file: 'gas-closeout.png', route: '/gas-station/cierre-lecturas', minWaitMs: 1000, maxWaitMs: 12000 },
    { file: 'gas-readings-history.png', route: '/gas-station/historial-lecturas', minWaitMs: 1000, maxWaitMs: 12000 },
    { file: 'fuel-prices.png', route: '/ventas/combustibles', minWaitMs: 800, maxWaitMs: 10000 },
    { file: 'gas-remesas.png', route: '/gas-station/entrega-remesas', minWaitMs: 800, maxWaitMs: 12000 },
    { file: 'gas-coupons.png', route: '/gas-station/liquidacion-cupones', minWaitMs: 800, maxWaitMs: 12000 },
    { file: 'gas-advances.png', route: '/gas-station/anticipos', minWaitMs: 800, maxWaitMs: 12000 },
    { file: 'gas-trupput.png', route: '/gas-station/trupput', minWaitMs: 800, maxWaitMs: 12000 }
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function checkUrl(url) {
    return new Promise((resolve) => {
        const mod = url.startsWith('https') ? https : http;
        const req = mod.get(url, { rejectUnauthorized: false, timeout: 1500 }, (res) => {
            res.resume();
            resolve(res.statusCode >= 200 && res.statusCode < 500);
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
    });
}

async function waitForUrl(url, maxWaitMs = 30000) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
        if (await checkUrl(url)) return true;
        await sleep(500);
    }
    throw new Error(`Timeout esperando a ${url}`);
}

function getJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let body = '';
            res.on('data', d => { body += d; });
            res.on('end', () => {
                try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

class CdpClient {
    constructor(wsUrl) {
        this.wsUrl = wsUrl;
        this.id = 1;
        this.pending = new Map();
    }
    connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.wsUrl);
            this.ws.addEventListener('open', () => resolve());
            this.ws.addEventListener('error', (err) => reject(err));
            this.ws.addEventListener('message', (event) => {
                const msg = JSON.parse(event.data);
                if (msg.id && this.pending.has(msg.id)) {
                    const { res, rej } = this.pending.get(msg.id);
                    this.pending.delete(msg.id);
                    if (msg.error) rej(new Error(msg.error.message || JSON.stringify(msg.error)));
                    else res(msg.result);
                }
            });
        });
    }
    send(method, params = {}) {
        const msgId = this.id++;
        return new Promise((res, rej) => {
            this.pending.set(msgId, { res, rej });
            this.ws.send(JSON.stringify({ id: msgId, method, params }));
        });
    }
    close() {
        try { this.ws.close(); } catch { /* ignore */ }
    }
}

async function waitForPageReady(cdp, minWaitMs = 900, maxWaitMs = 15000) {
    await sleep(minWaitMs);
    const start = Date.now();
    let lastMeta = { href: '', len: 0, loading: true };
    while (Date.now() - start < maxWaitMs) {
        const res = await cdp.send('Runtime.evaluate', {
            expression: `(() => {
                const txt = (document.body?.innerText || '').trim();
                const loading = txt.includes('Cargando registros') || txt.includes('Cargando...') || txt.includes('Cargando historial') || txt.includes('Actualizando...');
                return JSON.stringify({ href: location.href, len: txt.length, loading });
            })()`
        });
        lastMeta = JSON.parse(res.result?.value || '{}');
        if (!lastMeta.loading && lastMeta.len > 150) {
            await sleep(500);
            return lastMeta;
        }
        await sleep(450);
    }
    return lastMeta;
}

async function buildCaptureContext() {
    const [users] = await pool.query("SELECT id, username, nombre, email FROM users WHERE username = 'raul' LIMIT 1");
    const userRow = users[0] || { id: 1, username: 'admin', nombre: 'Administrador', email: 'admin@sipesv.com' };
    const [compRows] = await pool.query('SELECT id, razon_social, enabled_modules FROM companies WHERE id = 1 LIMIT 1');
    const [brRows] = await pool.query('SELECT id, nombre FROM branches WHERE company_id = 1 ORDER BY id ASC LIMIT 1');
    const [roleRows] = await pool.query('SELECT permissions FROM roles WHERE id = 1 LIMIT 1');

    const company = compRows[0] || { id: 1, razon_social: 'Inversiones Lil, S.A. de C.V.', enabled_modules: ['sales', 'purchases', 'inventory', 'gas_station'] };
    const branch = brRows[0] || { id: 1, nombre: 'Puma San Martin II' };
    let perms = [];
    try {
        perms = typeof roleRows[0]?.permissions === 'string'
            ? JSON.parse(roleRows[0].permissions)
            : (roleRows[0]?.permissions || []);
    } catch { perms = []; }

    const enabledModules = Array.isArray(company.enabled_modules)
        ? company.enabled_modules
        : (typeof company.enabled_modules === 'string' ? JSON.parse(company.enabled_modules) : ['sales', 'purchases', 'inventory', 'gas_station']);

    const token = jwt.sign(
        { id: userRow.id, username: userRow.username, company_id: company.id, branch_id: branch.id, role: 'SuperAdmin' },
        process.env.JWT_SECRET,
        { expiresIn: '20m' }
    );

    const userObj = {
        id: userRow.id,
        username: userRow.username,
        nombre: userRow.nombre,
        email: userRow.email,
        role: 'SuperAdmin',
        permissions: perms,
        default_dashboard: 'general',
        enabled_modules: enabledModules,
        company_id: company.id,
        branch_id: branch.id,
        company_name: company.razon_social,
        branch_name: branch.nombre
    };

    const [openShifts] = await pool.query(
        `SELECT sh.id as shift_id, sh.pos_id, sh.seller_id, s.nombre as seller_name, pos.nombre as pos_name
         FROM pos_shifts sh
         JOIN sellers s ON sh.seller_id = s.id
         LEFT JOIN points_of_sale pos ON sh.pos_id = pos.id
         WHERE sh.company_id = ? AND sh.branch_id = ? AND sh.status = 'open'
         ORDER BY sh.id DESC LIMIT 1`,
        [company.id, branch.id]
    );
    const [sellers] = await pool.query(
        "SELECT id, nombre, pos_id, branch_id FROM sellers WHERE company_id = ? AND branch_id = ? AND status = 'activo' LIMIT 1",
        [company.id, branch.id]
    );
    const [posRows] = await pool.query(
        'SELECT id, nombre FROM points_of_sale WHERE company_id = ? AND branch_id = ? LIMIT 1',
        [company.id, branch.id]
    );
    const [prodRows] = await pool.query(
        "SELECT id, codigo, nombre FROM products WHERE company_id = ? AND status = 'activo' LIMIT 1",
        [company.id]
    );
    const [gasCloseRows] = await pool.query(
        'SELECT id FROM gas_station_closeouts WHERE company_id = ? AND branch_id = ? ORDER BY id DESC LIMIT 1',
        [company.id, branch.id]
    );

    const openSh = openShifts[0] || null;
    const seller = sellers[0] || { id: 1, nombre: 'Vendedor Tienda', pos_id: posRows[0]?.id || 1, branch_id: branch.id };
    const pos = posRows[0] || { id: seller.pos_id || 1, nombre: 'TIENDA 1' };
    const prod = prodRows[0] || { id: 1, codigo: 'PROD-01', nombre: 'Producto Demo' };

    return {
        token,
        userObj,
        sellerSession: {
            seller_id: openSh ? openSh.seller_id : seller.id,
            seller_name: openSh ? openSh.seller_name : seller.nombre,
            branch_id: branch.id,
            branch_name: branch.nombre,
            pos_id: openSh ? openSh.pos_id : (seller.pos_id || pos.id),
            pos_name: openSh ? openSh.pos_name : pos.nombre
        },
        posDraft: {
            cart: [{
                product_id: prod.id,
                codigo: prod.codigo || 'PROD-01',
                nombre: prod.nombre,
                descripcion: prod.nombre,
                cantidad: 2,
                precio_unitario: 2.50,
                precio: 2.50,
                monto_descuento: 0,
                es_exento: false
            }],
            tipoDte: '01',
            condicionPago: '1'
        },
        latestCloseoutId: gasCloseRows[0]?.id || null
    };
}

function killTree(pid) {
    if (!pid) return;
    try { require('child_process').execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' }); } catch { /* ignore */ }
}

async function run() {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const chromeExe = CHROME_PATHS.find(p => fs.existsSync(p));
    if (!chromeExe) throw new Error('No se encontró Chrome/Edge instalado.');

    let serverProc = null;
    let clientProc = null;
    let chromeProc = null;
    const tempUserDir = path.join(os.tmpdir(), `sipe-tut-chrome-${Date.now()}`);

    try {
        if (!(await checkUrl('http://127.0.0.1:4000/api/catalogs/departments'))) {
            console.log('Iniciando backend temporal en :4000...');
            serverProc = spawn('node', ['src/index.js'], { cwd: path.join(__dirname, '../server'), stdio: 'ignore' });
            await waitForUrl('http://127.0.0.1:4000/api/catalogs/departments', 30000);
        }

        let clientBaseUrl = 'https://127.0.0.1:3000';
        let clientUp = await checkUrl(clientBaseUrl);
        if (!clientUp && await checkUrl('http://127.0.0.1:3000')) {
            clientBaseUrl = 'http://127.0.0.1:3000';
            clientUp = true;
        }
        if (!clientUp) {
            console.log('Iniciando frontend Vite temporal en :3000...');
            clientProc = spawn('cmd.exe', ['/c', 'npx', 'vite', '--port', '3000'], { cwd: path.join(__dirname, '../client'), stdio: 'ignore' });
            await waitForUrl('https://127.0.0.1:3000', 35000);
            clientBaseUrl = 'https://127.0.0.1:3000';
        }

        const ctx = await buildCaptureContext();
        const debugPort = 9225;
        chromeProc = spawn(chromeExe, [
            '--headless=new', '--disable-gpu', '--ignore-certificate-errors',
            '--no-first-run', '--no-default-browser-check', '--window-size=1480,880',
            `--remote-debugging-port=${debugPort}`, `--user-data-dir=${tempUserDir}`,
            `${clientBaseUrl}/login`
        ], { stdio: 'ignore' });

        await waitForUrl(`http://127.0.0.1:${debugPort}/json/list`, 15000);
        const targets = await getJson(`http://127.0.0.1:${debugPort}/json/list`);
        const pageTarget = targets.find(t => t.type === 'page') || targets[0];
        const cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
        await cdp.connect();
        await cdp.send('Page.enable');
        await cdp.send('Runtime.enable');
        await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1480, height: 880, deviceScaleFactor: 1, mobile: false });

        // Esperar a que /login esté completamente montado antes de inyectar localStorage
        await waitForPageReady(cdp, 1200, 15000);
        await cdp.send('Runtime.evaluate', {
            expression: `
                localStorage.setItem('token', ${JSON.stringify(ctx.token)});
                localStorage.setItem('user', ${JSON.stringify(JSON.stringify(ctx.userObj))});
                localStorage.setItem('sidebar-collapsed', 'false');
                'OK';
            `
        });

        const onlyPos = process.argv.includes('--only-pos');
        if (!onlyPos) {
            for (const scr of SCREENS) {
                await cdp.send('Page.navigate', { url: `${clientBaseUrl}${scr.route}` });
                const meta = await waitForPageReady(cdp, scr.minWaitMs, scr.maxWaitMs);
                const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
                const outPath = path.join(OUT_DIR, scr.file);
                fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
                console.log(`📸 ${scr.file} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB) -> ${meta.href}`);
                if (String(meta.href).includes('/login')) throw new Error(`Ruta ${scr.route} redirigió a /login`);
            }
        }

        // Capturar terminal POS activo (desbloqueado con turno abierto, vendedor asignado y producto en carrito)
        const sellerKey = `sipe_pos_seller_session_${ctx.userObj.id}_${ctx.userObj.company_id}_${ctx.userObj.branch_id}`;
        const draftKey = `sipe_pos_sale_draft_${ctx.userObj.id}_${ctx.userObj.company_id}_${ctx.userObj.branch_id}`;
        await cdp.send('Runtime.evaluate', {
            expression: `
                sessionStorage.setItem(${JSON.stringify(sellerKey)}, ${JSON.stringify(JSON.stringify(ctx.sellerSession))});
                localStorage.setItem(${JSON.stringify(draftKey)}, ${JSON.stringify(JSON.stringify(ctx.posDraft))});
                'OK';
            `
        });
        await cdp.send('Page.navigate', { url: `${clientBaseUrl}/ventas/nueva` });
        await waitForPageReady(cdp, 2200, 16000);
        const posShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(OUT_DIR, 'pos-terminal.png'), Buffer.from(posShot.data, 'base64'));
        console.log(`📸 pos-terminal.png (${(fs.statSync(path.join(OUT_DIR, 'pos-terminal.png')).size / 1024).toFixed(1)} KB)`);

        if (!onlyPos && ctx.latestCloseoutId) {
            await cdp.send('Page.navigate', { url: `${clientBaseUrl}/gas-station/cierre-lecturas?editId=${ctx.latestCloseoutId}` });
            await waitForPageReady(cdp, 1800, 15000);
            const sheetShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync(path.join(OUT_DIR, 'gas-closeout-sheet.png'), Buffer.from(sheetShot.data, 'base64'));
            console.log(`📸 gas-closeout-sheet.png (${(fs.statSync(path.join(OUT_DIR, 'gas-closeout-sheet.png')).size / 1024).toFixed(1)} KB)`);
        }

        cdp.close();
        console.log('✅ Todas las capturas reales completadas.');
    } finally {
        if (chromeProc) killTree(chromeProc.pid);
        if (clientProc) killTree(clientProc.pid);
        if (serverProc) killTree(serverProc.pid);
        try { fs.rmSync(tempUserDir, { recursive: true, force: true }); } catch { /* ignore */ }
        await pool.end().catch(() => {});
    }
}

run().catch((err) => {
    console.error('❌ Error capturando pantallas:', err);
    process.exit(1);
});
