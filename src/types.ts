/**
 * CloudEvents 1.0 structured content mode event.
 * Sent directly to the OpsTrails API.
 */
export interface CloudEvent {
  specversion: '1.0'
  type: string
  source: string
  id?: string
  time: string
  subject?: string
  severity?: Severity
  version?: string
  datacontenttype?: string
  dataschema?: string
  data?: EventData
}

/**
 * Event severity levels.
 */
export type Severity = 'LOW' | 'MINOR' | 'MAJOR' | 'CRITICAL'

/**
 * Event data payload. Accepts arbitrary keys alongside known fields.
 */
export interface EventData {
  description?: string
  timezone?: string
  [key: string]: unknown
}

/**
 * Options for `OpsTrailsClient.trackEvent()`.
 * Simplified interface — the client fills in CloudEvents boilerplate.
 */
export interface TrackEventOptions {
  /** Event type (e.g. "deployment", "rollback"). 1-100 chars. */
  type: string
  /** Event source URI (e.g. "//github.com/org/repo"). 1-500 chars. */
  source: string
  /** Optional event ID. Max 200 chars. Auto-generated if omitted. */
  id?: string
  /** Event time. ISO 8601, RFC 2822, Date object, or "NOW" (default). */
  time?: string | Date
  /** Event subject (e.g. environment name). Max 50 chars. */
  subject?: string
  /** Event severity. */
  severity?: Severity
  /** Version string (e.g. "v1.2.3"). Max 50 chars. */
  version?: string
  /** Additional event data. */
  data?: EventData
}

/**
 * Response from the OpsTrails API after creating an event.
 */
export interface TrackEventResponse {
  id: string
  specversion: string
  type: string
  source: string
  time: string
  subject: string | null
  severity: string | null
  version: string | null
  datacontenttype: string | null
  dataschema: string | null
  data: Record<string, unknown> | null
  createdAt: string
}

/**
 * Successful API response wrapper.
 */
export interface ApiSuccessResponse<T> {
  success: true
  data: T
}

/**
 * Error API response wrapper.
 */
export interface ApiErrorResponse {
  success: false
  error: string
  code: string
}

/**
 * Union type for all API responses.
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

/**
 * Configuration options for `OpsTrailsClient`.
 */
export interface ClientOptions {
  /** OpsTrails API key (starts with "ot_" or "otr_"). */
  apiKey: string
  /** API base URL. Defaults to "https://api.opstrails.dev". */
  baseUrl?: string
  /** Request timeout in milliseconds. Defaults to 30000 (30s). */
  timeout?: number
  /** Retry configuration. */
  retry?: Partial<RetryOptions>
}

/**
 * Retry behavior configuration.
 */
export interface RetryOptions {
  /** Maximum number of retry attempts. Defaults to 3. */
  maxRetries: number
  /** Initial delay between retries in milliseconds. Defaults to 1000. */
  initialDelayMs: number
  /** Multiplier for exponential backoff. Defaults to 2. */
  backoffMultiplier: number
  /** Maximum jitter as a fraction (0-1). Defaults to 0.25. */
  maxJitter: number
}
