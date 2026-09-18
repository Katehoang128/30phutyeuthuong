import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const root = process.cwd();
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const children = [];
const fileEnv = {};

if (existsSync(`${root}/.env`)) {
  for (const line of readFileSync(`${root}/.env`, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && !match[1].startsWith('#')) {
      fileEnv[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

const baseEnv = { ...process.env, ...fileEnv };

function run(label, args, env) {
  const child = spawn(pnpm, args, {
    cwd: root,
    env: { ...baseEnv, ...env },
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });

  child.stdout.on('data', (chunk) => process.stdout.write(`[${label}] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[${label}] ${chunk}`));
  children.push(child);
  return child;
}

const apiBuild = spawn(pnpm, ['--filter', '@workspace/api-server', 'run', 'build'], {
  cwd: root,
  env: baseEnv,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

apiBuild.on('exit', (code) => {
  if (code !== 0) {
    process.exitCode = code ?? 1;
    return;
  }

  run('api', ['--filter', '@workspace/api-server', 'run', 'start'], { PORT: '5000' });
  run('web', ['--filter', '@workspace/30-phut-yeu-thuong', 'run', 'dev'], { PORT: '3000', BASE_PATH: '/' });
});

function stopAll() {
  for (const child of children) {
    child.kill('SIGTERM');
  }
}

process.on('SIGINT', () => {
  stopAll();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopAll();
  process.exit(0);
});
