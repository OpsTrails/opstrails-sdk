import { describe, it, expect } from 'vitest'
import {
  OpsTrailsError,
  AuthenticationError,
  ForbiddenError,
  ValidationError,
  QuotaExceededError,
  NotFoundError,
  NetworkError,
  TimeoutError,
  createErrorFromResponse,
} from '../src/errors'

describe('error classes', () => {
  it('OpsTrailsError base class has correct properties', () => {
    const err = new OpsTrailsError('Something went wrong', 'CUSTOM_CODE', 500)
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(OpsTrailsError)
    expect(err.name).toBe('OpsTrailsError')
    expect(err.code).toBe('CUSTOM_CODE')
    expect(err.status).toBe(500)
    expect(err.message).toBe('Something went wrong')
  })

  it('AuthenticationError has correct properties', () => {
    const err = new AuthenticationError('Invalid API key')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(OpsTrailsError)
    expect(err.name).toBe('AuthenticationError')
    expect(err.code).toBe('UNAUTHORIZED')
    expect(err.status).toBe(401)
    expect(err.message).toBe('Invalid API key')
  })

  it('ForbiddenError has correct properties', () => {
    const err = new ForbiddenError('Read-only key')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(OpsTrailsError)
    expect(err.code).toBe('FORBIDDEN')
    expect(err.status).toBe(403)
  })

  it('ValidationError has correct properties', () => {
    const err = new ValidationError('type: Required')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(OpsTrailsError)
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.status).toBe(400)
  })

  it('QuotaExceededError has correct properties', () => {
    const err = new QuotaExceededError('Monthly limit reached')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(OpsTrailsError)
    expect(err.code).toBe('QUOTA_EXCEEDED')
    expect(err.status).toBe(429)
  })

  it('NotFoundError has correct properties', () => {
    const err = new NotFoundError('Resource not found')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(OpsTrailsError)
    expect(err.code).toBe('NOT_FOUND')
    expect(err.status).toBe(404)
  })

  it('NetworkError has status 0', () => {
    const err = new NetworkError('Connection refused')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(OpsTrailsError)
    expect(err.code).toBe('NETWORK_ERROR')
    expect(err.status).toBe(0)
  })

  it('TimeoutError has status 0', () => {
    const err = new TimeoutError('Request timed out')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(OpsTrailsError)
    expect(err.code).toBe('TIMEOUT')
    expect(err.status).toBe(0)
  })
})

describe('createErrorFromResponse', () => {
  it('maps UNAUTHORIZED to AuthenticationError', () => {
    const err = createErrorFromResponse(
      { success: false, error: 'Invalid key', code: 'UNAUTHORIZED' },
      401,
    )
    expect(err).toBeInstanceOf(AuthenticationError)
    expect(err.message).toBe('Invalid key')
  })

  it('maps FORBIDDEN to ForbiddenError', () => {
    const err = createErrorFromResponse(
      { success: false, error: 'Read-only', code: 'FORBIDDEN' },
      403,
    )
    expect(err).toBeInstanceOf(ForbiddenError)
  })

  it('maps VALIDATION_ERROR to ValidationError', () => {
    const err = createErrorFromResponse(
      { success: false, error: 'Invalid type', code: 'VALIDATION_ERROR' },
      400,
    )
    expect(err).toBeInstanceOf(ValidationError)
  })

  it('maps QUOTA_EXCEEDED to QuotaExceededError', () => {
    const err = createErrorFromResponse(
      { success: false, error: 'Limit reached', code: 'QUOTA_EXCEEDED' },
      429,
    )
    expect(err).toBeInstanceOf(QuotaExceededError)
  })

  it('maps NOT_FOUND to NotFoundError', () => {
    const err = createErrorFromResponse(
      { success: false, error: 'Not found', code: 'NOT_FOUND' },
      404,
    )
    expect(err).toBeInstanceOf(NotFoundError)
  })

  it('falls back to OpsTrailsError for unknown codes', () => {
    const err = createErrorFromResponse(
      { success: false, error: 'Server error', code: 'INTERNAL_ERROR' },
      500,
    )
    expect(err).toBeInstanceOf(OpsTrailsError)
    expect(err.code).toBe('INTERNAL_ERROR')
    expect(err.status).toBe(500)
  })

  it('preserves unknown code string', () => {
    const err = createErrorFromResponse(
      { success: false, error: 'Custom error', code: 'CUSTOM_ERROR_CODE' },
      422,
    )
    expect(err).toBeInstanceOf(OpsTrailsError)
    expect(err.code).toBe('CUSTOM_ERROR_CODE')
    expect(err.message).toBe('Custom error')
  })

  it('preserves HTTP status for unknown codes', () => {
    const err = createErrorFromResponse(
      { success: false, error: 'Teapot', code: 'IM_A_TEAPOT' },
      418,
    )
    expect(err).toBeInstanceOf(OpsTrailsError)
    expect(err.status).toBe(418)
    expect(err.code).toBe('IM_A_TEAPOT')
  })
})
