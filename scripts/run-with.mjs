// Ejecuta el chequeo con otro archivo de objetivos, igual en Windows, macOS y Linux.
// Uso: node scripts/run-with.mjs config/demo.json [argumentos extra de Playwright]
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const [file, ...rest] = process.argv.slice(2);
if (!file || !fs.existsSync(file)) {
  console.error(`No se encontró el archivo de objetivos: ${file ?? '(sin indicar)'}`);
  process.exit(1);
}

const child = spawn('npx', ['playwright', 'test', ...rest], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, TARGETS_FILE: path.resolve(file) },
});
child.on('exit', (code) => process.exit(code ?? 1));
