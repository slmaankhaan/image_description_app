import type { FastifyError, FastifyInstance } from 'fastify';
import { AppError } from './errors';

export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler<FastifyError | AppError>((error, _request, reply) => {
    if (error instanceof AppError) {
      reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
        },
      });
      return;
    }

    // Multipart/body-schema failures surface as Fastify errors, not AppErrors.
    if (error.validation) {
      reply.code(400).send({
        error: {
          code: 'BAD_REQUEST',
          message: error.message,
          details: error.validation,
        },
      });
      return;
    }

    if (error.code === 'FST_REQ_FILE_TOO_LARGE') {
      reply.code(413).send({
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'File exceeds the maximum allowed size.',
        },
      });
      return;
    }

    app.log.error(error);
    reply.code(500).send({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Something went wrong. Please try again.',
      },
    });
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({
      error: {
        code: 'NOT_FOUND',
        message: 'Not found.',
      },
    });
  });
}
