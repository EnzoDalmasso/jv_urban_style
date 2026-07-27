import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const configuredPin = env.ADMIN_PIN ?? (env.DEMO_MODE ? '1234' : undefined);

  if (!configuredPin) {
    throw new HttpError(503, 'ADMIN_PIN no esta configurado en el backend.');
  }

  const providedPin = req.header('x-admin-pin');

  if (!providedPin || !safeEquals(providedPin, configuredPin)) {
    throw new HttpError(401, 'PIN de administrador invalido.');
  }

  next();
}

function safeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length
    && timingSafeEqual(leftBuffer, rightBuffer);
}
