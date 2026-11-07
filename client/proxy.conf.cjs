const { loadConfig } = require('./scripts/config.cjs');
const { target, secure } = loadConfig();

module.exports = {
  '/api': { target, secure },
  '/socket.io': { target, secure, ws: true },
};
