const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const virtualPython = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const python = fs.existsSync(virtualPython) ? virtualPython : process.platform === 'win32' ? 'python' : 'python3';
const result = spawnSync(python, ['-X', 'utf8', 'build.py'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, PYTHONUTF8: '1' },
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
