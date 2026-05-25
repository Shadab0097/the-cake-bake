module.exports = {
  apps: [
    {
      name: 'cakebake-frontend',
      cwd: './frontend',
      script: './node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      exec_mode: 'fork',
      instances: process.env.FRONTEND_INSTANCES || 1,
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: process.env.FRONTEND_MAX_MEMORY || '512M',
    },
    {
      name: 'cakebake-api',
      cwd: './backend',
      script: 'server.js',
      exec_mode: 'cluster',
      instances: process.env.API_INSTANCES || 2,
      env: {
        NODE_ENV: 'production',
        PROCESS_ROLE: 'web',
        ENABLE_JOB_WORKER: 'false',
      },
      max_memory_restart: process.env.API_MAX_MEMORY || '512M',
    },
    {
      name: 'cakebake-notification-worker',
      cwd: './backend',
      script: 'server.js',
      exec_mode: 'fork',
      instances: process.env.NOTIFICATION_WORKER_INSTANCES || 1,
      env: {
        NODE_ENV: 'production',
        PROCESS_ROLE: 'worker',
        ENABLE_JOB_WORKER: 'true',
      },
      max_memory_restart: process.env.WORKER_MAX_MEMORY || '384M',
    },
    {
      name: 'cakebake-scheduler',
      cwd: './backend',
      script: 'server.js',
      exec_mode: 'fork',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PROCESS_ROLE: 'scheduler',
        ENABLE_JOB_WORKER: 'false',
      },
      max_memory_restart: process.env.SCHEDULER_MAX_MEMORY || '384M',
    },
  ],
};
