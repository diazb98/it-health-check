import { test, expect } from '@playwright/test';
import tls from 'node:tls';
import { loadTargets } from '../src/config';
import { record, type Level } from '../src/result';

const { ssl, thresholds } = loadTargets();

interface CertInfo {
  validTo: Date;
  issuer: string;
  authorized: boolean;
  authorizationError?: string;
}

/** Abre una conexión TLS y lee el certificado del servidor. */
function getCertificate(host: string, port = 443): Promise<CertInfo> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      { host, port, servername: host, rejectUnauthorized: false, timeout: 10_000 },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();
        if (!cert || !cert.valid_to) return reject(new Error('El servidor no envió certificado'));
        resolve({
          validTo: new Date(cert.valid_to),
          issuer: String(cert.issuer?.O ?? cert.issuer?.CN ?? 'desconocido'),
          authorized: socket.authorized,
          authorizationError: socket.authorizationError?.toString(),
        });
      },
    );
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('Tiempo de espera agotado'));
    });
    socket.on('error', reject);
  });
}

test.describe('Certificados SSL', () => {
  for (const target of ssl) {
    test(target.name, async ({}, testInfo) => {
      let level: Level = 'ok';
      let message = '';
      let metric: string | undefined;

      try {
        const cert = await getCertificate(target.host, target.port);
        const days = Math.floor((cert.validTo.getTime() - Date.now()) / 86_400_000);
        const fecha = cert.validTo.toISOString().slice(0, 10);
        metric = days < 0 ? `hace ${-days} días` : `${days} días`;

        if (days < 0) {
          level = 'fail';
          message = `Vencido desde ${fecha}`;
        } else if (!cert.authorized) {
          level = 'fail';
          message = `Certificado no confiable: ${cert.authorizationError}`;
        } else if (days <= thresholds.sslFailDays) {
          level = 'fail';
          message = `Vence el ${fecha}: ¡renovar ya!`;
        } else if (days <= thresholds.sslWarnDays) {
          level = 'warn';
          message = `Vence el ${fecha}: planificar renovación`;
        } else {
          message = `Válido hasta ${fecha} (emisor: ${cert.issuer})`;
        }
      } catch (error) {
        level = 'fail';
        message = `No se pudo revisar: ${(error as Error).message}`;
      }

      await record(testInfo, {
        category: 'ssl',
        name: target.name,
        target: target.host,
        level,
        metric,
        message,
        critical: true,
      });

      expect(level, message).not.toBe('fail');
    });
  }
});
