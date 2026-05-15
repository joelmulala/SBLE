/**
 * PM2 process file — bare-metal deployment placeholder
 * Usage: pm2 start deploy/ecosystem.config.js
 */
module.exports = {
  apps: [
    {
      name: 'sble-api',
      cwd: './server',
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      max_memory_restart: '512M',
      error_file: './logs/sble-api-error.log',
      out_file: './logs/sble-api-out.log',
      merge_logs: true,
      time: true
    }
  ]
};
