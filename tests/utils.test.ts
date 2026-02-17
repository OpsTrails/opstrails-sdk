import { describe, it, expect, vi } from 'vitest'
import {
  formatEventTime,
  isRetryableStatus,
  parseRetryAfter,
  calculateRetryDelay,
  sleep,
  DEFAULT_RETRY_OPTIONS,
} from '../src/utils'
import type { RetryOptions } from '../src/types'

describe('formatEventTime', () => {
  it('returns "NOW" for undefined', () => {
    expect(formatEventTime(undefined)).toBe('NOW')
  })

  it('returns ISO string for Date objects', () => {
    const date = new Date('2025-01-15T10:30:00Z')
    expect(formatEventTime(date)).toBe('2025-01-15T10:30:00.000Z')
  })

  it('passes strings through as-is', () => {
    expect(formatEventTime('NOW')).toBe('NOW')
    expect(formatEventTime('2025-01-15T10:30:00+02:00')).toBe('2025-01-15T10:30:00+02:00')
  })

  it('handles Date at epoch (new Date(0))', () => {
    const epoch = new Date(0)
    expect(formatEventTime(epoch)).toBe('1970-01-01T00:00:00.000Z')
  })
})

describe('isRetryableStatus', () => {
  it('returns true for 429', () => {
    expect(isRetryableStatus(429)).toBe(true)
  })

  it('returns true for 5xx', () => {
    expect(isRetryableStatus(500)).toBe(true)
    expect(isRetryableStatus(501)).toBe(true)
    expect(isRetryableStatus(502)).toBe(true)
    expect(isRetryableStatus(503)).toBe(true)
    expect(isRetryableStatus(504)).toBe(true)
    expect(isRetryableStatus(599)).toBe(true)
  })

  it('returns false for 4xx (except 429)', () => {
    expect(isRetryableStatus(400)).toBe(false)
    expect(isRetryableStatus(401)).toBe(false)
    expect(isRetryableStatus(403)).toBe(false)
    expect(isRetryableStatus(404)).toBe(false)
    expect(isRetryableStatus(428)).toBe(false)
    expect(isRetryableStatus(430)).toBe(false)
  })

  it('returns false for 2xx', () => {
    expect(isRetryableStatus(200)).toBe(false)
    expect(isRetryableStatus(201)).toBe(false)
  })

  it('returns false for boundary values outside retryable range', () => {
    expect(isRetryableStatus(499)).toBe(false)
    expect(isRetryableStatus(600)).toBe(false)
  })
})

describe('parseRetryAfter', () => {
  it('returns null for null', () => {
    expect(parseRetryAfter(null)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseRetryAfter('')).toBeNull()
  })

  it('parses integer seconds', () => {
    expect(parseRetryAfter('5')).toBe(5000)
    expect(parseRetryAfter('60')).toBe(60000)
  })

  it('parses "0" as 0ms', () => {
    expect(parseRetryAfter('0')).toBe(0)
  })

  it('handles negative values gracefully (does not return negative delay)', () => {
    const result = parseRetryAfter('-5')
    // -5 fails the >= 0 integer check but gets parsed as an HTTP date (year -5)
    // which is in the past, so the function returns 0 (retry immediately)
    expect(result).toBe(0)
  })

  it('returns null for unparseable values', () => {
    expect(parseRetryAfter('not-a-number-or-date')).toBeNull()
  })

  it('returns 0 for past HTTP dates', () => {
    const pastDate = new Date(Date.now() - 60000).toUTCString()
    expect(parseRetryAfter(pastDate)).toBe(0)
  })

  it('returns positive delay for future HTTP dates', () => {
    const futureDate = new Date(Date.now() + 5000).toUTCString()
    const result = parseRetryAfter(futureDate)
    expect(result).toBeGreaterThan(0)
    expect(result).toBeLessThanOrEqual(5500) // allow some margin
  })
})

describe('calculateRetryDelay', () => {
  const options: RetryOptions = {
    maxRetries: 3,
    initialDelayMs: 1000,
    backoffMultiplier: 2,
    maxJitter: 0.25,
  }

  it('respects retryAfterMs when provided', () => {
    expect(calculateRetryDelay(0, options, 5000)).toBe(5000)
  })

  it('uses exponential backoff when no retryAfter', () => {
    const delay0 = calculateRetryDelay(0, options, null)
    expect(delay0).toBeGreaterThanOrEqual(1000)
    expect(delay0).toBeLessThanOrEqual(1250) // 1000 + 25% jitter

    const delay1 = calculateRetryDelay(1, options, null)
    expect(delay1).toBeGreaterThanOrEqual(2000)
    expect(delay1).toBeLessThanOrEqual(2500) // 2000 + 25% jitter

    const delay2 = calculateRetryDelay(2, options, null)
    expect(delay2).toBeGreaterThanOrEqual(4000)
    expect(delay2).toBeLessThanOrEqual(5000) // 4000 + 25% jitter
  })

  it('returns exact base delay when maxJitter is 0', () => {
    const noJitterOptions: RetryOptions = {
      maxRetries: 3,
      initialDelayMs: 1000,
      backoffMultiplier: 2,
      maxJitter: 0,
    }

    expect(calculateRetryDelay(0, noJitterOptions, null)).toBe(1000)
    expect(calculateRetryDelay(1, noJitterOptions, null)).toBe(2000)
    expect(calculateRetryDelay(2, noJitterOptions, null)).toBe(4000)
  })

  it('applies correct exponent per attempt', () => {
    const noJitterOptions: RetryOptions = {
      maxRetries: 5,
      initialDelayMs: 100,
      backoffMultiplier: 3,
      maxJitter: 0,
    }

    // attempt 0: 100 * 3^0 = 100
    expect(calculateRetryDelay(0, noJitterOptions, null)).toBe(100)
    // attempt 1: 100 * 3^1 = 300
    expect(calculateRetryDelay(1, noJitterOptions, null)).toBe(300)
    // attempt 2: 100 * 3^2 = 900
    expect(calculateRetryDelay(2, noJitterOptions, null)).toBe(900)
  })
})

describe('sleep', () => {
  it('resolves after specified duration', async () => {
    vi.useFakeTimers()

    let resolved = false
    const promise = sleep(1000).then(() => {
      resolved = true
    })

    expect(resolved).toBe(false)
    vi.advanceTimersByTime(999)
    await Promise.resolve() // flush microtasks
    expect(resolved).toBe(false)
    vi.advanceTimersByTime(1)
    await promise
    expect(resolved).toBe(true)

    vi.useRealTimers()
  })
})

describe('DEFAULT_RETRY_OPTIONS', () => {
  it('has correct default values', () => {
    expect(DEFAULT_RETRY_OPTIONS).toEqual({
      maxRetries: 3,
      initialDelayMs: 1000,
      backoffMultiplier: 2,
      maxJitter: 0.25,
    })
  })
})
