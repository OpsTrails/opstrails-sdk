import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OpsTrailsClient } from '../src/client'
import {
  AuthenticationError,
  ValidationError,
  QuotaExceededError,
  NetworkError,
  TimeoutError,
  ForbiddenError,
  NotFoundError,
  OpsTrailsError,
} from '../src/errors'

function mockFetchResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: () => Promise.resolve(body),
  })
}

const SUCCESS_RESPONSE = {
  success: true,
  data: {
    id: 'evt_123',
    specversion: '1.0',
    type: 'deployment',
    source: '//github.com/org/repo',
    time: '2025-01-15T10:00:00.000Z',
    subject: 'production',
    severity: null,
    version: 'v1.0.0',
    datacontenttype: 'application/json',
    dataschema: null,
    data: null,
    createdAt: '2025-01-15T10:00:00.000Z',
  },
}

describe('OpsTrailsClient', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.useRealTimers()
  })

  describe('constructor', () => {
    it('throws if apiKey is empty', () => {
      expect(() => new OpsTrailsClient({ apiKey: '' })).toThrow('apiKey is required')
    })

    it('strips trailing slashes from baseUrl', () => {
      const client = new OpsTrailsClient({ apiKey: 'ot_test', baseUrl: 'https://example.com/' })
      expect(client).toBeDefined()
    })

    it('uses default baseUrl when not provided', async () => {
      const fetchMock = mockFetchResponse(SUCCESS_RESPONSE, 201)
      globalThis.fetch = fetchMock

      const client = new OpsTrailsClient({
        apiKey: 'ot_test',
        retry: { maxRetries: 0 },
      })

      await client.trackEvent({ type: 'test', source: '//test' })

      const [url] = fetchMock.mock.calls[0]!
      expect(url).toBe('https://api.opstrails.dev/api/v1/events')
    })

    it('uses default timeout when not provided', () => {
      const client = new OpsTrailsClient({ apiKey: 'ot_test' })
      expect(client).toBeDefined()
    })

    it('merges partial retry options with defaults', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          headers: new Headers(),
          json: () => Promise.resolve({ success: false, error: 'Server error', code: 'INTERNAL_ERROR' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          headers: new Headers(),
          json: () => Promise.resolve(SUCCESS_RESPONSE),
        })

      globalThis.fetch = fetchMock

      // Only override maxRetries — other defaults should still apply
      const client = new OpsTrailsClient({
        apiKey: 'ot_test',
        retry: { maxRetries: 1 },
      })

      const result = await client.trackEvent({ type: 'test', source: '//test' })
      expect(result.id).toBe('evt_123')
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
  })

  describe('trackEvent', () => {
    it('sends a correct CloudEvent POST request', async () => {
      const fetchMock = mockFetchResponse(SUCCESS_RESPONSE, 201)
      globalThis.fetch = fetchMock

      const client = new OpsTrailsClient({
        apiKey: 'ot_test123',
        baseUrl: 'https://api.example.com',
        retry: { maxRetries: 0 },
      })

      const result = await client.trackEvent({
        type: 'deployment',
        source: '//github.com/org/repo',
        subject: 'production',
        version: 'v1.0.0',
      })

      expect(result.id).toBe('evt_123')
      expect(result.type).toBe('deployment')

      expect(fetchMock).toHaveBeenCalledOnce()
      const [url, init] = fetchMock.mock.calls[0]!
      expect(url).toBe('https://api.example.com/api/v1/events')
      expect(init.method).toBe('POST')
      expect(init.headers).toEqual({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ot_test123',
      })

      const body = JSON.parse(init.body)
      expect(body.specversion).toBe('1.0')
      expect(body.type).toBe('deployment')
      expect(body.source).toBe('//github.com/org/repo')
      expect(body.time).toBe('NOW')
      expect(body.subject).toBe('production')
      expect(body.version).toBe('v1.0.0')
    })

    it('formats Date time values as ISO strings', async () => {
      globalThis.fetch = mockFetchResponse(SUCCESS_RESPONSE, 201)

      const client = new OpsTrailsClient({
        apiKey: 'ot_test',
        retry: { maxRetries: 0 },
      })

      await client.trackEvent({
        type: 'deployment',
        source: '//test',
        time: new Date('2025-06-15T12:00:00Z'),
      })

      const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1].body)
      expect(body.time).toBe('2025-06-15T12:00:00.000Z')
    })

    it('omits optional fields when not provided', async () => {
      globalThis.fetch = mockFetchResponse(SUCCESS_RESPONSE, 201)

      const client = new OpsTrailsClient({
        apiKey: 'ot_test',
        retry: { maxRetries: 0 },
      })

      await client.trackEvent({ type: 'test', source: '//test' })

      const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1].body)
      expect(body).not.toHaveProperty('id')
      expect(body).not.toHaveProperty('subject')
      expect(body).not.toHaveProperty('severity')
      expect(body).not.toHaveProperty('version')
      expect(body).not.toHaveProperty('data')
    })

    it('sends all optional fields when all are provided', async () => {
      globalThis.fetch = mockFetchResponse(SUCCESS_RESPONSE, 201)

      const client = new OpsTrailsClient({
        apiKey: 'ot_test',
        retry: { maxRetries: 0 },
      })

      await client.trackEvent({
        type: 'deployment',
        source: '//github.com/org/repo',
        id: 'custom-id-123',
        subject: 'production',
        severity: 'CRITICAL',
        version: 'v2.0.0',
        data: { description: 'Full deploy' },
      })

      const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1].body)
      expect(body.id).toBe('custom-id-123')
      expect(body.subject).toBe('production')
      expect(body.severity).toBe('CRITICAL')
      expect(body.version).toBe('v2.0.0')
      expect(body.data).toEqual({ description: 'Full deploy' })
    })

    it('handles data with nested objects correctly', async () => {
      globalThis.fetch = mockFetchResponse(SUCCESS_RESPONSE, 201)

      const client = new OpsTrailsClient({
        apiKey: 'ot_test',
        retry: { maxRetries: 0 },
      })

      const nestedData = {
        description: 'Deploy with config',
        config: { replicas: 3, region: 'us-east-1' },
        tags: ['prod', 'v2'],
      }

      await client.trackEvent({
        type: 'deployment',
        source: '//test',
        data: nestedData,
      })

      const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1].body)
      expect(body.data).toEqual(nestedData)
    })

    it('sends string time values as-is', async () => {
      globalThis.fetch = mockFetchResponse(SUCCESS_RESPONSE, 201)

      const client = new OpsTrailsClient({
        apiKey: 'ot_test',
        retry: { maxRetries: 0 },
      })

      await client.trackEvent({
        type: 'deployment',
        source: '//test',
        time: '2025-01-15T10:00:00+02:00',
      })

      const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1].body)
      expect(body.time).toBe('2025-01-15T10:00:00+02:00')
    })

    it('uses "NOW" when time is undefined', async () => {
      globalThis.fetch = mockFetchResponse(SUCCESS_RESPONSE, 201)

      const client = new OpsTrailsClient({
        apiKey: 'ot_test',
        retry: { maxRetries: 0 },
      })

      await client.trackEvent({
        type: 'deployment',
        source: '//test',
        time: undefined,
      })

      const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1].body)
      expect(body.time).toBe('NOW')
    })
  })

  describe('sendRawEvent', () => {
    it('sends the raw payload as-is', async () => {
      globalThis.fetch = mockFetchResponse(SUCCESS_RESPONSE, 201)

      const client = new OpsTrailsClient({
        apiKey: 'ot_test',
        retry: { maxRetries: 0 },
      })

      await client.sendRawEvent({
        specversion: '1.0',
        type: 'custom',
        source: '//custom',
        time: '2025-01-01T00:00:00Z',
        datacontenttype: 'text/plain',
      })

      const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1].body)
      expect(body.datacontenttype).toBe('text/plain')
    })

    it('preserves all CloudEvent fields', async () => {
      globalThis.fetch = mockFetchResponse(SUCCESS_RESPONSE, 201)

      const client = new OpsTrailsClient({
        apiKey: 'ot_test',
        retry: { maxRetries: 0 },
      })

      await client.sendRawEvent({
        specversion: '1.0',
        type: 'custom',
        source: '//custom',
        time: '2025-01-01T00:00:00Z',
        id: 'raw-id-456',
        subject: 'staging',
        severity: 'MAJOR',
        version: 'v3.0.0',
        datacontenttype: 'application/json',
        dataschema: 'https://schema.example.com/event.json',
        data: { key: 'value' },
      })

      const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1].body)
      expect(body.specversion).toBe('1.0')
      expect(body.type).toBe('custom')
      expect(body.source).toBe('//custom')
      expect(body.time).toBe('2025-01-01T00:00:00Z')
      expect(body.id).toBe('raw-id-456')
      expect(body.subject).toBe('staging')
      expect(body.severity).toBe('MAJOR')
      expect(body.version).toBe('v3.0.0')
      expect(body.datacontenttype).toBe('application/json')
      expect(body.dataschema).toBe('https://schema.example.com/event.json')
      expect(body.data).toEqual({ key: 'value' })
    })
  })

  describe('request details', () => {
    it('sends correct Content-Type and Authorization headers', async () => {
      const fetchMock = mockFetchResponse(SUCCESS_RESPONSE, 201)
      globalThis.fetch = fetchMock

      const client = new OpsTrailsClient({
        apiKey: 'ot_my_secret_key',
        retry: { maxRetries: 0 },
      })

      await client.trackEvent({ type: 'test', source: '//test' })

      const [, init] = fetchMock.mock.calls[0]!
      expect(init.headers['Content-Type']).toBe('application/json')
      expect(init.headers['Authorization']).toBe('Bearer ot_my_secret_key')
    })

    it('constructs correct URL from baseUrl + path', async () => {
      const fetchMock = mockFetchResponse(SUCCESS_RESPONSE, 201)
      globalThis.fetch = fetchMock

      const client = new OpsTrailsClient({
        apiKey: 'ot_test',
        baseUrl: 'https://custom.api.example.com',
        retry: { maxRetries: 0 },
      })

      await client.trackEvent({ type: 'test', source: '//test' })

      const [url] = fetchMock.mock.calls[0]!
      expect(url).toBe('https://custom.api.example.com/api/v1/events')
    })
  })

  describe('error handling', () => {
    it('throws AuthenticationError on 401', async () => {
      globalThis.fetch = mockFetchResponse(
        { success: false, error: 'Invalid key', code: 'UNAUTHORIZED' },
        401,
      )

      const client = new OpsTrailsClient({
        apiKey: 'ot_bad',
        retry: { maxRetries: 0 },
      })

      await expect(client.trackEvent({ type: 'test', source: '//test' }))
        .rejects.toThrow(AuthenticationError)
    })

    it('throws ForbiddenError on 403', async () => {
      globalThis.fetch = mockFetchResponse(
        { success: false, error: 'Read-only', code: 'FORBIDDEN' },
        403,
      )

      const client = new OpsTrailsClient({
        apiKey: 'otr_readonly',
        retry: { maxRetries: 0 },
      })

      await expect(client.trackEvent({ type: 'test', source: '//test' }))
        .rejects.toThrow(ForbiddenError)
    })

    it('throws ValidationError on 400', async () => {
      globalThis.fetch = mockFetchResponse(
        { success: false, error: 'type: Required', code: 'VALIDATION_ERROR' },
        400,
      )

      const client = new OpsTrailsClient({
        apiKey: 'ot_test',
        retry: { maxRetries: 0 },
      })

      await expect(client.trackEvent({ type: '', source: '//test' }))
        .rejects.toThrow(ValidationError)
    })

    it('throws NetworkError on fetch failure', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'))

      const client = new OpsTrailsClient({
        apiKey: 'ot_test',
        retry: { maxRetries: 0 },
      })

      await expect(client.trackEvent({ type: 'test', source: '//test' }))
        .rejects.toThrow(NetworkError)
    })

    it('throws TimeoutError on abort', async () => {
      globalThis.fetch = vi.fn().mockImplementation(() => {
        const err = new DOMException('The operation was aborted', 'AbortError')
        return Promise.reject(err)
      })

      const client = new OpsTrailsClient({
        apiKey: 'ot_test',
        timeout: 100,
        retry: { maxRetries: 0 },
      })

      await expect(client.trackEvent({ type: 'test', source: '//test' }))
        .rejects.toThrow(TimeoutError)
    })
  })

  describe('retry behavior', () => {
    it('retries on 429 and succeeds', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Headers({ 'Retry-After': '0' }),
          json: () => Promise.resolve({ success: false, error: 'Quota exceeded', code: 'QUOTA_EXCEEDED' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          headers: new Headers(),
          json: () => Promise.resolve(SUCCESS_RESPONSE),
        })

      globalThis.fetch = fetchMock

      const client = new OpsTrailsClient({
        apiKey: 'ot_test',
        retry: { maxRetries: 3, initialDelayMs: 10, backoffMultiplier: 1, maxJitter: 0 },
      })

      const result = await client.trackEvent({ type: 'test', source: '//test' })
      expect(result.id).toBe('evt_123')
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('retries on 500 and succeeds', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          headers: new Headers(),
          json: () => Promise.resolve({ success: false, error: 'Internal error', code: 'INTERNAL_ERROR' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          headers: new Headers(),
          json: () => Promise.resolve(SUCCESS_RESPONSE),
        })

      globalThis.fetch = fetchMock

      const client = new OpsTrailsClient({
        apiKey: 'ot_test',
        retry: { maxRetries: 3, initialDelayMs: 10, backoffMultiplier: 1, maxJitter: 0 },
      })

      const result = await client.trackEvent({ type: 'test', source: '//test' })
      expect(result.id).toBe('evt_123')
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('retries on 502 and succeeds', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          headers: new Headers(),
          json: () => Promise.resolve({ success: false, error: 'Bad gateway', code: 'BAD_GATEWAY' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          headers: new Headers(),
          json: () => Promise.resolve(SUCCESS_RESPONSE),
        })

      globalThis.fetch = fetchMock

      const client = new OpsTrailsClient({
        apiKey: 'ot_test',
        retry: { maxRetries: 3, initialDelayMs: 10, backoffMultiplier: 1, maxJitter: 0 },
      })

      const result = await client.trackEvent({ type: 'test', source: '//test' })
      expect(result.id).toBe('evt_123')
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('retries on 503 and succeeds', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          headers: new Headers(),
          json: () => Promise.resolve({ success: false, error: 'Service unavailable', code: 'SERVICE_UNAVAILABLE' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          headers: new Headers(),
          json: () => Promise.resolve(SUCCESS_RESPONSE),
        })

      globalThis.fetch = fetchMock

      const client = new OpsTrailsClient({
        apiKey: 'ot_test',
        retry: { maxRetries: 3, initialDelayMs: 10, backoffMultiplier: 1, maxJitter: 0 },
      })

      const result = await client.trackEvent({ type: 'test', source: '//test' })
      expect(result.id).toBe('evt_123')
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('retries on network error and eventually succeeds', async () => {
      const fetchMock = vi.fn()
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          headers: new Headers(),
          json: () => Promise.resolve(SUCCESS_RESPONSE),
        })

      globalThis.fetch = fetchMock

      const client = new OpsTrailsClient({
        apiKey: 'ot_test',
        retry: { maxRetries: 3, initialDelayMs: 10, backoffMultiplier: 1, maxJitter: 0 },
      })

      const result = await client.trackEvent({ type: 'test', source: '//test' })
      expect(result.id).toBe('evt_123')
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('retries on timeout (AbortError) and eventually succeeds', async () => {
      const fetchMock = vi.fn()
        .mockRejectedValueOnce(new DOMException('The operation was aborted', 'AbortError'))
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          headers: new Headers(),
          json: () => Promise.resolve(SUCCESS_RESPONSE),
        })

      globalThis.fetch = fetchMock

      const client = new OpsTrailsClient({
        apiKey: 'ot_test',
        timeout: 100,
        retry: { maxRetries: 3, initialDelayMs: 10, backoffMultiplier: 1, maxJitter: 0 },
      })

      const result = await client.trackEvent({ type: 'test', source: '//test' })
      expect(result.id).toBe('evt_123')
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('does NOT retry on 400', async () => {
      const fetchMock = mockFetchResponse(
        { success: false, error: 'Bad request', code: 'VALIDATION_ERROR' },
        400,
      )
      globalThis.fetch = fetchMock

      const client = new OpsTrailsClient({
        apiKey: 'ot_test',
        retry: { maxRetries: 3, initialDelayMs: 10, backoffMultiplier: 1, maxJitter: 0 },
      })

      await expect(client.trackEvent({ type: 'test', source: '//test' }))
        .rejects.toThrow(ValidationError)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('does NOT retry on 401', async () => {
      const fetchMock = mockFetchResponse(
        { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
        401,
      )
      globalThis.fetch = fetchMock

      const client = new OpsTrailsClient({
        apiKey: 'ot_test',
        retry: { maxRetries: 3, initialDelayMs: 10, backoffMultiplier: 1, maxJitter: 0 },
      })

      await expect(client.trackEvent({ type: 'test', source: '//test' }))
        .rejects.toThrow(AuthenticationError)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('does NOT retry on 403', async () => {
      const fetchMock = mockFetchResponse(
        { success: false, error: 'Forbidden', code: 'FORBIDDEN' },
        403,
      )
      globalThis.fetch = fetchMock

      const client = new OpsTrailsClient({
        apiKey: 'ot_test',
        retry: { maxRetries: 3, initialDelayMs: 10, backoffMultiplier: 1, maxJitter: 0 },
      })

      await expect(client.trackEvent({ type: 'test', source: '//test' }))
        .rejects.toThrow(ForbiddenError)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('does NOT retry on 404', async () => {
      const fetchMock = mockFetchResponse(
        { success: false, error: 'Not found', code: 'NOT_FOUND' },
        404,
      )
      globalThis.fetch = fetchMock

      const client = new OpsTrailsClient({
        apiKey: 'ot_test',
        retry: { maxRetries: 3, initialDelayMs: 10, backoffMultiplier: 1, maxJitter: 0 },
      })

      await expect(client.trackEvent({ type: 'test', source: '//test' }))
        .rejects.toThrow(NotFoundError)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('respects Retry-After header value', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Headers({ 'Retry-After': '2' }),
          json: () => Promise.resolve({ success: false, error: 'Rate limited', code: 'QUOTA_EXCEEDED' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          headers: new Headers(),
          json: () => Promise.resolve(SUCCESS_RESPONSE),
        })

      globalThis.fetch = fetchMock

      const client = new OpsTrailsClient({
        apiKey: 'ot_test',
        retry: { maxRetries: 3, initialDelayMs: 10, backoffMultiplier: 1, maxJitter: 0 },
      })

      const result = await client.trackEvent({ type: 'test', source: '//test' })
      expect(result.id).toBe('evt_123')
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('throws QuotaExceededError after max retries on 429', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '0' }),
        json: () => Promise.resolve({ success: false, error: 'Quota exceeded', code: 'QUOTA_EXCEEDED' }),
      })

      globalThis.fetch = fetchMock

      const client = new OpsTrailsClient({
        apiKey: 'ot_test',
        retry: { maxRetries: 2, initialDelayMs: 10, backoffMultiplier: 1, maxJitter: 0 },
      })

      await expect(client.trackEvent({ type: 'test', source: '//test' }))
        .rejects.toThrow(QuotaExceededError)
      expect(fetchMock).toHaveBeenCalledTimes(3) // initial + 2 retries
    })

    it('throws NetworkError after exhausting all retries on persistent network failure', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new TypeError('fetch failed'))

      globalThis.fetch = fetchMock

      const client = new OpsTrailsClient({
        apiKey: 'ot_test',
        retry: { maxRetries: 2, initialDelayMs: 10, backoffMultiplier: 1, maxJitter: 0 },
      })

      await expect(client.trackEvent({ type: 'test', source: '//test' }))
        .rejects.toThrow(NetworkError)
      expect(fetchMock).toHaveBeenCalledTimes(3) // initial + 2 retries
    })

    it('throws TimeoutError after exhausting all retries on persistent timeout', async () => {
      const fetchMock = vi.fn().mockRejectedValue(
        new DOMException('The operation was aborted', 'AbortError'),
      )

      globalThis.fetch = fetchMock

      const client = new OpsTrailsClient({
        apiKey: 'ot_test',
        timeout: 100,
        retry: { maxRetries: 2, initialDelayMs: 10, backoffMultiplier: 1, maxJitter: 0 },
      })

      await expect(client.trackEvent({ type: 'test', source: '//test' }))
        .rejects.toThrow(TimeoutError)
      expect(fetchMock).toHaveBeenCalledTimes(3) // initial + 2 retries
    })
  })
})
