const http = require('http');
const crypto = require('crypto');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = process.env.WEBHOOK_PORT || 7777;
const SECRET = process.env.WEBHOOK_SECRET || 'mi-secreto-cambiame';
const BRANCH = process.env.AUTO_UPDATE_BRANCH || 'main';
const PROJECT_DIR = __dirname;

function verifySignature(payload, signature) {
  if (!SECRET || SECRET === 'mi-secreto-cambiame') return true;
  const sig = 'sha256=' + crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(signature));
}

function run(cmd, cwd = PROJECT_DIR) {
  console.log(`[webhook] Exec: ${cmd}`);
  try {
    const out = execSync(cmd, { cwd, timeout: 120000, encoding: 'utf8' });
    console.log(out);
    return out;
  } catch (err) {
    console.error(`[webhook] Error: ${err.stderr || err.message}`);
    throw err;
  }
}

function deploy() {
  console.log('[webhook] Starting auto-deploy...');

  run('git fetch origin');
  const status = run('git status -b');

  if (status.includes(`origin/${BRANCH}`) && !status.includes('up to date')) {
    run(`git pull origin ${BRANCH} --ff-only`);

    console.log('[webhook] Installing server dependencies...');
    run('npm install', path.join(PROJECT_DIR, 'server'));

    console.log('[webhook] Installing dte-api dependencies...');
    run('npm install', path.join(PROJECT_DIR, 'dte-api'));

    console.log('[webhook] Installing & building client...');
    run('npm install', path.join(PROJECT_DIR, 'client'));

    const VITE_API_URL = process.env.VITE_API_URL || 'http://localhost:4000';
    run(`set "VITE_API_URL=${VITE_API_URL}" && npm run build`, path.join(PROJECT_DIR, 'client'));

    console.log('[webhook] Restarting PM2 processes...');
    run('npx pm2 restart server');
    run('npx pm2 restart dte-api');
    run('npx pm2 restart client');

    console.log('[webhook] Deploy complete.');
  } else {
    console.log(`[webhook] No changes on ${BRANCH}.`);
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/webhook') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const sig = req.headers['x-hub-signature-256'] || '';
      if (!verifySignature(body, sig)) {
        res.writeHead(403);
        return res.end('Invalid signature');
      }

      let event;
      try {
        event = JSON.parse(body);
      } catch {
        res.writeHead(400);
        return res.end('Invalid JSON');
      }

      const ref = event.ref || '';
      if (ref === `refs/heads/${BRANCH}`) {
        res.writeHead(202, { 'Content-Type': 'text/plain' });
        res.end('Deploy started\n');
        deploy();
      } else {
        console.log(`[webhook] Ignored push to ${ref}`);
        res.writeHead(200);
        res.end(`Ignored (not ${BRANCH})`);
      }
    });
  } else if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[webhook] Listening on port ${PORT}`);
  console.log(`[webhook] Auto-deploy branch: ${BRANCH}`);
});
