import { test, expect } from '@playwright/test';
import { loadTargets } from '../src/config';
import { record, levelForTime, type Level } from '../src/result';

const { api, thresholds } = loadTargets();

test.describe('APIs y servicios', () => {
  for (const target of api) {
    test(target.name, async ({ request }, testInfo) => {
      const expectedStatus = target.expectStatus ?? 200;
      const start = performance.now();
      let level: Level = 'ok';
      let message = '';
      let metric: string | undefined;

      try {
        const response = await request.fetch(target.url, {
          method: target.method ?? 'GET',
          timeout: thresholds.responseFailMs * 2,
          failOnStatusCode: false,
        });
        const elapsed = Math.round(performance.now() - start);
        metric = `${elapsed} ms`;

        if (response.status() !== expectedStatus) {
          level = 'fail';
          message = `HTTP ${response.status()} (se esperaba ${expectedStatus})`;
        } else if (target.expectText && !(await response.text()).includes(target.expectText)) {
          level = 'fail';
          message = `Respondió ${response.status()} pero no contiene "${target.expectText}"`;
        } else {
          level = levelForTime(elapsed, thresholds.responseWarnMs, thresholds.responseFailMs);
          message =
            level === 'ok'
              ? `HTTP ${response.status()} OK`
              : `HTTP ${response.status()} pero lento (umbral ${thresholds.responseWarnMs} ms)`;
        }
      } catch (error) {
        level = 'fail';
        message = `Sin respuesta: ${(error as Error).message.split('\n')[0]}`;
      }

      await record(testInfo, {
        category: 'api',
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
