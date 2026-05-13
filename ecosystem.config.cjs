module.exports = {
  apps: [
    {
      name: "caichong3",
      script: "npm",
      args: "run start",
      env: {
        NODE_ENV: "production",
        PORT: "3000"
      }
    },
    {
      name: "caichong3-market-sync",
      script: "scripts/sync-market-activity.mjs",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        PORT: "3000"
      }
    }
  ]
};
