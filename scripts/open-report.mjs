// Abre el reporte HTML en el navegador predeterminado (Windows, macOS o Linux).
import { exec } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const file = path.resolve('health-report', 'index.html');
if (!fs.existsSync(file)) {
  console.error('No hay reporte todavía. Ejecuta primero: npm run health');
  process.exit(1);
}
const cmd =
  process.platform === 'win32' ? `start "" "${file}"` : process.platform === 'darwin' ? `open "${file}"` : `xdg-open "${file}"`;
exec(cmd);
console.log(`Abriendo ${file}`);
