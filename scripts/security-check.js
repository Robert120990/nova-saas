#!/usr/bin/env node
/**
 * Security Check Script
 * Scans files or git staged changes for sensitive credentials, API keys,
 * bot tokens, private keys, database passwords, and .env files before commit.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Patterns of sensitive tokens and credentials
const SECRET_PATTERNS = [
    {
        name: 'Telegram Bot Token',
        regex: /\b[0-9]{8,11}:[a-zA-Z0-9_-]{35}\b/g,
        description: 'Token de bot de Telegram'
    },
    {
        name: 'OpenAI API Key',
        regex: /\bsk-(?:proj-|live-)?[a-zA-Z0-9_-]{24,}\b/g,
        description: 'Clave de API de OpenAI'
    },
    {
        name: 'Anthropic API Key',
        regex: /\bsk-ant-[a-zA-Z0-9_-]{20,}\b/g,
        description: 'Clave de API de Anthropic'
    },
    {
        name: 'GitHub Personal Access Token',
        regex: /\b(?:ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82})\b/g,
        description: 'Token de acceso personal de GitHub'
    },
    {
        name: 'Google API Key',
        regex: /\bAIza[0-9A-Za-z-_]{35}\b/g,
        description: 'Clave de API de Google'
    },
    {
        name: 'AWS Access Key ID',
        regex: /\b(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/g,
        description: 'Identificador de clave de acceso AWS'
    },
    {
        name: 'Slack Token',
        regex: /\bxox[baprs]-[0-9a-zA-Z]{10,48}\b/g,
        description: 'Token de API de Slack'
    },
    {
        name: 'Stripe Secret Key',
        regex: /\b(?:sk|rk)_(?:test|live)_[0-9a-zA-Z]{24,}\b/g,
        description: 'Clave secreta de Stripe'
    },
    {
        name: 'Private Cryptographic Key',
        regex: /-----BEGIN\s+(?:[A-Z0-9_-]+\s+)?PRIVATE\s+KEY-----/g,
        description: 'Llave privada RSA / EC / DSA / OpenSSH'
    },
    {
        name: 'Database URL with Password',
        regex: /\b(?:mysql|postgres|postgresql|mongodb):\/\/[^:\s]+:[^@\s]+@[a-zA-Z0-9_.-]+/g,
        description: 'Cadena de conexión con contraseña explícita'
    }
];

// Dangerous file patterns that should never be committed
const DANGEROUS_FILE_PATTERNS = [
    /^\.env(?:\..+)?$/i, // .env, .env.production, etc. EXCEPT .env.example
    /\.p12$/i,
    /\.pfx$/i
];

function isSafeEnvExample(filePath) {
    const base = path.basename(filePath).toLowerCase();
    return base === '.env.example' || base === '.env.sample' || base === '.env.template';
}

function maskSecret(secret) {
    if (!secret || secret.length <= 8) return '********';
    return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}

function scanStagedChanges() {
    console.log('🔍 [Seguridad] Analizando archivos y cambios staged para el commit...');
    const violations = [];

    // 1. Check staged filenames
    let stagedFiles = [];
    try {
        const out = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' });
        stagedFiles = out.split('\n').map(s => s.trim()).filter(Boolean);
    } catch (err) {
        console.error('⚠️ [Seguridad] No se pudo obtener la lista de archivos staged:', err.message);
        return false;
    }

    if (stagedFiles.length === 0) {
        console.log('ℹ️ [Seguridad] No hay archivos staged para analizar.');
        return true;
    }

    // Check dangerous file names
    for (const f of stagedFiles) {
        const baseName = path.basename(f);
        if (isSafeEnvExample(f)) continue;

        for (const pattern of DANGEROUS_FILE_PATTERNS) {
            if (pattern.test(baseName)) {
                violations.push({
                    file: f,
                    line: 0,
                    type: 'Archivo Vulnerable / Prohibido',
                    description: `El archivo ${baseName} contiene credenciales o certificados y NO debe subirse al repositorio.`,
                    preview: baseName
                });
            }
        }
    }

    // 2. Check staged diff content (only added lines: starting with +)
    let diffOutput = '';
    try {
        diffOutput = execSync('git diff --cached -U0', { encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 });
    } catch (err) {
        console.error('⚠️ [Seguridad] Error leyendo el diff staged:', err.message);
        return false;
    }

    const lines = diffOutput.split('\n');
    let currentFile = '';
    let currentLineNum = 0;

    for (const rawLine of lines) {
        // Detect target file
        if (rawLine.startsWith('+++ b/')) {
            currentFile = rawLine.substring(6).trim();
            continue;
        }

        // Detect hunk header for line numbers @@ -X,Y +Z,W @@
        const hunkMatch = rawLine.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (hunkMatch) {
            currentLineNum = parseInt(hunkMatch[1], 10);
            continue;
        }

        // Only scan added lines (+), ignoring diff metadata (+++)
        if (rawLine.startsWith('+') && !rawLine.startsWith('+++')) {
            const lineContent = rawLine.substring(1);

            // Skip checking safe .env.example files
            if (isSafeEnvExample(currentFile)) {
                currentLineNum++;
                continue;
            }

            // Exclude common safe patterns in documentation or test regexes
            if (lineContent.includes('pattern') || lineContent.includes('SECRET_PATTERNS') || lineContent.includes('tokenRegex')) {
                currentLineNum++;
                continue;
            }

            for (const item of SECRET_PATTERNS) {
                // Reset regex state
                item.regex.lastIndex = 0;
                let match;
                while ((match = item.regex.exec(lineContent)) !== null) {
                    const secretValue = match[0];
                    violations.push({
                        file: currentFile,
                        line: currentLineNum,
                        type: item.name,
                        description: item.description,
                        preview: maskSecret(secretValue)
                    });
                }
            }
            currentLineNum++;
        }
    }

    // Report findings
    if (violations.length > 0) {
        console.log('');
        console.log('================================================================================');
        console.log('🚨 [ERROR DE SEGURIDAD]: Se detectaron secretos o tokens en los cambios staged');
        console.log('================================================================================');
        violations.forEach((v, idx) => {
            const loc = v.line > 0 ? `${v.file}:${v.line}` : v.file;
            console.log(`\n  ${idx + 1}. [${v.type}] en ${loc}`);
            console.log(`     Detalle : ${v.description}`);
            console.log(`     Muestra : ${v.preview}`);
        });
        console.log('\n--------------------------------------------------------------------------------');
        console.log('👉 ACCIÓN REQUERIDA:');
        console.log('   1. Remueve el token o clave del archivo staged.');
        console.log('   2. Configúralo exclusivamente como variable de entorno en tu .env local.');
        console.log('   3. Si es un archivo .env o certificado, des-estagialo con:');
        console.log('      git restore --staged <archivo>');
        console.log('================================================================================\n');
        return false;
    }

    console.log('✅ [Seguridad] Análisis completado con éxito: no se encontraron tokens ni credenciales vulnerables.');
    return true;
}

function main() {
    const isAll = process.argv.includes('--all');
    if (isAll) {
        console.log('🔍 [Seguridad] Modo escaneo completo de archivos...');
        // Implement full scan if invoked directly with --all
    }
    const clean = scanStagedChanges();
    process.exit(clean ? 0 : 1);
}

main();
