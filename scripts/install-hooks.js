#!/usr/bin/env node
/**
 * Setup Script for Git Hooks
 * Installs pre-commit, commit-msg, and pre-push hooks into .git/hooks/
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const hooksDir = path.join(rootDir, '.git', 'hooks');

if (!fs.existsSync(hooksDir)) {
    console.error('❌ No se encontró el directorio .git/hooks.');
    process.exit(1);
}

// 1. pre-commit hook content
const preCommitContent = `#!/bin/sh
# Hook pre-commit: Bloquea commits si detecta tokens, claves o credenciales vulnerables
echo "🔒 [pre-commit] Verificando que no se incluyan tokens ni datos sensibles..."

if [ -f "scripts/security-check.js" ]; then
    node scripts/security-check.js
    STATUS=$?
    if [ $STATUS -ne 0 ]; then
        echo ""
        echo "❌ [ERROR pre-commit]: El commit fue CANCELADO para proteger credenciales y tokens del sistema."
        echo ""
        exit 1
    fi
fi

exit 0
`;

const preCommitPath = path.join(hooksDir, 'pre-commit');
fs.writeFileSync(preCommitPath, preCommitContent, { mode: 0o755 });
console.log('✅ Hook pre-commit instalado en .git/hooks/pre-commit');
