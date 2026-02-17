import type { RetryOptions } from './types.js'

/**
 * Default retry configuration.
 */
export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
  maxJitter: 0.25,
}

/**
 * Formats an event time value for the API.
 *
 * - `undefined` → "NOW" (server-side timestamp)
 * - `Date` object → ISO 8601 string
 * - `string` → passed through as-is
 */
export function formatEventTime(time: string | Date | undefined): string {
  if (time === undefined) {
    return 'NOW'
  }
  if (time instanceof Date) {
    return time.toISOString()
  }
  return time
}

/**
 * Returns true if the HTTP status code is retryable (429 or 5xx).
 */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600)
}

/**
 * Parses the `Retry-After` header value.
 *
 * @returns Delay in milliseconds, or `null` if the header is missing/unparseable.
 */
export function parseRetryAfter(headerValue: string | null): number | null {
  if (!headerValue) {
    return null
  }

  // Try as integer (seconds)
  const seconds = parseInt(headerValue, 10)
  if (!isNaN(seconds) && seconds >= 0) {
    return seconds * 1000
  }

  // Try as HTTP date
  const date = new Date(headerValue)
  if (!isNaN(date.getTime())) {
    const delayMs = date.getTime() - Date.now()
    return delayMs > 0 ? delayMs : 0
  }

  return null
}

/**
 * Calculates the delay for a retry attempt with exponential backoff and jitter.
 */
export function calculateRetryDelay(
  attempt: number,
  options: RetryOptions,
  retryAfterMs: number | null,
): number {
  if (retryAfterMs !== null) {
    return retryAfterMs
  }
  const baseDelay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt)
  const jitter = baseDelay * options.maxJitter * Math.random()
  return baseDelay + jitter
}

/**
 * Sleeps for the specified duration.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
