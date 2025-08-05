/**
 * Result pattern for explicit error handling
 */
import { AppError } from './errors';

export type Result<T, E = AppError> = 
  | { success: true; data: T }
  | { success: false; error: E };

export class ResultHandler {
  static success<T>(data: T): Result<T> {
    return { success: true, data };
  }

  static failure<E extends AppError>(error: E): Result<never, E> {
    return { success: false, error };
  }

  static async fromPromise<T>(
    promise: Promise<T>,
    errorMapper?: (error: unknown) => AppError
  ): Promise<Result<T>> {
    try {
      const data = await promise;
      return this.success(data);
    } catch (error) {
      const mappedError = errorMapper 
        ? errorMapper(error)
        : error instanceof AppError 
          ? error 
          : new AppError(
              error instanceof Error ? error.message : 'Unknown error',
              'INTERNAL_ERROR',
              500
            );
      
      return this.failure(mappedError);
    }
  }

  static combine<T>(results: Result<T>[]): Result<T[]> {
    const errors: AppError[] = [];
    const data: T[] = [];

    for (const result of results) {
      if (result.success) {
        data.push(result.data);
      } else {
        errors.push(result.error);
      }
    }

    if (errors.length > 0) {
      return this.failure(
        new AppError(
          `Operation failed with ${errors.length} errors`,
          'MULTIPLE_ERRORS',
          400
        )
      );
    }

    return this.success(data);
  }
}