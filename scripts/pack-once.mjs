import { build } from 'vite';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
process.chdir(root);

console.log('building in', root);
await build({ root, configFile: join(root, 'vite.config.js') });
console.log('vite build done');

await new Promise((resolve, reject) => {
  const p = spawn(process.execPath, [join(root, 'node_modules/@capacitor/cli/bin/capacitor'), 'sync', 'ios'], {
    cwd: root,
    stdio: 'inherit',
  });
  p.on('exit', code => (code === 0 ? resolve() : reject(new Error('cap sync ' + code))));
});
console.log('PACK DONE');
