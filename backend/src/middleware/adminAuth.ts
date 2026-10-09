import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

type FailureEntry = {
  count: number;
  resetAt: number;
};

const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

// En memoria: en Vercel cada instancia cuenta por separado. La defensa principal es un ADMIN_PIN largo.
const failures = new Map<string, FailureEntry>();

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const configuredPin = env.ADMIN_PIN ?? (env.DEMO_MODE ? '1234' : undefined);

  if (!configuredPin) {
    throw new HttpError(503, 'ADMIN_PIN no esta configurado en el backend.');
  }

  const now = Date.now();
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const entry = failures.get(ip);
  const activeEntry = entry && entry.resetAt > now ? entry : undefined;

  if (activeEntry && activeEntry.count >= MAX_FAILURES) {
    throw new HttpError(429, 'Demasiados intentos fallidos. Espera 15 minutos y volve a probar.');
  }

  const providedPin = req.header('x-admin-pin');

  if (!providedPin || !safeEquals(providedPin, configuredPin)) {
    registerFailure(ip, activeEntry, now);
    throw new HttpError(401, 'PIN de administrador invalido.');
  }

  failures.delete(ip);
  next();
}

function registerFailure(ip: string, activeEntry: FailureEntry | undefined, now: number) {
  if (activeEntry) {
    activeEntry.count += 1;
    return;
  }

  failures.set(ip, { count: 1, resetAt: now + FAILURE_WINDOW_MS });
  cleanupExpiredFailures(now);
}

function cleanupExpiredFailures(now: number) {
  if (failures.size < 1000) {
    return;
  }

  for (const [key, entry] of failures.entries()) {
    if (entry.resetAt <= now) {
      failures.delete(key);
    }
  }
}

function safeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length
    && timingSafeEqual(leftBuffer, rightBuffer);
}
