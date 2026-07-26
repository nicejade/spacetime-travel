import type { HttpError } from '../types.js';

/** Create an Error with HTTP status fields for the Fastify error handler. */
export function httpError(status: number, message: string): HttpError {
  const error = new Error(message) as HttpError;
  error.status = status;
  error.statusCode = status;
  return error;
}
