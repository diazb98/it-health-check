import fs from 'node:fs';
import path from 'node:path';

export interface Thresholds {
  responseWarnMs: number;
  responseFailMs: number;
  sslWarnDays: number;
  sslFailDays: number;
}

export interface ApiTarget {
  name: string;
  url: string;
  method?: 'GET' | 'HEAD';
  expectStatus?: number;
  expectText?: string;
  critical?: boolean;
}

export interface UiTarget {
  name: string;
  url: string;
  expectVisible: string;
  critical?: boolean;
}

export interface SslTarget {
  name: string;
  host: string;
  port?: number;
}

export interface Targets {
  thresholds: Thresholds;
  api: ApiTarget[];
  ui: UiTarget[];
  ssl: SslTarget[];
}

/**
 * Carga los objetivos a revisar.
 * Usa la variable TARGETS_FILE para apuntar a tu propio archivo
 * (por ejemplo, uno con las URLs internas de tu empresa).
 */
export function loadTargets(): Targets {
  const file = process.env.TARGETS_FILE ?? path.join(__dirname, '..', 'config', 'targets.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as Partial<Targets>;
  return {
    thresholds: {
      responseWarnMs: 1500,
      responseFailMs: 5000,
      sslWarnDays: 30,
      sslFailDays: 7,
      ...raw.thresholds,
    },
    api: raw.api ?? [],
    ui: raw.ui ?? [],
    ssl: raw.ssl ?? [],
  };
}
