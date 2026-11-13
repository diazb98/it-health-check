import { test, expect } from '@playwright/test';
import { loadTargets } from '../src/config';
import { record, levelForTime, type Level } from '../src/result';

const { ui, thresholds } = loadTargets();

test.describe('Páginas web (navegador real)', () => {
  for (const target of ui) {
    test(target.name, async ({ page }, testInfo) => {
      let level: Level = 'ok';
      let message = '';
      let metric: string | undefined;

      try {
        const start = performance.now();
        const response = await page.goto(target.url, {
          waitUntil: 'domcontentloaded',
          timeout: thresholds.responseFailMs * 2,
        });
        await page
          .locator(target.expectVisible)
          .first()
          .waitFor({ state: 'visible', timeout: thresholds.responseFailMs });
        const elapsed = Math.round(performance.now() - start);
        metric = `${elapsed} ms`;

        const status = response?.status() ?? 0;
        if (status >= 400) {
          level = 'fail';
          message = `La página respondió HTTP ${status}`;
        } else {
          level = levelForTime(elapsed, thresholds.responseWarnMs * 2, thresholds.responseFailMs * 2);
          message =
            level === 'ok'
              ? `Carga correcta y "${target.expectVisible}" visible`
              : `Carga lenta, pero "${target.expectVisible}" visible`;
        }
      } catch (error) {
        level = 'fail';
        message = `No se encontró "${target.expectVisible}": ${(error as Error).message.split('\n')[0]}`;
      }

      await record(testInfo, {
        category: 'ui',
        name: target.name,
        target: target.url,
        level,
        metric,
        message,
        critical: target.critical,
      });

      expect(level, message).not.toBe('fail');
    });
  }
});
