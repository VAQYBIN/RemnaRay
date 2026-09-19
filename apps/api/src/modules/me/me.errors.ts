import { HttpException, type HttpStatus } from '@nestjs/common';

/** Section 9.3 error envelope for the user-facing API. */
export class ApiError extends HttpException {
  constructor(
    readonly code: string,
    status: HttpStatus | number,
    message?: string,
    details?: unknown,
  ) {
    super(
      {
        error: {
          code,
          message: message ?? code,
          messageKey: `errors.${code.toLowerCase()}`,
          ...(details === undefined ? {} : { details }),
        },
      },
      status,
    );
  }
}
