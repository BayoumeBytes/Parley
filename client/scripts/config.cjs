const { loadEnvFile } = require('node:process');
const path = require('node:path');

function parseClientEnv(env) {
  const host = env.DEV_HOST ?? 'localhost';
  if (!host || /[\s/]/.test(host)) throw new Error('Invalid DEV_HOST');
  const port = env.DEV_PORT ?? '4200';
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error('Invalid DEV_PORT: expected an integer between 1 and 65535');
  }
  let target;
  try {
    target = new URL(env.API_PROXY_TARGET ?? 'http://localhost:3000');
    if (
      !['http:', 'https:'].includes(target.protocol) ||
      target.username ||
      target.password ||
      target.pathname !== '/' ||
      target.search ||
      target.hash
    )
      throw new Error();
  } catch {
    throw new Error(
      'Invalid API_PROXY_TARGET: expected an HTTP(S) origin without credentials or a path',
    );
  }
  const tls = env.API_PROXY_VERIFY_TLS ?? 'true';
  if (!['true', 'false'].includes(tls)) {
    throw new Error('Invalid API_PROXY_VERIFY_TLS: expected true or false');
  }
  return { host, port: Number(port), target: target.origin, secure: tls === 'true' };
}

function loadConfig() {
  try {
    loadEnvFile(path.resolve(__dirname, '../.env'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error('Unable to load client/.env');
  }
  return parseClientEnv(process.env);
}

module.exports = { parseClientEnv, loadConfig };
