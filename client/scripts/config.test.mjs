import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import configuration from './config.cjs';

const { parseClientEnv } = configuration;
test('loads the project env file independently of cwd and preserves process overrides', () => {
  const directory = mkdtempSync(join(tmpdir(), 'parley-config-'));
  try {
    mkdirSync(join(directory, 'scripts'));
    copyFileSync(new URL('./config.cjs', import.meta.url), join(directory, 'scripts/config.cjs'));
    writeFileSync(
      join(directory, '.env'),
      'DEV_PORT=4300\nAPI_PROXY_TARGET=http://localhost:3100\n',
    );
    const env = { ...process.env };
    for (const key of ['DEV_HOST', 'DEV_PORT', 'API_PROXY_TARGET', 'API_PROXY_VERIFY_TLS']) {
      delete env[key];
    }
    env.DEV_PORT = '4400';
    const child = spawnSync(
      process.execPath,
      [
        '-e',
        `console.log(JSON.stringify(require(${JSON.stringify(join(directory, 'scripts/config.cjs'))}).loadConfig()))`,
      ],
      { cwd: tmpdir(), env, encoding: 'utf8' },
    );
    assert.equal(child.status, 0, child.stderr);
    assert.deepEqual(JSON.parse(child.stdout), {
      host: 'localhost',
      port: 4400,
      target: 'http://localhost:3100',
      secure: true,
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('development defaults preserve same-origin API and Socket.IO proxying', () => {
  assert.deepEqual(parseClientEnv({}), {
    host: 'localhost',
    port: 4200,
    target: 'http://localhost:3000',
    secure: true,
  });
});
test('custom development ports and HTTPS proxy configuration', () => {
  assert.deepEqual(
    parseClientEnv({
      DEV_HOST: '127.0.0.1',
      DEV_PORT: '4300',
      API_PROXY_TARGET: 'https://localhost:3443',
      API_PROXY_VERIFY_TLS: 'false',
    }),
    { host: '127.0.0.1', port: 4300, target: 'https://localhost:3443', secure: false },
  );
});
for (const [key, value] of [
  ['DEV_PORT', '0'],
  ['DEV_PORT', '65536'],
  ['DEV_PORT', '42x'],
  ['DEV_HOST', ''],
  ['API_PROXY_VERIFY_TLS', 'yes'],
  ['API_PROXY_TARGET', 'ftp://localhost'],
  ['API_PROXY_TARGET', 'https://user:secret@localhost'],
  ['API_PROXY_TARGET', 'http://localhost/api'],
]) {
  test(`invalid ${key} is rejected without leaking its value`, () => {
    assert.throws(
      () => parseClientEnv({ [key]: value }),
      (error) => {
        assert.ok(error.message.includes(key));
        assert.ok(!error.message.includes('secret'));
        return true;
      },
    );
  });
}
