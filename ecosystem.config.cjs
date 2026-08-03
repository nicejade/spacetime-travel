/**
 * PM2 ecosystem for spacetime-travel (production).
 *
 * Usage:
 *   pnpm deploy          # build UI, then startOrReload
 *   pnpm pm2:logs
 *   pnpm pm2:stop
 *
 * Requires a global `pm2` on PATH. Single fork instance — SQLite is not multi-writer safe.
 */
module.exports = {
  apps: [
    {
      name: 'spacetime-travel',
      script: 'tsx',
      args: 'server/index.ts',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      out_file: 'logs/pm2-out.log',
      error_file: 'logs/pm2-error.log',
      env: {
        NODE_ENV: 'production',
        PORT: '5168',
      },
    },
  ],
};
