module.exports = {
  apps: [
    {
      name: 'server',
      cwd: './server',
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 4000
      },
      env_file: './server/.env',
      max_restarts: 10,
      restart_delay: 3000,
      error_file: './server/logs/error.log',
      out_file: './server/logs/out.log',
      merge_logs: true,
      time: true
    },
    {
      name: 'dte-api',
      cwd: './dte-api',
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      env_file: './dte-api/.env',
      max_restarts: 10,
      restart_delay: 3000,
      error_file: './dte-api/logs/error.log',
      out_file: './dte-api/logs/out.log',
      merge_logs: true,
      time: true
    },
    {
      name: 'client',
      cwd: './client',
      script: 'node_modules/serve/build/main.js',
      args: ['-s', 'dist', '-l', '3000', '--cors'],
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      max_restarts: 10,
      restart_delay: 3000,
      error_file: './client/logs/error.log',
      out_file: './client/logs/out.log',
      merge_logs: true,
      time: true
    },
    {
      name: 'webhook',
      cwd: '.',
      script: 'webhook-server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        WEBHOOK_PORT: 7777,
        WEBHOOK_SECRET: 'mi-secreto-cambiame',
        AUTO_UPDATE_BRANCH: 'main'
      },
      max_restarts: 10,
      restart_delay: 3000,
      error_file: './logs/webhook-error.log',
      out_file: './logs/webhook-out.log',
      merge_logs: true,
      time: true
    }
  ]
};
