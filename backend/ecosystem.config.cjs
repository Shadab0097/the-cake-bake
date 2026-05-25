module.exports = {
  apps: [
    {
      name: 'cakebake-api',
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
