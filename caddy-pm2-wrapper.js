const { spawn } = require('child_process');
const path = require('path');

const configFile = process.env.CADDY_CONFIG || 'Caddyfile';
const configPath = path.resolve(__dirname, configFile);
const caddy = spawn('caddy', ['run', '--config', configPath], {
    stdio: ['ignore', 'inherit', 'inherit'],
    shell: true
});

caddy.on('close', (code) => {
    process.exit(code);
});

process.on('SIGINT', () => caddy.kill('SIGINT'));
process.on('SIGTERM', () => caddy.kill('SIGTERM'));
