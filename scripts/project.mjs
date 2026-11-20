import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const npm = process.env.npm_execpath;
function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [npm, ...args], { cwd: root, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`npm ${args.join(' ')} failed (${code})`)));
  });
}
function createEnvironment(folder) {
  const target = path.join(root, folder, '.env');
  if (existsSync(target)) {
    console.log(`Keeping existing ${folder}/.env`);
    return;
  }
  const template = readFileSync(path.join(root, folder, '.env.example'), 'utf8');
  writeFileSync(target, template.replace('replace_with_a_random_secret', randomBytes(32).toString('hex')), { mode: 0o600, flag: 'wx' });
  console.log(`Created ${folder}/.env`);
}
async function main() {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Install Node.js 22 or newer.');
  if (!npm) throw new Error('Run this script through npm run setup, install:all, or dev.');
  const action = process.argv[2];
  if (action === 'setup' || action === 'install') {
    if (action === 'setup') for (const folder of ['backend', 'frontend']) createEnvironment(folder);
    for (const folder of ['backend', 'frontend']) await run(['--prefix', folder, 'ci']);
    if (action === 'setup') {
      await run(['--prefix', 'backend', 'run', 'doctor']);
      console.log('Next: npm run db:start (Docker), npm run db:setup, then npm run dev.');
    }
    return;
  }
  if (action !== 'dev') throw new Error(`Unknown action: ${action}`);
  for (const folder of ['backend', 'frontend']) {
    if (!existsSync(path.join(root, folder, '.env')) || !existsSync(path.join(root, folder, 'node_modules'))) {
      throw new Error('Run npm run setup first.');
    }
  }
  const children = [];
  let stopping = false;
  function stop(code = 0) {
    if (stopping) return;
    stopping = true;
    process.exitCode = code;
    for (const child of children) child.kill();
  }
  for (const [folder, args] of [
    ['backend', ['--watch', 'server.js']],
    ['frontend', ['node_modules/vite/bin/vite.js']],
  ]) {
    const child = spawn(process.execPath, args, { cwd: path.join(root, folder), stdio: 'inherit' });
    children.push(child);
    child.on('error', error => { console.error(error.message); stop(1); });
    child.on('exit', code => { if (!stopping) stop(code || 1); });
  }
  process.on('SIGINT', () => stop());
  process.on('SIGTERM', () => stop());
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
