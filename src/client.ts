import type {
  ClientOptions,
  CloudEvent,
  RetryOptions,
  TrackEventOptions,
  TrackEventResponse,
  ApiResponse,
} from './types.js'
import { createErrorFromResponse, NetworkError, TimeoutError, OpsTrailsError } from './errors.js'
import {
  DEFAULT_RETRY_OPTIONS,
  formatEventTime,
  isRetryableStatus,
  parseRetryAfter,
  calculateRetryDelay,
  sleep,
} from './utils.js'

const DEFAULT_BASE_URL = 'https://api.opstrails.dev'
const DEFAULT_TIMEOUT_MS = 30_000

/**
 * OpsTrails API client for event ingestion.
 *
 * @example
 * ```ts
 * const client = new OpsTrailsClient({ apiKey: 'ot_...' })
 * await client.trackEvent({
 *   type: 'deployment',
 *   source: '//github.com/org/repo',
 *   subject: 'production',
 *   version: 'v1.2.3',
 * })
 * ```
 */
export class OpsTrailsClient {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly timeout: number
  private readonly retryOptions: RetryOptions

  constructor(options: ClientOptions) {
    if (!options.apiKey) {
      throw new Error('apiKey is required')
    }

    this.apiKey = options.apiKey
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT_MS
    this.retryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options.retry }
  }

  /**
   * Track an infrastructure event.
   *
   * Automatically sets `specversion: "1.0"` and defaults `time` to `"NOW"`.
   */
  async trackEvent(options: TrackEventOptions): Promise<TrackEventResponse> {
    const event: CloudEvent = {
      specversion: '1.0',
      type: options.type,
      source: options.source,
      time: formatEventTime(options.time),
      ...(options.id !== undefined && { id: options.id }),
      ...(options.subject !== undefined && { subject: options.subject }),
      ...(options.severity !== undefined && { severity: options.severity }),
      ...(options.version !== undefined && { version: options.version }),
      ...(options.data !== undefined && { data: options.data }),
    }

    return this.sendRawEvent(event)
  }

  /**
   * Send a raw CloudEvent payload to the API.
   *
   * Use this when you need full control over the CloudEvent fields.
   */
  async sendRawEvent(event: CloudEvent): Promise<TrackEventResponse> {
    const response = await this.request<TrackEventResponse>(
      '/api/v1/events',
      {
        method: 'POST',
        body: JSON.stringify(event),
      },
    )
    return response
  }

  /**
   * Internal request method with retry logic, timeout, and error handling.
   */
  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    }

    let lastError: OpsTrailsError | undefined

    for (let attempt = 0; attempt <= this.retryOptions.maxRetries; attempt++) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      try {
        const response = await fetch(url, {
          ...init,
          headers,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        const body = await response.json() as ApiResponse<T>

        if (response.ok && body.success) {
          return (body as { success: true; data: T }).data
        }

        // Non-success response
        const errorResponse = body as { success: false; error: string; code: string }
        const error = createErrorFromResponse(errorResponse, response.status)

        // Only retry on 429 and 5xx
        if (isRetryableStatus(response.status) && attempt < this.retryOptions.maxRetries) {
          lastError = error
          const retryAfter = parseRetryAfter(response.headers.get('Retry-After'))
          const delay = calculateRetryDelay(attempt, this.retryOptions, retryAfter)
          await sleep(delay)
          continue
        }

        throw error
      } catch (err) {
        clearTimeout(timeoutId)

        if (err instanceof OpsTrailsError) {
          throw err
        }

        if (err instanceof DOMException && err.name === 'AbortError') {
          const timeoutErr = new TimeoutError(`Request timed out after ${this.timeout}ms`)
          if (attempt < this.retryOptions.maxRetries) {
            lastError = timeoutErr
            const delay = calculateRetryDelay(attempt, this.retryOptions, null)
            await sleep(delay)
            continue
          }
          throw timeoutErr
        }

        const networkErr = new NetworkError(
          err instanceof Error ? err.message : 'Unknown network error',
        )
        if (attempt < this.retryOptions.maxRetries) {
          lastError = networkErr
          const delay = calculateRetryDelay(attempt, this.retryOptions, null)
          await sleep(delay)
          continue
        }
        throw networkErr
      }
    }

    // Should not reach here, but just in case
    throw lastError ?? new NetworkError('Request failed after retries')
  }
}
