import { spawnSync } from 'node:child_process';

let cached;
export function getPythonCommand() {
  if (cached) return cached;
  const candidates = process.env.PYTHON_BIN
    ? [[process.env.PYTHON_BIN, []]]
    : process.platform === 'win32'
      ? [['py', ['-3']], ['python', []], ['python3', []]]
      : [['python3', []], ['python', []]];
  for (const [command, args] of candidates) {
    const result = spawnSync(command, [...args, '-c', 'import sys; print(sys.version_info.major)'], { encoding: 'utf8', timeout: 5000 });
    if (result.status === 0 && result.stdout.trim() === '3') {
      cached = { command, args };
      return cached;
    }
  }
  throw new Error('Python 3 was not found. Install it and add it to PATH, or set PYTHON_BIN in backend/.env to its executable path.');
}
