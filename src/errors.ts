import type { ApiErrorResponse } from './types.js'

/**
 * Base error class for all OpsTrails SDK errors.
 */
export class OpsTrailsError extends Error {
  /** HTTP status code (0 for network/timeout errors). */
  readonly status: number
  /** API error code (e.g. "VALIDATION_ERROR"). */
  readonly code: string

  constructor(message: string, code: string, status: number) {
    super(message)
    this.name = 'OpsTrailsError'
    this.code = code
    this.status = status
  }
}

/**
 * Thrown when the API key is missing or invalid (HTTP 401).
 */
export class AuthenticationError extends OpsTrailsError {
  constructor(message: string) {
    super(message, 'UNAUTHORIZED', 401)
    this.name = 'AuthenticationError'
  }
}

/**
 * Thrown when the API key lacks permission for the operation (HTTP 403).
 */
export class ForbiddenError extends OpsTrailsError {
  constructor(message: string) {
    super(message, 'FORBIDDEN', 403)
    this.name = 'ForbiddenError'
  }
}

/**
 * Thrown when the request payload fails validation (HTTP 400).
 */
export class ValidationError extends OpsTrailsError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400)
    this.name = 'ValidationError'
  }
}

/**
 * Thrown when the monthly event quota is exceeded (HTTP 429).
 */
export class QuotaExceededError extends OpsTrailsError {
  constructor(message: string) {
    super(message, 'QUOTA_EXCEEDED', 429)
    this.name = 'QuotaExceededError'
  }
}

/**
 * Thrown when the requested resource is not found (HTTP 404).
 */
export class NotFoundError extends OpsTrailsError {
  constructor(message: string) {
    super(message, 'NOT_FOUND', 404)
    this.name = 'NotFoundError'
  }
}

/**
 * Thrown when a network error occurs (no response received).
 */
export class NetworkError extends OpsTrailsError {
  constructor(message: string) {
    super(message, 'NETWORK_ERROR', 0)
    this.name = 'NetworkError'
  }
}

/**
 * Thrown when a request times out.
 */
export class TimeoutError extends OpsTrailsError {
  constructor(message: string) {
    super(message, 'TIMEOUT', 0)
    this.name = 'TimeoutError'
  }
}

const ERROR_MAP: Record<string, new (message: string) => OpsTrailsError> = {
  UNAUTHORIZED: AuthenticationError,
  FORBIDDEN: ForbiddenError,
  VALIDATION_ERROR: ValidationError,
  QUOTA_EXCEEDED: QuotaExceededError,
  NOT_FOUND: NotFoundError,
}

/**
 * Creates a typed SDK error from an API error response.
 */
export function createErrorFromResponse(
  response: ApiErrorResponse,
  status: number,
): OpsTrailsError {
  const ErrorClass = ERROR_MAP[response.code]
  if (ErrorClass) {
    return new ErrorClass(response.error)
  }
  return new OpsTrailsError(response.error, response.code, status)
}
