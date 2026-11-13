import type { TestInfo } from '@playwright/test';

export type Category = 'api' | 'ui' | 'ssl';
export type Level = 'ok' | 'warn' | 'fail';

/** Datos que cada chequeo deja para el reporte HTML. */
export interface HealthResult {
  category: Category;
  name: string;
  target: string;
  level: Level;
  metric?: string; // ej. "320 ms" o "45 días"
  message: string;
  critical?: boolean;
}

export const RESULT_ATTACHMENT = 'health-result';

/** Guarda el resultado como adjunto para que el reporter lo lea. */
export async function record(testInfo: TestInfo, result: HealthResult): Promise<void> {
  await testInfo.attach(RESULT_ATTACHMENT, {
    body: JSON.stringify(result),
    contentType: 'application/json',
  });
}

/** Clasifica un tiempo de respuesta según los umbrales. */
export function levelForTime(ms: number, warnMs: number, failMs: number): Level {
  if (ms >= failMs) return 'fail';
  if (ms >= warnMs) return 'warn';
  return 'ok';
}
