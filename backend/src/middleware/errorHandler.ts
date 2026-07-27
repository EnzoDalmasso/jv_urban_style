import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/httpError.js';
import { env } from '../config/env.js';

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'Parametros invalidos.',
      details: error.flatten()
    });
  }

  if (error instanceof HttpError) {
    if (error.statusCode >= 500 || env.NODE_ENV !== 'production') {
      console.error(error.details ?? error);
    }

    return res.status(error.statusCode).json({
      error: 'HttpError',
      message: error.message,
      ...(env.NODE_ENV === 'production' ? {} : { details: error.details })
    });
  }

  console.error(error);
  return res.status(500).json({
    error: 'InternalServerError',
    message: 'No pudimos procesar la solicitud.'
  });
}
