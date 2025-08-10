module.exports = {
  apps: [
    {
      name: 'logistic-bot',
      script: 'src/index.ts',
      interpreter: 'npx',
      interpreter_args: 'tsx',
      cwd: '.',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      disable_logs: true,
    },
  ],
};