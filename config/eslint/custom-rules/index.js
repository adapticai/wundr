// .eslint-rules/index.js

module.exports = {
  rules: {
    /**
     * Prevent wrapper pattern in class names
     */
    'no-wrapper-pattern': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow wrapper pattern in class names',
          category: 'Best Practices',
          recommended: true
        },
        fixable: null,
        schema: [],
        messages: {
          wrapperPattern: 'Class name "{{name}}" suggests a wrapper pattern. Consider extending the base class or using composition instead.'
        }
      },
      create(context) {
        const wrapperPatterns = [
          /^Enhanced/,
          /^Extended/,
          /Wrapper$/,
          /Integration$/,
          /Adapter$/,
          /Proxy$/
        ];

        return {
          ClassDeclaration(node) {
            if (!node.id) return;

            const className = node.id.name;

            for (const pattern of wrapperPatterns) {
              if (pattern.test(className)) {
                context.report({
                  node: node.id,
                  messageId: 'wrapperPattern',
                  data: { name: className }
                });
                break;
              }
            }
          }
        };
      }
    },

    /**
     * Enforce consistent error handling with AppError
     */
    'use-app-error': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Enforce using AppError instead of generic Error or string throws',
          category: 'Error Handling',
          recommended: true
        },
        fixable: 'code',
        schema: [],
        messages: {
          useAppError: 'Use AppError instead of {{type}}',
          noStringThrow: 'Do not throw string literals. Use AppError instead.'
        }
      },
      create(context) {
        return {
          ThrowStatement(node) {
            const { argument } = node;

            // Check for string literals
            if (argument.type === 'Literal' && typeof argument.value === 'string') {
              context.report({
                node,
                messageId: 'noStringThrow',
                fix(fixer) {
                  return fixer.replaceText(
                    node,
                    `throw new AppError('${argument.value}', 'GENERAL_ERROR')`
                  );
                }
              });
            }

            // Check for new Error()
            if (
              argument.type === 'NewExpression' &&
              argument.callee.type === 'Identifier' &&
              argument.callee.name === 'Error'
            ) {
              context.report({
                node: argument,
                messageId: 'useAppError',
                data: { type: 'Error' },
                fix(fixer) {
                  const errorMessage = argument.arguments[0];
                  if (errorMessage) {
                    return fixer.replaceText(
                      argument,
                      `new AppError(${context.getSourceCode().getText(errorMessage)}, 'GENERAL_ERROR')`
                    );
                  }
                }
              });
            }
          }
        };
      }
    },

    /**
     * Prevent duplicate enum values
     */
    'no-duplicate-enum-values': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow duplicate values in enum declarations',
          category: 'Possible Errors',
          recommended: true
        },
        fixable: null,
        schema: [],
        messages: {
          duplicateValue: 'Duplicate enum value "{{value}}" already used in {{previousMember}}'
        }
      },
      create(context) {
        return {
          TSEnumDeclaration(node) {
            const valueMap = new Map();

            node.members.forEach(member => {
              if (member.initializer) {
                let value;

                // Handle string literals
                if (member.initializer.type === 'Literal') {
                  value = String(member.initializer.value);
                }
                // Handle template literals
                else if (member.initializer.type === 'TemplateLiteral' && member.initializer.expressions.length === 0) {
                  value = member.initializer.quasis[0].value.raw;
                }

                if (value !== undefined) {
                  if (valueMap.has(value)) {
                    context.report({
                      node: member,
                      messageId: 'duplicateValue',
                      data: {
                        value,
                        previousMember: valueMap.get(value)
                      }
                    });
                  } else {
                    valueMap.set(value, member.id.name);
                  }
                }
              }
            });
          }
        };
      }
    },

    /**
     * Enforce BaseService extension for service classes
     */
    'service-must-extend-base': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Enforce that service classes extend BaseService',
          category: 'Architecture',
          recommended: true
        },
        fixable: null,
        schema: [],
        messages: {
          mustExtendBase: 'Service class "{{name}}" must extend BaseService'
        }
      },
      create(context) {
        return {
          ClassDeclaration(node) {
            if (!node.id) return;

            const className = node.id.name;

            // Check if it's a service class
            if (className.endsWith('Service')) {
              // Check if it extends BaseService
              if (!node.superClass || node.superClass.name !== 'BaseService') {
                context.report({
                  node: node.id,
                  messageId: 'mustExtendBase',
                  data: { name: className }
                });
              }
            }
          }
        };
      }
    },

    /**
     * Enforce consistent async method naming
     */
    'async-method-naming': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Enforce consistent naming for async methods',
          category: 'Stylistic Issues',
          recommended: true
        },
        fixable: null,
        schema: [],
        messages: {
          verbFirst: 'Async method "{{name}}" should start with a verb (get, set, fetch, save, etc.)'
        }
      },
      create(context) {
        const validPrefixes = [
          'get', 'set', 'fetch', 'save', 'load', 'create', 'update', 'delete', 'remove',
          'process', 'handle', 'execute', 'run', 'start', 'stop', 'init', 'cleanup',
          'validate', 'check', 'verify', 'send', 'receive', 'subscribe', 'unsubscribe'
        ];

        return {
          MethodDefinition(node) {
            if (node.value.async && node.key.type === 'Identifier') {
              const methodName = node.key.name;
              const hasValidPrefix = validPrefixes.some(prefix =>
                methodName.startsWith(prefix) ||
                methodName.startsWith(`_${prefix}`) // private methods
              );

              if (!hasValidPrefix && !methodName.startsWith('on')) { // Allow onXxx for event handlers
                context.report({
                  node: node.key,
                  messageId: 'verbFirst',
                  data: { name: methodName }
                });
              }
            }
          }
        };
      }
    },

    /**
     * Prevent direct database access in services
     */
    'no-direct-db-access': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Prevent direct database access in service layer',
          category: 'Architecture',
          recommended: true
        },
        fixable: null,
        schema: [],
        messages: {
          useRepository: 'Direct database access detected. Use a repository instead.'
        }
      },
      create(context) {
        const dbKeywords = ['query', 'insert', 'update', 'delete', 'select', 'raw', 'knex', 'sequelize', 'mongoose'];

        return {
          MemberExpression(node) {
            const filename = context.getFilename();

            // Only check service files
            if (!filename.includes('service') && !filename.includes('Service')) {
              return;
            }

            // Skip repository files
            if (filename.includes('repository') || filename.includes('Repository')) {
              return;
            }

            if (node.property.type === 'Identifier') {
              const propertyName = node.property.name.toLowerCase();

              if (dbKeywords.some(keyword => propertyName.includes(keyword))) {
                // Check if it's a database object
                if (node.object.type === 'Identifier') {
                  const objectName = node.object.name.toLowerCase();
                  if (objectName === 'db' || objectName === 'database' || objectName === 'connection') {
                    context.report({
                      node,
                      messageId: 'useRepository'
                    });
                  }
                }
              }
            }
          }
        };
      }
    },

    /**
     * Enforce maximum file size
     */
    'max-file-lines': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Enforce maximum number of lines in a file',
          category: 'Stylistic Issues',
          recommended: true
        },
        fixable: null,
        schema: [{
          type: 'object',
          properties: {
            max: {
              type: 'number',
              default: 300
            },
            skipBlankLines: {
              type: 'boolean',
              default: true
            },
            skipComments: {
              type: 'boolean',
              default: true
            }
          },
          additionalProperties: false
        }],
        messages: {
          tooManyLines: 'File has {{actual}} lines, maximum allowed is {{max}}. Consider splitting into smaller modules.'
        }
      },
      create(context) {
        const options = context.options[0] || {};
        const maxLines = options.max || 300;
        const skipBlankLines = options.skipBlankLines !== false;
        const skipComments = options.skipComments !== false;

        return {
          Program(node) {
            const sourceCode = context.getSourceCode();
            let lines = sourceCode.lines;

            if (skipBlankLines) {
              lines = lines.filter(line => line.trim().length > 0);
            }

            if (skipComments) {
              // Simple comment detection (not perfect but good enough)
              lines = lines.filter(line => {
                const trimmed = line.trim();
                return !trimmed.startsWith('//') &&
                  !trimmed.startsWith('/*') &&
                  !trimmed.startsWith('*');
              });
            }

            if (lines.length > maxLines) {
              context.report({
                node,
                messageId: 'tooManyLines',
                data: {
                  actual: lines.length,
                  max: maxLines
                }
              });
            }
          }
        };
      }
    }
  }
};

// Export a configuration that uses these rules
module.exports.configs = {
  recommended: {
    plugins: ['@company'],
    rules: {
      '@company/no-wrapper-pattern': 'error',
      '@company/use-app-error': 'error',
      '@company/no-duplicate-enum-values': 'error',
      '@company/service-must-extend-base': 'error',
      '@company/async-method-naming': 'warn',
      '@company/no-direct-db-access': 'error',
      '@company/max-file-lines': ['warn', { max: 300 }]
    }
  }
};
