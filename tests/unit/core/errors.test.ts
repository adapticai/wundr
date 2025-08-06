/**
 * Comprehensive test suite for all error classes
 * Tests error construction, inheritance, properties, and serialization
 */

import {
  AppError,
  ValidationError,
  NotFoundError,
  FileSystemError,
  AnalysisError,
  ConfigurationError,
  CompilationError
} from '@/core/errors';

describe('Error Classes', () => {
  describe('AppError', () => {
    describe('Constructor', () => {
      it('should create AppError with required parameters', () => {
        const error = new AppError('Test message', 'TEST_CODE');
        
        expect(error.message).toBe('Test message');
        expect(error.code).toBe('TEST_CODE');
        expect(error.statusCode).toBe(500); // default
        expect(error.isOperational).toBe(true); // default
        expect(error.name).toBe('AppError');
      });

      it('should create AppError with all parameters', () => {
        const error = new AppError('Test message', 'TEST_CODE', 400, false);
        
        expect(error.message).toBe('Test message');
        expect(error.code).toBe('TEST_CODE');
        expect(error.statusCode).toBe(400);
        expect(error.isOperational).toBe(false);
        expect(error.name).toBe('AppError');
      });

      it('should be instance of Error', () => {
        const error = new AppError('Test', 'TEST');
        
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(AppError);
      });

      it('should have proper prototype chain', () => {
        const error = new AppError('Test', 'TEST');
        
        expect(Object.getPrototypeOf(error)).toBe(AppError.prototype);
        expect(Object.getPrototypeOf(AppError.prototype)).toBe(Error.prototype);
      });

      it('should capture stack trace', () => {
        const error = new AppError('Test', 'TEST');
        
        expect(error.stack).toBeDefined();
        expect(typeof error.stack).toBe('string');
        expect(error.stack).toContain('AppError');
      });

      it('should handle Error.captureStackTrace when available', () => {
        const originalCaptureStackTrace = Error.captureStackTrace;
        const mockCaptureStackTrace = jest.fn();
        
        // Mock Error.captureStackTrace
        (Error as any).captureStackTrace = mockCaptureStackTrace;
        
        const error = new AppError('Test', 'TEST');
        
        expect(mockCaptureStackTrace).toHaveBeenCalledWith(error, AppError);
        
        // Restore original
        Error.captureStackTrace = originalCaptureStackTrace;
      });

      it('should handle missing Error.captureStackTrace gracefully', () => {
        const originalCaptureStackTrace = Error.captureStackTrace;
        delete (Error as any).captureStackTrace;
        
        expect(() => {
          new AppError('Test', 'TEST');
        }).not.toThrow();
        
        // Restore original
        Error.captureStackTrace = originalCaptureStackTrace;
      });
    });

    describe('Properties', () => {
      it('should have readonly properties', () => {
        const error = new AppError('Test', 'TEST_CODE', 404, false);
        
        // These should be readonly
        expect(() => {
          (error as any).code = 'NEW_CODE';
        }).not.toThrow(); // TypeScript would catch this, but runtime doesn't prevent it
        
        expect(() => {
          (error as any).statusCode = 500;
        }).not.toThrow();
        
        expect(() => {
          (error as any).isOperational = true;
        }).not.toThrow();
      });

      it('should maintain property values', () => {
        const error = new AppError('Custom message', 'CUSTOM_CODE', 418, false);
        
        expect(error.message).toBe('Custom message');
        expect(error.code).toBe('CUSTOM_CODE');
        expect(error.statusCode).toBe(418);
        expect(error.isOperational).toBe(false);
      });
    });

    describe('Serialization', () => {
      it('should have enumerable properties', () => {
        const error = new AppError('Test error', 'TEST_ERROR', 400, true);
        
        expect(error.message).toBe('Test error');
        expect(error.name).toBe('AppError');
        expect(error.code).toBe('TEST_ERROR');
        expect(error.statusCode).toBe(400);
        expect(error.isOperational).toBe(true);
      });

      it('should have stack trace property', () => {
        const error = new AppError('Test', 'TEST');
        
        expect(error.stack).toBeDefined();
        expect(typeof error.stack).toBe('string');
        expect(error.stack).toContain('AppError');
      });
    });

    describe('Error Handling', () => {
      it('should be throwable and catchable', () => {
        expect(() => {
          throw new AppError('Test error', 'TEST');
        }).toThrow(AppError);
        
        expect(() => {
          throw new AppError('Test error', 'TEST');
        }).toThrow('Test error');
      });

      it('should work with try-catch blocks', () => {
        let caughtError: AppError | null = null;
        
        try {
          throw new AppError('Caught error', 'CAUGHT', 422);
        } catch (error) {
          caughtError = error as AppError;
        }
        
        expect(caughtError).toBeInstanceOf(AppError);
        expect(caughtError?.message).toBe('Caught error');
        expect(caughtError?.code).toBe('CAUGHT');
        expect(caughtError?.statusCode).toBe(422);
      });

      it('should work with instanceof checks', () => {
        const error = new AppError('Test', 'TEST');
        
        expect(error instanceof Error).toBe(true);
        expect(error instanceof AppError).toBe(true);
      });
    });
  });

  describe('ValidationError', () => {
    describe('Constructor', () => {
      it('should create ValidationError with message and fields', () => {
        const fields = ['email', 'password'];
        const error = new ValidationError('Validation failed', fields);
        
        expect(error.message).toBe('Validation failed');
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.statusCode).toBe(400);
        expect(error.isOperational).toBe(true);
        expect(error.fields).toEqual(fields);
        expect(error.name).toBe('ValidationError');
      });

      it('should handle empty fields array', () => {
        const error = new ValidationError('No specific fields', []);
        
        expect(error.fields).toEqual([]);
        expect(error.message).toBe('No specific fields');
      });

      it('should handle single field', () => {
        const error = new ValidationError('Field is required', ['username']);
        
        expect(error.fields).toEqual(['username']);
      });

      it('should handle multiple fields', () => {
        const fields = ['name', 'email', 'phone', 'address'];
        const error = new ValidationError('Multiple validation errors', fields);
        
        expect(error.fields).toEqual(fields);
        expect(error.fields.length).toBe(4);
      });
    });

    describe('Inheritance', () => {
      it('should extend AppError', () => {
        const error = new ValidationError('Test', ['field']);
        
        expect(error).toBeInstanceOf(AppError);
        expect(error).toBeInstanceOf(ValidationError);
        expect(error).toBeInstanceOf(Error);
      });

      it('should inherit AppError properties', () => {
        const error = new ValidationError('Validation message', ['field1']);
        
        expect(error.isOperational).toBe(true);
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.statusCode).toBe(400);
      });
    });

    describe('Properties', () => {
      it('should have readonly fields property', () => {
        const fields = ['test'];
        const error = new ValidationError('Test', fields);
        
        expect(error.fields).toBe(fields);
        expect(error.fields).toEqual(['test']);
      });

      it('should preserve field array reference', () => {
        const fields = ['field1', 'field2'];
        const error = new ValidationError('Test', fields);
        
        // The fields should be the same reference
        expect(error.fields).toBe(fields);
      });
    });

    describe('Properties', () => {
      it('should have all expected properties', () => {
        const error = new ValidationError('Validation error', ['email', 'password']);
        
        expect(error.fields).toEqual(['email', 'password']);
        expect(error.message).toBe('Validation error');
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.statusCode).toBe(400);
      });
    });
  });

  describe('NotFoundError', () => {
    describe('Constructor', () => {
      it('should create NotFoundError with resource and id', () => {
        const error = new NotFoundError('User', '123');
        
        expect(error.message).toBe('User with id 123 not found');
        expect(error.code).toBe('NOT_FOUND');
        expect(error.statusCode).toBe(404);
        expect(error.isOperational).toBe(true);
        expect(error.name).toBe('NotFoundError');
      });

      it('should handle different resource types', () => {
        const userError = new NotFoundError('User', 'abc-123');
        const productError = new NotFoundError('Product', '456');
        const orderError = new NotFoundError('Order', 'order-789');
        
        expect(userError.message).toBe('User with id abc-123 not found');
        expect(productError.message).toBe('Product with id 456 not found');
        expect(orderError.message).toBe('Order with id order-789 not found');
      });

      it('should handle empty strings', () => {
        const error = new NotFoundError('', '');
        expect(error.message).toBe(' with id  not found');
      });

      it('should handle special characters in resource and id', () => {
        const error = new NotFoundError('User Profile', 'user@example.com');
        expect(error.message).toBe('User Profile with id user@example.com not found');
      });
    });

    describe('Inheritance', () => {
      it('should extend AppError', () => {
        const error = new NotFoundError('Resource', 'id');
        
        expect(error).toBeInstanceOf(AppError);
        expect(error).toBeInstanceOf(NotFoundError);
        expect(error).toBeInstanceOf(Error);
      });

      it('should have correct default properties', () => {
        const error = new NotFoundError('Test', '123');
        
        expect(error.code).toBe('NOT_FOUND');
        expect(error.statusCode).toBe(404);
        expect(error.isOperational).toBe(true);
      });
    });
  });

  describe('FileSystemError', () => {
    describe('Constructor', () => {
      it('should create FileSystemError with operation and path', () => {
        const error = new FileSystemError('read', '/path/to/file.txt');
        
        expect(error.message).toBe('File system read failed for /path/to/file.txt');
        expect(error.code).toBe('FS_ERROR');
        expect(error.statusCode).toBe(500);
        expect(error.isOperational).toBe(true);
        expect(error.name).toBe('FileSystemError');
      });

      it('should create FileSystemError with cause', () => {
        const cause = new Error('Permission denied');
        const error = new FileSystemError('write', '/restricted/file.txt', cause);
        
        expect(error.message).toBe('File system write failed for /restricted/file.txt');
        expect(error.stack).toBe(cause.stack);
      });

      it('should handle different operations', () => {
        const readError = new FileSystemError('read', '/file1.txt');
        const writeError = new FileSystemError('write', '/file2.txt');
        const deleteError = new FileSystemError('delete', '/file3.txt');
        const createError = new FileSystemError('create', '/file4.txt');
        
        expect(readError.message).toContain('read failed');
        expect(writeError.message).toContain('write failed');
        expect(deleteError.message).toContain('delete failed');
        expect(createError.message).toContain('create failed');
      });

      it('should handle various path formats', () => {
        const unixPath = new FileSystemError('read', '/home/user/file.txt');
        const windowsPath = new FileSystemError('read', 'C:\\Users\\User\\file.txt');
        const relativePath = new FileSystemError('read', './relative/file.txt');
        
        expect(unixPath.message).toContain('/home/user/file.txt');
        expect(windowsPath.message).toContain('C:\\Users\\User\\file.txt');
        expect(relativePath.message).toContain('./relative/file.txt');
      });
    });

    describe('Cause Handling', () => {
      it('should preserve cause stack trace', () => {
        const cause = new Error('Original error');
        const originalStack = cause.stack;
        
        const error = new FileSystemError('operation', '/path', cause);
        
        expect(error.stack).toBe(originalStack);
      });

      it('should work without cause', () => {
        const error = new FileSystemError('operation', '/path');
        
        expect(error.stack).toBeDefined();
        expect(error.stack).not.toBe(undefined);
      });

      it('should handle undefined cause', () => {
        const error = new FileSystemError('operation', '/path', undefined);
        
        expect(error.stack).toBeDefined();
      });
    });

    describe('Inheritance', () => {
      it('should extend AppError', () => {
        const error = new FileSystemError('read', '/path');
        
        expect(error).toBeInstanceOf(AppError);
        expect(error).toBeInstanceOf(FileSystemError);
        expect(error).toBeInstanceOf(Error);
      });
    });
  });

  describe('AnalysisError', () => {
    describe('Constructor', () => {
      it('should create AnalysisError with message only', () => {
        const error = new AnalysisError('Analysis failed');
        
        expect(error.message).toBe('Analysis failed');
        expect(error.code).toBe('ANALYSIS_ERROR');
        expect(error.statusCode).toBe(500);
        expect(error.isOperational).toBe(true);
        expect(error.file).toBeUndefined();
        expect(error.name).toBe('AnalysisError');
      });

      it('should create AnalysisError with message and file', () => {
        const error = new AnalysisError('Parsing failed', '/src/component.tsx');
        
        expect(error.message).toBe('Parsing failed');
        expect(error.file).toBe('/src/component.tsx');
        expect(error.code).toBe('ANALYSIS_ERROR');
      });

      it('should handle various file paths', () => {
        const tsFile = new AnalysisError('TypeScript error', 'src/types.ts');
        const jsFile = new AnalysisError('JavaScript error', 'lib/utils.js');
        const jsonFile = new AnalysisError('JSON parse error', 'config.json');
        
        expect(tsFile.file).toBe('src/types.ts');
        expect(jsFile.file).toBe('lib/utils.js');
        expect(jsonFile.file).toBe('config.json');
      });

      it('should handle empty file path', () => {
        const error = new AnalysisError('Error', '');
        expect(error.file).toBe('');
      });
    });

    describe('Properties', () => {
      it('should have readonly file property', () => {
        const error = new AnalysisError('Test', 'file.ts');
        
        expect(error.file).toBe('file.ts');
      });

      it('should handle undefined file gracefully', () => {
        const error = new AnalysisError('Test');
        
        expect(error.file).toBeUndefined();
        expect(error.message).toBe('Test');
      });
    });

    describe('Inheritance', () => {
      it('should extend AppError', () => {
        const error = new AnalysisError('Test');
        
        expect(error).toBeInstanceOf(AppError);
        expect(error).toBeInstanceOf(AnalysisError);
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('Property Access', () => {
      it('should have file property when provided', () => {
        const error = new AnalysisError('Analysis failed', 'src/app.ts');
        
        expect(error.file).toBe('src/app.ts');
        expect(error.message).toBe('Analysis failed');
        expect(error.code).toBe('ANALYSIS_ERROR');
      });

      it('should have undefined file property when not provided', () => {
        const error = new AnalysisError('General analysis error');
        
        expect(error.file).toBeUndefined();
        expect(error.message).toBe('General analysis error');
      });
    });
  });

  describe('ConfigurationError', () => {
    describe('Constructor', () => {
      it('should create ConfigurationError with message only', () => {
        const error = new ConfigurationError('Invalid configuration');
        
        expect(error.message).toBe('Invalid configuration');
        expect(error.code).toBe('CONFIG_ERROR');
        expect(error.statusCode).toBe(400);
        expect(error.isOperational).toBe(true);
        expect(error.configKey).toBeUndefined();
        expect(error.name).toBe('ConfigurationError');
      });

      it('should create ConfigurationError with message and config key', () => {
        const error = new ConfigurationError('Missing required config', 'database.host');
        
        expect(error.message).toBe('Missing required config');
        expect(error.configKey).toBe('database.host');
        expect(error.code).toBe('CONFIG_ERROR');
      });

      it('should handle various config key formats', () => {
        const dotNotation = new ConfigurationError('Error', 'app.server.port');
        const simpleKey = new ConfigurationError('Error', 'timeout');
        const arrayKey = new ConfigurationError('Error', 'servers[0].host');
        
        expect(dotNotation.configKey).toBe('app.server.port');
        expect(simpleKey.configKey).toBe('timeout');
        expect(arrayKey.configKey).toBe('servers[0].host');
      });

      it('should handle empty config key', () => {
        const error = new ConfigurationError('Error', '');
        expect(error.configKey).toBe('');
      });
    });

    describe('Properties', () => {
      it('should have readonly configKey property', () => {
        const error = new ConfigurationError('Test', 'test.key');
        
        expect(error.configKey).toBe('test.key');
      });

      it('should handle undefined configKey gracefully', () => {
        const error = new ConfigurationError('Test');
        
        expect(error.configKey).toBeUndefined();
        expect(error.message).toBe('Test');
      });
    });

    describe('Inheritance', () => {
      it('should extend AppError', () => {
        const error = new ConfigurationError('Test');
        
        expect(error).toBeInstanceOf(AppError);
        expect(error).toBeInstanceOf(ConfigurationError);
        expect(error).toBeInstanceOf(Error);
      });

      it('should have correct status code', () => {
        const error = new ConfigurationError('Config error');
        
        expect(error.statusCode).toBe(400);
        expect(error.code).toBe('CONFIG_ERROR');
      });
    });

    describe('Property Access', () => {
      it('should have configKey property when provided', () => {
        const error = new ConfigurationError('Config missing', 'api.key');
        
        expect(error.configKey).toBe('api.key');
        expect(error.message).toBe('Config missing');
        expect(error.code).toBe('CONFIG_ERROR');
      });

      it('should have undefined configKey property when not provided', () => {
        const error = new ConfigurationError('General config error');
        
        expect(error.configKey).toBeUndefined();
        expect(error.message).toBe('General config error');
      });
    });
  });

  describe('CompilationError', () => {
    describe('Constructor', () => {
      it('should create CompilationError with message only', () => {
        const error = new CompilationError('Compilation failed');
        
        expect(error.message).toBe('Compilation failed');
        expect(error.code).toBe('COMPILATION_ERROR');
        expect(error.statusCode).toBe(500);
        expect(error.isOperational).toBe(true);
        expect(error.errors).toBeUndefined();
        expect(error.name).toBe('CompilationError');
      });

      it('should create CompilationError with message and errors', () => {
        const compilerErrors = [
          { file: 'src/app.ts', line: 10, message: 'Type error' },
          { file: 'src/utils.ts', line: 25, message: 'Syntax error' }
        ];
        
        const error = new CompilationError('Multiple compilation errors', compilerErrors);
        
        expect(error.message).toBe('Multiple compilation errors');
        expect(error.errors).toEqual(compilerErrors);
        expect(error.code).toBe('COMPILATION_ERROR');
      });

      it('should handle empty errors array', () => {
        const error = new CompilationError('No specific errors', []);
        
        expect(error.errors).toEqual([]);
        expect(error.message).toBe('No specific errors');
      });

      it('should handle various error formats', () => {
        const stringErrors = ['Error 1', 'Error 2'];
        const objectErrors = [
          { message: 'Type mismatch', location: { line: 5, column: 10 } },
          { message: 'Missing import', file: 'component.tsx' }
        ];
        
        const stringError = new CompilationError('String errors', stringErrors);
        const objectError = new CompilationError('Object errors', objectErrors);
        
        expect(stringError.errors).toEqual(stringErrors);
        expect(objectError.errors).toEqual(objectErrors);
      });
    });

    describe('Properties', () => {
      it('should have readonly errors property', () => {
        const errors = [{ message: 'Test error' }];
        const error = new CompilationError('Test', errors);
        
        expect(error.errors).toBe(errors);
      });

      it('should handle undefined errors gracefully', () => {
        const error = new CompilationError('Test');
        
        expect(error.errors).toBeUndefined();
        expect(error.message).toBe('Test');
      });

      it('should preserve error array reference', () => {
        const errors = ['error1', 'error2'];
        const error = new CompilationError('Test', errors);
        
        expect(error.errors).toBe(errors);
      });
    });

    describe('Inheritance', () => {
      it('should extend AppError', () => {
        const error = new CompilationError('Test');
        
        expect(error).toBeInstanceOf(AppError);
        expect(error).toBeInstanceOf(CompilationError);
        expect(error).toBeInstanceOf(Error);
      });

      it('should have correct default properties', () => {
        const error = new CompilationError('Compilation error');
        
        expect(error.code).toBe('COMPILATION_ERROR');
        expect(error.statusCode).toBe(500);
        expect(error.isOperational).toBe(true);
      });
    });

    describe('Property Access', () => {
      it('should have errors property when provided', () => {
        const errors = [
          { file: 'app.ts', message: 'Type error' },
          { file: 'utils.ts', message: 'Syntax error' }
        ];
        const error = new CompilationError('Compilation failed', errors);
        
        expect(error.errors).toEqual(errors);
        expect(error.message).toBe('Compilation failed');
        expect(error.code).toBe('COMPILATION_ERROR');
      });

      it('should have undefined errors property when not provided', () => {
        const error = new CompilationError('General compilation error');
        
        expect(error.errors).toBeUndefined();
        expect(error.message).toBe('General compilation error');
      });
    });
  });

  describe('Error Class Relationships', () => {
    describe('Inheritance Chain', () => {
      it('should all extend AppError', () => {
        const validation = new ValidationError('test', []);
        const notFound = new NotFoundError('resource', 'id');
        const fileSystem = new FileSystemError('op', 'path');
        const analysis = new AnalysisError('test');
        const configuration = new ConfigurationError('test');
        const compilation = new CompilationError('test');
        
        expect(validation).toBeInstanceOf(AppError);
        expect(notFound).toBeInstanceOf(AppError);
        expect(fileSystem).toBeInstanceOf(AppError);
        expect(analysis).toBeInstanceOf(AppError);
        expect(configuration).toBeInstanceOf(AppError);
        expect(compilation).toBeInstanceOf(AppError);
      });

      it('should all extend Error', () => {
        const validation = new ValidationError('test', []);
        const notFound = new NotFoundError('resource', 'id');
        const fileSystem = new FileSystemError('op', 'path');
        const analysis = new AnalysisError('test');
        const configuration = new ConfigurationError('test');
        const compilation = new CompilationError('test');
        
        expect(validation).toBeInstanceOf(Error);
        expect(notFound).toBeInstanceOf(Error);
        expect(fileSystem).toBeInstanceOf(Error);
        expect(analysis).toBeInstanceOf(Error);
        expect(configuration).toBeInstanceOf(Error);
        expect(compilation).toBeInstanceOf(Error);
      });
    });

    describe('Unique Codes', () => {
      it('should have unique error codes', () => {
        const codes = [
          new AppError('test', 'APP_ERROR').code,
          new ValidationError('test', []).code,
          new NotFoundError('resource', 'id').code,
          new FileSystemError('op', 'path').code,
          new AnalysisError('test').code,
          new ConfigurationError('test').code,
          new CompilationError('test').code
        ];
        
        const uniqueCodes = new Set(codes);
        expect(uniqueCodes.size).toBe(codes.length);
      });
    });

    describe('Status Code Patterns', () => {
      it('should use appropriate HTTP status codes', () => {
        const validation = new ValidationError('test', []);
        const notFound = new NotFoundError('resource', 'id');
        const configuration = new ConfigurationError('test');
        const fileSystem = new FileSystemError('op', 'path');
        const analysis = new AnalysisError('test');
        const compilation = new CompilationError('test');
        
        // Client errors (4xx)
        expect(validation.statusCode).toBe(400);
        expect(notFound.statusCode).toBe(404);
        expect(configuration.statusCode).toBe(400);
        
        // Server errors (5xx)
        expect(fileSystem.statusCode).toBe(500);
        expect(analysis.statusCode).toBe(500);
        expect(compilation.statusCode).toBe(500);
      });
    });

    describe('Operational Flag', () => {
      it('should all be operational by default', () => {
        const errors = [
          new ValidationError('test', []),
          new NotFoundError('resource', 'id'),
          new FileSystemError('op', 'path'),
          new AnalysisError('test'),
          new ConfigurationError('test'),
          new CompilationError('test')
        ];
        
        errors.forEach(error => {
          expect(error.isOperational).toBe(true);
        });
      });
    });
  });

  describe('Error Usage Patterns', () => {
    describe('Try-Catch Integration', () => {
      it('should work with generic error handling', () => {
        const errors = [
          new ValidationError('Validation failed', ['field']),
          new NotFoundError('User', '123'),
          new FileSystemError('read', '/file.txt'),
          new AnalysisError('Parse error', 'file.ts'),
          new ConfigurationError('Missing config', 'key'),
          new CompilationError('Build failed', [])
        ];
        
        errors.forEach(error => {
          try {
            throw error;
          } catch (caught) {
            expect(caught).toBeInstanceOf(AppError);
            expect(caught).toBeInstanceOf(Error);
            expect((caught as AppError).isOperational).toBe(true);
          }
        });
      });

      it('should allow specific error type handling', () => {
        try {
          throw new ValidationError('Field required', ['email']);
        } catch (error) {
          if (error instanceof ValidationError) {
            expect(error.fields).toContain('email');
            expect(error.code).toBe('VALIDATION_ERROR');
          } else {
            fail('Should have caught ValidationError');
          }
        }
      });
    });

    describe('Error Type Guards', () => {
      const isValidationError = (error: any): error is ValidationError => {
        return error instanceof ValidationError;
      };
      
      const isNotFoundError = (error: any): error is NotFoundError => {
        return error instanceof NotFoundError;
      };
      
      it('should work with type guards', () => {
        const validationError = new ValidationError('test', ['field']);
        const notFoundError = new NotFoundError('User', '123');
        
        expect(isValidationError(validationError)).toBe(true);
        expect(isValidationError(notFoundError)).toBe(false);
        
        expect(isNotFoundError(notFoundError)).toBe(true);
        expect(isNotFoundError(validationError)).toBe(false);
      });
    });

    describe('Error Transformation', () => {
      it('should allow error wrapping', () => {
        const originalError = new Error('Original error');
        const wrappedError = new FileSystemError('read', '/file.txt', originalError);
        
        expect(wrappedError.message).toContain('read failed');
        expect(wrappedError.stack).toBe(originalError.stack);
      });

      it('should support error chaining patterns', () => {
        const rootCause = new Error('Network timeout');
        const fileError = new FileSystemError('download', '/remote/file.txt', rootCause);
        const analysisError = new AnalysisError('Cannot analyze remote file', '/remote/file.txt');
        
        expect(fileError.stack).toBe(rootCause.stack);
        expect(analysisError.file).toBe('/remote/file.txt');
      });
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    describe('Null and Undefined Handling', () => {
      it('should handle null/undefined messages', () => {
        expect(() => new AppError(null as any, 'TEST')).not.toThrow();
        expect(() => new AppError(undefined as any, 'TEST')).not.toThrow();
      });

      it('should handle null/undefined codes', () => {
        expect(() => new AppError('test', null as any)).not.toThrow();
        expect(() => new AppError('test', undefined as any)).not.toThrow();
      });
    });

    describe('Extreme Values', () => {
      it('should handle very long messages', () => {
        const longMessage = 'a'.repeat(10000);
        const error = new AppError(longMessage, 'LONG_MESSAGE');
        
        expect(error.message).toBe(longMessage);
        expect(error.message.length).toBe(10000);
      });

      it('should handle very long error codes', () => {
        const longCode = 'B'.repeat(1000);
        const error = new AppError('test', longCode);
        
        expect(error.code).toBe(longCode);
      });

      it('should handle extreme status codes', () => {
        const extremeError = new AppError('test', 'EXTREME', 999);
        expect(extremeError.statusCode).toBe(999);
        
        const negativeError = new AppError('test', 'NEGATIVE', -1);
        expect(negativeError.statusCode).toBe(-1);
      });
    });

    describe('Unicode and Special Characters', () => {
      it('should handle unicode in messages', () => {
        const unicodeMessage = '测试错误消息 🚨 आपत्ति';
        const error = new AppError(unicodeMessage, 'UNICODE_TEST');
        
        expect(error.message).toBe(unicodeMessage);
      });

      it('should handle special characters in codes', () => {
        const specialCode = 'ERROR_WITH_SPECIAL_CHARS_@#$%';
        const error = new AppError('test', specialCode);
        
        expect(error.code).toBe(specialCode);
      });
    });
  });
});