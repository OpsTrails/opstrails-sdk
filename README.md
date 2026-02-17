# @opstrails/sdk

Official TypeScript SDK for [OpsTrails](https://opstrails.dev) event ingestion.

## Features

- Zero runtime dependencies — uses native `fetch` (Node 18+, Deno, Bun, edge runtimes)
- ESM + CJS dual output
- Strict TypeScript types
- Automatic retry with exponential backoff + jitter
- Respects `Retry-After` header
- Typed error classes mapping 1:1 to API error codes

## Installation

```bash
npm install @opstrails/sdk
```

## Quick Start

```typescript
import { OpsTrailsClient } from '@opstrails/sdk'

const client = new OpsTrailsClient({
  apiKey: 'ot_your_api_key',
})

await client.trackEvent({
  type: 'deployment',
  source: '//github.com/your-org/your-repo',
  subject: 'production',
  version: 'v1.2.3',
  severity: 'LOW',
  data: {
    description: 'Deployed v1.2.3 to production',
  },
})
```

## API Reference

### `new OpsTrailsClient(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | *required* | OpsTrails API key (`ot_` or `otr_` prefix) |
| `baseUrl` | `string` | `https://api.opstrails.dev` | API base URL |
| `timeout` | `number` | `30000` | Request timeout in milliseconds |
| `retry` | `Partial<RetryOptions>` | See below | Retry configuration |

#### Retry Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxRetries` | `number` | `3` | Maximum retry attempts |
| `initialDelayMs` | `number` | `1000` | Initial delay between retries |
| `backoffMultiplier` | `number` | `2` | Exponential backoff multiplier |
| `maxJitter` | `number` | `0.25` | Max jitter fraction (0-1) |

Only 429 (rate limit) and 5xx (server error) responses are retried. Client errors (4xx) are never retried.

### `client.trackEvent(options): Promise<TrackEventResponse>`

Track an infrastructure event. Automatically sets `specversion: "1.0"` and defaults `time` to `"NOW"` (server-side timestamp).

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `type` | `string` | Yes | Event type (e.g. "deployment", "rollback"). 1-100 chars |
| `source` | `string` | Yes | Event source URI (e.g. "//github.com/org/repo"). 1-500 chars |
| `id` | `string` | No | Event ID. Max 200 chars. Auto-generated if omitted |
| `time` | `string \| Date` | No | Event time. ISO 8601, RFC 2822, Date object, or "NOW" |
| `subject` | `string` | No | Event subject (e.g. environment). Max 50 chars |
| `severity` | `Severity` | No | `"LOW"`, `"MINOR"`, `"MAJOR"`, or `"CRITICAL"` |
| `version` | `string` | No | Version string. Max 50 chars |
| `data` | `EventData` | No | Additional event data |

### `client.sendRawEvent(event): Promise<TrackEventResponse>`

Send a raw [CloudEvents 1.0](https://cloudevents.io/) JSON payload. Use this when you need full control over the event fields.

## Error Handling

All errors extend `OpsTrailsError` with `status`, `code`, and `message` properties.

```typescript
import { OpsTrailsClient, AuthenticationError, QuotaExceededError } from '@opstrails/sdk'

try {
  await client.trackEvent({ type: 'deployment', source: '//test' })
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid API key')
  } else if (error instanceof QuotaExceededError) {
    console.error('Monthly quota exceeded')
  }
}
```

| Error Class | API Code | HTTP Status |
|-------------|----------|-------------|
| `AuthenticationError` | `UNAUTHORIZED` | 401 |
| `ForbiddenError` | `FORBIDDEN` | 403 |
| `ValidationError` | `VALIDATION_ERROR` | 400 |
| `QuotaExceededError` | `QUOTA_EXCEEDED` | 429 |
| `NotFoundError` | `NOT_FOUND` | 404 |
| `NetworkError` | `NETWORK_ERROR` | 0 |
| `TimeoutError` | `TIMEOUT` | 0 |

## Edge Runtime Support

The SDK uses only standard Web APIs (`fetch`, `AbortController`) and works in any runtime that supports them — Node.js 18+, Deno, Bun, Cloudflare Workers, Vercel Edge Functions, etc.

## License

MIT
