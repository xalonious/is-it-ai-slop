const NOT_FOUND = 'NOT_FOUND';
const VALIDATION_FAILED = 'VALIDATION_FAILED';
const UNAUTHORIZED = 'UNAUTHORIZED';
const FORBIDDEN = 'FORBIDDEN';
const INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR';
const CONFLICT = 'CONFLICT';
const BLOCKED_URL = 'BLOCKED_URL';
const SCAN_TIMEOUT = 'SCAN_TIMEOUT';
const SITE_UNREACHABLE = 'SITE_UNREACHABLE';
const SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE';

export default class ServiceError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'ServiceError';
  }

  static notFound(message: string) {
    return new ServiceError(NOT_FOUND, message);
  }

  static validationFailed(message: string) {
    return new ServiceError(VALIDATION_FAILED, message);
  }

  static unauthorized(message: string) {
    return new ServiceError(UNAUTHORIZED, message);
  }

  static forbidden(message: string) {
    return new ServiceError(FORBIDDEN, message);
  }

  static internalServerError(message: string) {
    return new ServiceError(INTERNAL_SERVER_ERROR, message);
  }

  static conflict(message: string) {
    return new ServiceError(CONFLICT, message);
  }

  static blockedUrl(message: string) {
    return new ServiceError(BLOCKED_URL, message);
  }

  static scanTimeout(message: string) {
    return new ServiceError(SCAN_TIMEOUT, message);
  }

  static siteUnreachable(message: string) {
    return new ServiceError(SITE_UNREACHABLE, message);
  }

  static serviceUnavailable(message: string) {
    return new ServiceError(SERVICE_UNAVAILABLE, message);
  }

  get isNotFound(): boolean {
    return this.code === NOT_FOUND;
  }

  get isValidationFailed(): boolean {
    return this.code === VALIDATION_FAILED;
  }

  get isUnauthorized(): boolean {
    return this.code === UNAUTHORIZED;
  }

  get isForbidden(): boolean {
    return this.code === FORBIDDEN;
  }

  get isInternalServerError(): boolean {
    return this.code === INTERNAL_SERVER_ERROR;
  }

  get isConflict(): boolean {
    return this.code === CONFLICT;
  }
}
