# Changelog

## 0.1.0 (2025-02-17)

### Added

- `OpsTrailsClient` with `trackEvent()` and `sendRawEvent()` methods
- Automatic retry with exponential backoff + jitter for 429 and 5xx responses
- `Retry-After` header support
- Typed error classes: `AuthenticationError`, `ForbiddenError`, `ValidationError`, `QuotaExceededError`, `NotFoundError`, `NetworkError`, `TimeoutError`
- Request timeout via `AbortController`
- ESM + CJS dual output
- Zero runtime dependencies
