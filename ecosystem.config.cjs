module.exports = {
  apps: [{
    name: "esmBot-manager",
    script: "utils/pm2/ext.js",
    autorestart: true,
    exp_backoff_restart_delay: 1000,
    watch: false,
    exec_mode: "fork"
  }]
};