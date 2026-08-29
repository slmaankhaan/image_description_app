export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;
  readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.details = details;
  }
}

export class BadRequestError extends AppError {
  readonly statusCode = 400;
  readonly code = 'BAD_REQUEST';
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND';
}

export class PayloadTooLargeError extends AppError {
  readonly statusCode = 413;
  readonly code = 'PAYLOAD_TOO_LARGE';
}

export class UnsupportedMediaTypeError extends AppError {
  readonly statusCode = 415;
  readonly code = 'UNSUPPORTED_MEDIA_TYPE';
}

export class UnprocessableEntityError extends AppError {
  readonly statusCode = 422;
  readonly code = 'UNPROCESSABLE_ENTITY';
}
