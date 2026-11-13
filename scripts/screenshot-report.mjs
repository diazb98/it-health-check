// Genera capturas del reporte (claro y oscuro) para el README o LinkedIn.
import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const report = path.resolve('health-report', 'index.html');
if (!fs.existsSync(report)) {
  console.error('No hay reporte todavía. Ejecuta primero: npm run health');
  process.exit(1);
}
fs.mkdirSync('docs', { recursive: true });

const browser = await chromium.launch();
for (const colorScheme of ['light', 'dark']) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2, colorScheme });
  await page.goto(pathToFileURL(report).href);
  const out = path.join('docs', `reporte-${colorScheme}.png`);
  await page.screenshot({ path: out, fullPage: true });
  console.log(`Captura guardada: ${out}`);
}
await browser.close();
