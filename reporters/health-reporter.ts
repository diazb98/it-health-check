import fs from 'node:fs';
import path from 'node:path';
import type { Reporter, TestCase, TestResult, FullResult } from '@playwright/test/reporter';
import { RESULT_ATTACHMENT, type HealthResult, type Category, type Level } from '../src/result';

interface Row extends HealthResult {
  screenshot?: string; // data URI
}

const CATEGORY_LABEL: Record<Category, string> = {
  api: 'APIs y servicios',
  ui: 'Páginas web',
  ssl: 'Certificados SSL',
};

const LEVEL_LABEL: Record<Level, string> = { ok: 'OK', warn: 'Atención', fail: 'Falla' };

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Reporter de Playwright que convierte los chequeos en un tablero HTML
 * de semáforos (index.html) y un resumen legible por máquinas (summary.json).
 */
export default class HealthReporter implements Reporter {
  private rows = new Map<string, Row>();
  private outputDir: string;
  private startedAt = new Date();

  constructor(options: { outputDir?: string } = {}) {
    this.outputDir = options.outputDir ?? 'health-report';
  }

  onBegin() {
    this.startedAt = new Date();
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const attachment = result.attachments.find((a) => a.name === RESULT_ATTACHMENT && a.body);
    const category = (test.parent.project()?.name ?? 'api') as Category;

    let row: Row;
    if (attachment?.body) {
      row = JSON.parse(attachment.body.toString('utf-8'));
    } else {
      // El chequeo se cayó antes de registrar su resultado (timeout, error inesperado).
      row = {
        category,
        name: test.title,
        target: '',
        level: result.status === 'passed' ? 'ok' : 'fail',
        message: result.error?.message?.split('\n')[0] ?? `Estado: ${result.status}`,
      };
    }

    const shot = result.attachments.find((a) => a.name === 'screenshot' && a.path);
    if (shot?.path && fs.existsSync(shot.path)) {
      row.screenshot = `data:image/png;base64,${fs.readFileSync(shot.path).toString('base64')}`;
    }

    // Con reintentos, nos quedamos con el último intento.
    this.rows.set(test.id, row);
  }

  async onEnd(result: FullResult) {
    const rows = [...this.rows.values()];
    const count = (level: Level) => rows.filter((r) => r.level === level).length;
    const summary = {
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - this.startedAt.getTime(),
      total: rows.length,
      ok: count('ok'),
      warn: count('warn'),
      fail: count('fail'),
      criticalFail: rows.filter((r) => r.level === 'fail' && r.critical).length,
      playwrightStatus: result.status,
      results: rows.map(({ screenshot, ...rest }) => rest),
    };

    fs.mkdirSync(this.outputDir, { recursive: true });
    fs.writeFileSync(path.join(this.outputDir, 'summary.json'), JSON.stringify(summary, null, 2));
    fs.writeFileSync(path.join(this.outputDir, 'index.html'), this.renderHtml(rows, summary));

    console.log(
      `\n🩺 IT Health Check: ${summary.ok} OK · ${summary.warn} atención · ${summary.fail} fallas` +
        `\n   Reporte: ${path.resolve(this.outputDir, 'index.html')}\n`,
    );
  }

  private renderHtml(rows: Row[], s: { total: number; ok: number; warn: number; fail: number; criticalFail: number; durationMs: number; generatedAt: string }): string {
    const overall: Level = s.criticalFail > 0 ? 'fail' : s.fail + s.warn > 0 ? 'warn' : 'ok';
    const overallText =
      overall === 'fail'
        ? `${s.criticalFail} sistema(s) crítico(s) con falla`
        : overall === 'warn'
          ? 'Operativo, con puntos de atención'
          : 'Todos los sistemas operativos';
    const health = s.total ? Math.round((s.ok / s.total) * 100) : 0;
    const date = new Date(s.generatedAt).toLocaleString('es', { dateStyle: 'full', timeStyle: 'short' });

    const order: Record<Level, number> = { fail: 0, warn: 1, ok: 2 };
    const sections = (Object.keys(CATEGORY_LABEL) as Category[])
      .map((cat) => {
        const items = rows.filter((r) => r.category === cat).sort((a, b) => order[a.level] - order[b.level]);
        if (!items.length) return '';
        return `
      <section>
        <h2>${CATEGORY_LABEL[cat]} <span class="muted">${items.filter((i) => i.level === 'ok').length}/${items.length} OK</span></h2>
        <div class="list">
          ${items
            .map(
              (r) => `
          <article class="row ${r.level}">
            <span class="dot" aria-hidden="true"></span>
            <div class="main">
              <div class="name">${esc(r.name)} ${r.critical ? '<span class="tag">crítico</span>' : ''}</div>
              <div class="target">${esc(r.target)}</div>
              <div class="msg">${esc(r.message)}</div>
              ${r.screenshot ? `<details><summary>Ver captura</summary><img src="${r.screenshot}" alt="Captura de ${esc(r.name)}"></details>` : ''}
            </div>
            <div class="side">
              <span class="badge">${LEVEL_LABEL[r.level]}</span>
              <span class="metric">${esc(r.metric ?? '')}</span>
            </div>
          </article>`,
            )
            .join('')}
        </div>
      </section>`;
      })
      .join('');

    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>IT Health Check</title>
<style>
  :root {
    --bg: #f6f7f9; --card: #ffffff; --text: #16181d; --muted: #646b78; --border: #e3e6eb;
    --ok: #1a8f4c; --ok-bg: #e6f5ec; --warn: #b26b00; --warn-bg: #fdf2dd; --fail: #c62828; --fail-bg: #fcE8e8;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0f1115; --card: #171a21; --text: #e8eaee; --muted: #9aa1ad; --border: #262b35;
      --ok: #4cc47f; --ok-bg: #12291c; --warn: #f0b04a; --warn-bg: #2d2412; --fail: #f06a6a; --fail-bg: #2f1616;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .wrap { max-width: 980px; margin: 0 auto; padding: 32px 16px 48px; }
  header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: end; gap: 8px; margin-bottom: 20px; }
  h1 { margin: 0; font-size: 26px; letter-spacing: -0.02em; }
  .muted { color: var(--muted); font-weight: 400; font-size: 14px; }
  .banner { display: flex; align-items: center; gap: 14px; padding: 18px 20px; border-radius: 14px; margin-bottom: 18px; font-weight: 600; font-size: 18px; }
  .banner.ok { background: var(--ok-bg); color: var(--ok); }
  .banner.warn { background: var(--warn-bg); color: var(--warn); }
  .banner.fail { background: var(--fail-bg); color: var(--fail); }
  .banner .big { width: 16px; height: 16px; border-radius: 50%; background: currentColor; box-shadow: 0 0 0 6px color-mix(in srgb, currentColor 20%, transparent); }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }
  .kpi { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; }
  .kpi b { display: block; font-size: 28px; line-height: 1.1; font-variant-numeric: tabular-nums; }
  .kpi.ok b { color: var(--ok); } .kpi.warn b { color: var(--warn); } .kpi.fail b { color: var(--fail); }
  h2 { font-size: 17px; margin: 26px 0 10px; }
  .list { display: grid; gap: 8px; }
  .row { display: flex; gap: 14px; background: var(--card); border: 1px solid var(--border); border-left: 4px solid var(--c); border-radius: 10px; padding: 12px 14px; }
  .row.ok { --c: var(--ok); --cb: var(--ok-bg); } .row.warn { --c: var(--warn); --cb: var(--warn-bg); } .row.fail { --c: var(--fail); --cb: var(--fail-bg); }
  .dot { flex: none; width: 10px; height: 10px; margin-top: 7px; border-radius: 50%; background: var(--c); }
  .main { flex: 1; min-width: 0; }
  .name { font-weight: 600; }
  .target { color: var(--muted); font-size: 13px; overflow-wrap: anywhere; }
  .msg { margin-top: 2px; }
  .side { display: flex; flex-direction: column; align-items: end; gap: 4px; flex: none; }
  .badge { background: var(--cb); color: var(--c); font-weight: 600; font-size: 12px; padding: 2px 10px; border-radius: 999px; }
  .metric { color: var(--muted); font-size: 13px; font-variant-numeric: tabular-nums; }
  .tag { font-size: 11px; font-weight: 600; color: var(--muted); border: 1px solid var(--border); border-radius: 4px; padding: 0 5px; margin-left: 4px; vertical-align: 2px; }
  details { margin-top: 8px; } summary { cursor: pointer; color: var(--muted); font-size: 13px; }
  details img { display: block; max-width: 100%; margin-top: 8px; border: 1px solid var(--border); border-radius: 8px; }
  footer { margin-top: 36px; color: var(--muted); font-size: 13px; text-align: center; }
  @media (max-width: 600px) {
    .kpis { grid-template-columns: repeat(2, 1fr); }
    .row { flex-wrap: wrap; } .side { flex-direction: row; align-items: center; width: 100%; padding-left: 24px; }
  }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>🩺 IT Health Check</h1>
    <span class="muted">${esc(date)} · ${(s.durationMs / 1000).toFixed(1)} s</span>
  </header>
  <div class="banner ${overall}"><span class="big"></span>${overallText}</div>
  <div class="kpis">
    <div class="kpi"><span class="muted">Salud general</span><b>${health}%</b></div>
    <div class="kpi ok"><span class="muted">Operativos</span><b>${s.ok}</b></div>
    <div class="kpi warn"><span class="muted">Atención</span><b>${s.warn}</b></div>
    <div class="kpi fail"><span class="muted">Fallas</span><b>${s.fail}</b></div>
  </div>
  ${sections}
  <footer>Generado con Playwright · IT Health Check</footer>
</div>
</body>
</html>`;
  }
}
