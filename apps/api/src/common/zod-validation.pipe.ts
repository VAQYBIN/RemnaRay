import { BadRequestException, type PipeTransform } from '@nestjs/common';
import { z } from 'zod';

export class ZodValidationPipe<T> implements PipeTransform<unknown, unknown> {
  constructor(private readonly schema?: z.ZodType<T>) {}

  transform(value: unknown): unknown {
    if (!this.schema) {
      return value;
    }

    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        details: result.error.issues,
      });
    }

    return result.data;
  }
}
