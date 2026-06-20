const http = require('http');
const crypto = require('crypto');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = process.env.WEBHOOK_PORT || 7777;
const SECRET = process.env.WEBHOOK_SECRET || 'mi-secreto-cambiame';
const BRANCH = process.env.AUTO_UPDATE_BRANCH || 'main';
const PROJECT_DIR = __dirname;

function getPathVar() {
  // Windows may use PATH or Path
  return process.env.PATH || process.env.Path || '';
}

function getEnv() {
  // Find node/npm via fnm on Windows
  const fnmPaths = [];
  const candidates = [
    process.env.LOCALAPPDATA,
    process.env.USERPROFILE,
  ].filter(Boolean);
  for (const base of candidates) {
    const p = path.join(base, 'fnm');
    if (fs.existsSync(path.join(p, 'fnm.exe'))) {
      fnmPaths.push(p);
      break;
    }
  }
  // Also try common fnm node version path
  const userDir = process.env.LOCALAPPDATA || process.env.USERPROFILE || '';
  const versionDir = path.join(userDir, 'fnm', 'node-versions', 'v20.18.0', 'installation');
  if (fs.existsSync(path.join(versionDir, 'node.exe'))) {
    fnmPaths.push(versionDir);
    fnmPaths.push(path.join(versionDir, 'node_modules', '.bin'));
  }

  const env = { ...process.env };
  let currentPath = getPathVar();
  for (const p of fnmPaths) {
    if (!currentPath.includes(p)) {
      currentPath = `${p};${currentPath}`;
    }
  }
  env.PATH = currentPath;
  env.Path = currentPath;
  return env;
}

function run(cmd, cwd = PROJECT_DIR) {
  console.log(`[webhook] Exec: ${cmd}`);
  try {
    const out = execSync(cmd, { cwd, timeout: 180000, encoding: 'utf8', env: getEnv() });
    console.log(out);
    return out;
  } catch (err) {
    if (err.stderr) console.error(`[webhook] stderr: ${err.stderr}`);
    console.error(`[webhook] Error: ${err.message}`);
    throw err;
  }
}

function npmInstall(dir) {
  run('npm install --prefer-offline', dir);
}

function npmRunBuild(dir, envVars = {}) {
  const env = getEnv();
  Object.assign(env, envVars);
  console.log(`[webhook] Building client with VITE_API_URL=${env.VITE_API_URL}...`);
  const out = execSync('npm run build', { cwd: dir, timeout: 180000, encoding: 'utf8', env });
  console.log(out);
}

function deploy() {
  console.log('[webhook] Starting auto-deploy...');

  run('git fetch origin');
  const status = run('git status -b');

  if (status.includes(`origin/${BRANCH}`) && !status.includes('up to date')) {
    run(`git pull origin ${BRANCH} --ff-only`);

    console.log('[webhook] Installing server dependencies...');
    npmInstall(path.join(PROJECT_DIR, 'server'));

    console.log('[webhook] Installing dte-api dependencies...');
    npmInstall(path.join(PROJECT_DIR, 'dte-api'));

    console.log('[webhook] Installing & building client...');
    // Unset NODE_ENV so devDependencies (vite, etc.) are installed
    const envWithoutProd = { ...getEnv() };
    delete envWithoutProd.NODE_ENV;
    execSync('npm install --include=dev --prefer-offline', {
      cwd: path.join(PROJECT_DIR, 'client'),
      timeout: 180000,
      encoding: 'utf8',
      env: envWithoutProd
    });

    const VITE_API_URL = process.env.VITE_API_URL || 'http://localhost:4000';
    const buildEnv = { ...envWithoutProd, VITE_API_URL };
    console.log(`[webhook] Building client with VITE_API_URL=${VITE_API_URL}...`);
    execSync('npm run build', {
      cwd: path.join(PROJECT_DIR, 'client'),
      timeout: 180000,
      encoding: 'utf8',
      env: buildEnv
    });

    console.log('[webhook] Restarting PM2 processes...');
    run('npx pm2 restart server');
    run('npx pm2 restart dte-api');

    console.log('[webhook] Deploy complete.');
  } else {
    console.log(`[webhook] No changes on ${BRANCH}.`);
  }
}

function verifySignature(payload, signature) {
  if (!SECRET || SECRET === 'mi-secreto-cambiame') return true;
  const sig = 'sha256=' + crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(signature));
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
        try {
          deploy();
        } catch (e) {
          console.error('[webhook] Deploy failed:', e.message);
        }
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
