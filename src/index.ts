export { OpsTrailsClient } from './client.js'

export {
  OpsTrailsError,
  AuthenticationError,
  ForbiddenError,
  ValidationError,
  QuotaExceededError,
  NotFoundError,
  NetworkError,
  TimeoutError,
  createErrorFromResponse,
} from './errors.js'

export type {
  CloudEvent,
  Severity,
  EventData,
  TrackEventOptions,
  TrackEventResponse,
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiResponse,
  ClientOptions,
  RetryOptions,
} from './types.js'
