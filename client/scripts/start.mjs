import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import configuration from './config.cjs';

const require = createRequire(import.meta.url);
const config = configuration.loadConfig();
const args = process.argv.slice(2);
const hasOption = (name) => args.some((arg) => arg === name || arg.startsWith(`${name}=`));
const defaults = [
  ...(!hasOption('--host') ? ['--host', config.host] : []),
  ...(!hasOption('--port') ? ['--port', String(config.port)] : []),
];
const child = spawn(
  process.execPath,
  [require.resolve('@angular/cli/bin/ng.js'), 'serve', ...defaults, ...args],
  {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    stdio: 'inherit',
    env: process.env,
  },
);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
child.on('error', () => {
  console.error('Unable to start Angular CLI');
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 1);
});
