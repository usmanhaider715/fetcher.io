/** @type {import('pm2').StartOptions[]} */
module.exports = {
  apps: [
    {
      name: 'fetcherio-api',
      cwd: '/var/www/fetcherio/apps/api',
      script: 'dist/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: { NODE_ENV: 'production', PORT: 4000 },
      max_memory_restart: '512M',
      error_file: '/var/log/fetcherio/api-error.log',
      out_file: '/var/log/fetcherio/api-out.log',
      merge_logs: true,
    },
    {
      name: 'fetcherio-worker',
      cwd: '/var/www/fetcherio/apps/api',
      script: 'dist/worker.js',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '256M',
      error_file: '/var/log/fetcherio/worker-error.log',
      out_file: '/var/log/fetcherio/worker-out.log',
    },
    {
      name: 'fetcherio-web',
      cwd: '/var/www/fetcherio/apps/web',
      script: '.next/standalone/apps/web/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production', PORT: 3020, HOSTNAME: '0.0.0.0' },
      max_memory_restart: '512M',
      error_file: '/var/log/fetcherio/web-error.log',
      out_file: '/var/log/fetcherio/web-out.log',
    },
  ],
};
