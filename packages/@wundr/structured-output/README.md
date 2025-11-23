# @wundr.io/structured-output

Pydantic/Instructor-style LLM output validation with retry loops and grammar enforcement for TypeScript.

## Overview

`@wundr.io/structured-output` provides a robust framework for generating validated, structured output from Large Language Models (LLMs). It combines Zod schema validation with intelligent retry strategies and grammar enforcement to ensure LLM responses conform to your expected data structures.

### Key Features

- **Zod Schema Integration**: Define output structures using Zod schemas with full TypeScript type inference
- **Intelligent Retry Strategies**: Multiple retry strategies with error feedback loops
- **Grammar Enforcement**: JSON Schema, Regex, PEG, and Context-Free Grammar enforcement methods
- **Streaming Support**: Parse partial results as they arrive from streaming LLM responses
- **Provider Agnostic**: Works with any LLM provider (OpenAI, Anthropic, local models, etc.)
- **Type Safety**: Full TypeScript support with automatic type inference from schemas

## Installation

```bash
npm install @wundr.io/structured-output
# or
yarn add @wundr.io/structured-output
# or
pnpm add @wundr.io/structured-output
```

## Quick Start

```typescript
import { createInstructor, z } from '@wundr.io/structured-output';

// Create an instructor instance
const instructor = createInstructor({
  model: 'gpt-4',
  maxRetries: 3,
  retryStrategy: 'adaptive',
});

// Define your output schema
const UserSchema = z.object({
  name: z.string().describe('The user full name'),
  age: z.number().describe('The user age in years'),
  email: z.string().email().describe('The user email address'),
});

// Set your LLM provider
instructor.setLLMProvider(async (prompt, systemPrompt, config) => {
  // Integrate with your LLM of choice (OpenAI, Anthropic, etc.)
  const response = await yourLLMClient.chat({
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    temperature: config.temperature,
  });

  return {
    content: response.content,
    model: config.model,
    usage: response.usage,
  };
});

// Generate structured output
const result = await instructor.generate({
  schema: UserSchema,
  prompt: 'Extract user info: John Doe, 30 years old, john@example.com',
});

if (result.success) {
  console.log(result.data);
  // { name: 'John Doe', age: 30, email: 'john@example.com' }
  // TypeScript knows this is: { name: string; age: number; email: string }
}
```

## Core Concepts

### The Instructor Pattern

The package implements the "Instructor" pattern, popularized by Python's Pydantic/Instructor library:

1. **Define a schema** describing the expected output structure
2. **Generate prompts** that include schema information for the LLM
3. **Validate responses** against the schema
4. **Retry with feedback** if validation fails

### Schema-Driven Generation

Schemas are the foundation of structured output generation. They define:

- The shape of expected data
- Field types and constraints
- Validation rules
- Documentation for the LLM

## Zod Schema Integration

### Basic Schema Definition

```typescript
import { z } from '@wundr.io/structured-output';

// Simple object schema
const PersonSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  age: z.number().int().positive(),
  isActive: z.boolean().optional(),
});

// Nested objects
const CompanySchema = z.object({
  name: z.string(),
  employees: z.array(PersonSchema),
  headquarters: z.object({
    city: z.string(),
    country: z.string(),
  }),
});

// Enums and unions
const StatusSchema = z.enum(['pending', 'active', 'completed']);

const ResponseSchema = z.object({
  status: StatusSchema,
  data: z.union([
    z.object({ type: z.literal('user'), user: PersonSchema }),
    z.object({ type: z.literal('error'), message: z.string() }),
  ]),
});
```

### Schema Descriptions

Add descriptions to help the LLM understand field semantics:

```typescript
const ProductSchema = z.object({
  name: z.string().describe('Product name, max 100 characters'),
  price: z.number().positive().describe('Price in USD, excluding tax'),
  category: z.enum(['electronics', 'clothing', 'food'])
    .describe('Primary product category'),
  tags: z.array(z.string()).max(5)
    .describe('Up to 5 relevant tags for search'),
});
```

### Schema Utilities

The package provides utility functions for schema manipulation:

```typescript
import {
  createObjectSchema,
  makePartial,
  makeRequired,
  pickFields,
  omitFields,
  extendSchema,
  mergeSchemas,
  toJsonSchema,
  generateSchemaPrompt,
  introspectSchema,
  getRequiredFields,
  getOptionalFields,
} from '@wundr.io/structured-output';

// Create schema with description
const schema = createObjectSchema({
  id: z.string(),
  name: z.string(),
}, { description: 'User entity' });

// Make all fields optional
const partialSchema = makePartial(schema);

// Pick specific fields
const nameOnlySchema = pickFields(schema, ['name']);

// Extend with new fields
const extendedSchema = extendSchema(schema, {
  email: z.string().email(),
});

// Convert to JSON Schema
const jsonSchema = toJsonSchema(schema);

// Generate prompt-friendly description
const promptDescription = generateSchemaPrompt(schema, 'User');

// Introspect schema structure
const metadata = introspectSchema(schema);

// Get field lists
const required = getRequiredFields(schema); // ['id', 'name']
const optional = getOptionalFields(schema); // []
```

## Retry Strategies

When validation fails, the instructor can retry with different strategies:

### Available Strategies

| Strategy | Description | Best For |
|----------|-------------|----------|
| `simple` | Fixed delay between retries | Basic use cases |
| `exponential-backoff` | Increasing delays between retries | Rate-limited APIs |
| `adaptive` | Adjusts based on error patterns | Complex validations |
| `error-targeted` | Focuses retry prompts on specific errors | Precision fixes |
| `schema-guided` | Uses schema info for detailed guidance | Schema-heavy outputs |

### Configuration

```typescript
const instructor = createInstructor({
  maxRetries: 5,
  retryStrategy: 'adaptive',
  includeErrorFeedback: true,
  onRetry: (attempt, errors, rawResponse) => {
    console.log(`Retry ${attempt}:`, errors);
  },
  onValidationError: (errors, rawResponse) => {
    console.log('Validation failed:', errors);
  },
});
```

### Custom Retry Logic

```typescript
import {
  createRetryStrategy,
  executeWithRetry,
  AdaptiveRetryStrategy,
} from '@wundr.io/structured-output';

// Use built-in strategies
const strategy = createRetryStrategy('adaptive');

// Execute any function with retry
const result = await executeWithRetry(
  async () => fetchData(),
  strategy,
  {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    jitter: true,
    strategy: 'adaptive',
  },
  (context) => console.log(`Attempt ${context.attemptNumber}`)
);
```

### Retry Strategy Details

#### Simple Strategy
```typescript
// Fixed delay, straightforward retries
const instructor = createInstructor({
  retryStrategy: 'simple',
  maxRetries: 3,
});
```

#### Exponential Backoff
```typescript
// Delays: 1s -> 2s -> 4s -> 8s (capped at maxDelayMs)
const instructor = createInstructor({
  retryStrategy: 'exponential-backoff',
  maxRetries: 5,
});
```

#### Adaptive Strategy
```typescript
// Analyzes error types and adjusts prompts accordingly
// - Type errors: Adds type-specific guidance
// - Missing fields: Emphasizes required fields
// - Format errors: Highlights format requirements
const instructor = createInstructor({
  retryStrategy: 'adaptive',
  includeErrorFeedback: true,
});
```

#### Error-Targeted Strategy
```typescript
// Groups errors by field path and provides focused feedback
const instructor = createInstructor({
  retryStrategy: 'error-targeted',
});
```

#### Schema-Guided Strategy
```typescript
// Progressive detail: more schema info on each retry
const instructor = createInstructor({
  retryStrategy: 'schema-guided',
});
```

## Grammar Enforcement

Grammar enforcement ensures LLM outputs conform to structural rules before Zod validation.

### Enforcement Methods

| Method | Description | Use Case |
|--------|-------------|----------|
| `json-schema` | JSON Schema validation | Default, most cases |
| `regex` | Regex pattern matching | String formats |
| `peg-grammar` | Parsing Expression Grammar | Complex structures |
| `context-free-grammar` | CFG parsing | Formal language validation |
| `none` | Skip grammar enforcement | Trust LLM output |

### Configuration

```typescript
const instructor = createInstructor({
  grammarEnforcement: {
    method: 'json-schema',
    strict: true,
    allowPartialMatches: false,
  },
});
```

### Using Grammar Enforcers Directly

```typescript
import {
  createGrammarEnforcer,
  JsonSchemaGrammarEnforcer,
  RegexGrammarEnforcer,
  PegGrammarEnforcer,
  CfgGrammarEnforcer,
} from '@wundr.io/structured-output';

// Create enforcer via factory
const enforcer = createGrammarEnforcer('json-schema');

// Or instantiate directly
const regexEnforcer = new RegexGrammarEnforcer({
  method: 'regex',
  strict: true,
  customGrammar: '^[a-z]+@[a-z]+\\.[a-z]+$', // Email pattern
  allowPartialMatches: false,
});

// Add custom patterns to regex enforcer
regexEnforcer.addPattern('phone', /^\+?[\d\s-()]{10,}$/);
regexEnforcer.addPattern('slug', /^[a-z0-9]+(-[a-z0-9]+)*$/);

// Enforce grammar on input
const result = enforcer.enforce(llmOutput, schema);
if (result.valid) {
  console.log('Valid:', result.data);
} else {
  console.log('Errors:', result.errors);
}

// Generate constraints for the LLM
const constraints = enforcer.generateConstraints(schema);
```

### Custom PEG Grammar

```typescript
const pegEnforcer = new PegGrammarEnforcer({
  customGrammar: `
    # Custom PEG grammar
    Start <- ws Value ws
    Value <- Object
    Object <- "{" ws MemberList? ws "}"
    MemberList <- Member ("," ws Member)*
    Member <- String ws ":" ws Value
  `,
});
```

### Custom CFG Grammar

```typescript
const cfgEnforcer = new CfgGrammarEnforcer({
  customGrammar: `
    # Context-free grammar for JSON
    S -> VALUE
    VALUE -> OBJECT | ARRAY | STRING | NUMBER | BOOL | NULL
    OBJECT -> "{" MEMBERS "}" | "{" "}"
    MEMBERS -> PAIR | PAIR "," MEMBERS
    PAIR -> STRING ":" VALUE
  `,
});
```

## Output Parsing Strategies

### Direct Generation

```typescript
const result = await instructor.generate({
  schema: UserSchema,
  prompt: 'Extract user information from: ...',
});

if (result.success) {
  // result.data is fully typed
  console.log(result.data.name);
}
```

### Validation Without LLM

```typescript
// Validate existing data against a schema
const validation = instructor.validate(jsonString, UserSchema);

if (validation.success) {
  console.log('Valid:', validation.data);
} else {
  console.log('Errors:', validation.errors);
}
```

### JSON Extraction

```typescript
import {
  extractJson,
  parseJsonWithSchema,
  parseWithCoercion,
  safeParse,
} from '@wundr.io/structured-output';

// Extract JSON from text that may contain other content
const json = extractJson('Some text {"name": "John"} more text');
// { name: "John" }

// Parse and validate in one step
const user = parseJsonWithSchema(UserSchema, llmResponse);

// Parse with automatic coercion (string -> JSON)
const data = parseWithCoercion(UserSchema, '{"name": "John"}');

// Safe parsing with detailed errors
const result = safeParse(UserSchema, data);
if (result.success) {
  console.log(result.data);
} else {
  console.log(result.errors); // [{ path: 'name', message: '...' }]
}
```

## Streaming Support

Parse partial results as they stream from the LLM:

```typescript
// Set streaming provider
instructor.setStreamingProvider(async function* (prompt, systemPrompt, config) {
  const stream = await yourLLMClient.streamChat({
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
  });

  let accumulated = '';
  for await (const chunk of stream) {
    accumulated += chunk.content;
    yield {
      delta: chunk.content,
      accumulated,
      isFinal: chunk.finish_reason === 'stop',
    };
  }
});

// Stream with partial result callbacks
const result = await instructor.streamPartial({
  schema: UserSchema,
  prompt: 'Extract user info...',
  onPartial: (partial) => {
    console.log('Partial:', partial.partial);
    console.log('Confidence:', partial.confidence);
    console.log('Complete:', partial.isComplete);
  },
  onComplete: (result) => {
    console.log('Final:', result.data);
  },
  onError: (error) => {
    console.error('Error:', error);
  },
});
```

## Error Handling and Recovery

### Error Types

```typescript
import {
  StructuredOutputError,
  MaxRetriesExceededError,
  TimeoutError,
} from '@wundr.io/structured-output';

try {
  const result = await instructor.generate({
    schema: UserSchema,
    prompt: 'Extract user...',
  });
} catch (error) {
  if (error instanceof MaxRetriesExceededError) {
    console.log('Attempts:', error.attempts);
    console.log('Last errors:', error.lastErrors);
    console.log('Raw responses:', error.rawResponses);
  } else if (error instanceof TimeoutError) {
    console.log('Timeout:', error.timeoutMs);
    console.log('Elapsed:', error.elapsedMs);
  } else if (error instanceof StructuredOutputError) {
    console.log('Code:', error.code);
    console.log('Details:', error.details);
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_FAILED` | Schema validation failed |
| `MAX_RETRIES_EXCEEDED` | All retry attempts exhausted |
| `TIMEOUT` | Request exceeded timeout |
| `LLM_ERROR` | LLM provider returned an error |
| `GRAMMAR_ENFORCEMENT_FAILED` | Grammar validation failed |
| `SCHEMA_ERROR` | Invalid schema configuration |
| `PARSE_ERROR` | JSON parsing failed |
| `CONFIGURATION_ERROR` | Invalid instructor configuration |

### Validation Result Structure

```typescript
interface ValidationResult<T> {
  success: boolean;
  data?: T;                    // Present if success is true
  errors?: ValidationError[];  // Present if success is false
  rawResponse?: string;        // Original LLM response
  retryCount: number;          // Number of retries attempted
  duration: number;            // Total time in milliseconds
  metadata: ValidationMetadata;
}

interface ValidationError {
  path: (string | number)[];   // Field path: ['user', 'address', 0]
  message: string;             // Human-readable error
  code: string;                // Error code from Zod
  expected?: string;           // Expected type/value
  received?: unknown;          // Actual value received
}
```

### Converting Zod Errors

```typescript
import { zodErrorToValidationErrors } from '@wundr.io/structured-output';

const result = schema.safeParse(data);
if (!result.success) {
  const errors = zodErrorToValidationErrors(result.error);
  // Normalized error format
}
```

## Type Inference

Full TypeScript support with automatic type inference:

```typescript
import { z, InferSchema, DeepPartial } from '@wundr.io/structured-output';

// Define schema
const UserSchema = z.object({
  id: z.string(),
  profile: z.object({
    name: z.string(),
    age: z.number(),
  }),
});

// Infer types automatically
type User = InferSchema<typeof UserSchema>;
// { id: string; profile: { name: string; age: number } }

// Deep partial type
type PartialUser = DeepPartial<User>;
// { id?: string; profile?: { name?: string; age?: number } }

// Type-safe generation
const result = await instructor.generate({
  schema: UserSchema,
  prompt: '...',
});

if (result.success) {
  // result.data is typed as User
  const user: User = result.data;
}
```

## Integration with LLM Providers

### OpenAI

```typescript
import OpenAI from 'openai';
import { createInstructor } from '@wundr.io/structured-output';

const openai = new OpenAI();
const instructor = createInstructor({ model: 'gpt-4' });

instructor.setLLMProvider(async (prompt, systemPrompt, config) => {
  const response = await openai.chat.completions.create({
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    temperature: config.temperature,
  });

  return {
    content: response.choices[0]?.message?.content ?? '',
    model: config.model,
    usage: {
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
      totalTokens: response.usage?.total_tokens ?? 0,
    },
  };
});
```

### Anthropic Claude

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { createInstructor } from '@wundr.io/structured-output';

const anthropic = new Anthropic();
const instructor = createInstructor({ model: 'claude-3-opus-20240229' });

instructor.setLLMProvider(async (prompt, systemPrompt, config) => {
  const response = await anthropic.messages.create({
    model: config.model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content[0];
  return {
    content: content?.type === 'text' ? content.text : '',
    model: config.model,
    usage: {
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
    },
  };
});
```

### Testing with Mock Providers

```typescript
import {
  createMockLLMProvider,
  createMockStreamingProvider,
} from '@wundr.io/structured-output';

// Static response
instructor.setLLMProvider(
  createMockLLMProvider('{"name": "John", "age": 30}')
);

// Multiple responses (round-robin)
instructor.setLLMProvider(
  createMockLLMProvider([
    '{"invalid": true}',           // First attempt fails
    '{"name": "John", "age": 30}', // Second attempt succeeds
  ])
);

// Dynamic response based on prompt
instructor.setLLMProvider(
  createMockLLMProvider((prompt) => {
    if (prompt.includes('error')) {
      return '{"error": "Something went wrong"}';
    }
    return '{"name": "John", "age": 30}';
  })
);

// Mock streaming
instructor.setStreamingProvider(
  createMockStreamingProvider('{"name": "John"}', 5) // 5 chars per chunk
);
```

## Advanced Configuration

### Full Configuration Options

```typescript
import { createInstructor, DEFAULT_INSTRUCTOR_CONFIG } from '@wundr.io/structured-output';

const instructor = createInstructor({
  // Retry configuration
  maxRetries: 3,
  retryStrategy: 'adaptive',
  includeErrorFeedback: true,

  // LLM configuration
  model: 'gpt-4',
  temperature: 0.7,
  timeout: 30000,
  streaming: false,

  // Custom prompts
  systemPromptPrefix: 'You are a data extraction assistant.',

  // Grammar enforcement
  grammarEnforcement: {
    method: 'json-schema',
    strict: true,
    allowPartialMatches: false,
  },

  // Callbacks
  onRetry: (attempt, errors, rawResponse) => {
    console.log(`Retry ${attempt}`);
  },
  onValidationError: (errors, rawResponse) => {
    console.error('Validation failed');
  },
});
```

### Generation Context

```typescript
const result = await instructor.generate({
  schema: UserSchema,
  prompt: 'Extract user from: {{text}}',
  systemPrompt: 'You are an expert data extractor.',
  config: {
    temperature: 0.5, // Override default
    maxRetries: 5,
  },
  context: {
    // Few-shot examples
    examples: [
      {
        input: 'John Smith, 25 years old',
        output: { name: 'John Smith', age: 25 },
      },
    ],
    // Additional instructions
    instructions: 'Be precise with ages. Round to nearest year.',
    // Variable interpolation
    variables: {
      text: 'Jane Doe, approximately thirty years old',
    },
  },
});
```

## API Reference

### Main Exports

| Export | Description |
|--------|-------------|
| `createInstructor` | Factory function to create instructor instances |
| `StructuredOutputGenerator` | Main class for structured output generation |
| `z` | Re-exported Zod for convenience |

### Schema Utilities

| Export | Description |
|--------|-------------|
| `toJsonSchema` | Convert Zod schema to JSON Schema |
| `generateSchemaPrompt` | Generate prompt-friendly schema description |
| `introspectSchema` | Extract metadata from schema |
| `createObjectSchema` | Create object schema with options |
| `makePartial` | Make all fields optional |
| `makeRequired` | Make all fields required |
| `pickFields` | Select specific fields |
| `omitFields` | Remove specific fields |
| `extendSchema` | Add fields to schema |
| `mergeSchemas` | Combine two schemas |
| `safeParse` | Parse with detailed errors |
| `parseWithCoercion` | Parse with automatic type coercion |
| `extractJson` | Extract JSON from text |
| `parseJsonWithSchema` | Parse and validate JSON |
| `getRequiredFields` | List required field names |
| `getOptionalFields` | List optional field names |

### Retry Strategies

| Export | Description |
|--------|-------------|
| `createRetryStrategy` | Factory for retry strategies |
| `SimpleRetryStrategy` | Fixed delay retry |
| `ExponentialBackoffRetryStrategy` | Exponential backoff |
| `AdaptiveRetryStrategy` | Error-pattern adaptive |
| `ErrorTargetedRetryStrategy` | Error-focused retry |
| `SchemaGuidedRetryStrategy` | Schema-aware retry |
| `executeWithRetry` | Generic retry executor |
| `sleep` | Promise-based delay |

### Grammar Enforcers

| Export | Description |
|--------|-------------|
| `createGrammarEnforcer` | Factory for grammar enforcers |
| `JsonSchemaGrammarEnforcer` | JSON Schema validation |
| `RegexGrammarEnforcer` | Regex pattern matching |
| `PegGrammarEnforcer` | PEG grammar enforcement |
| `CfgGrammarEnforcer` | Context-free grammar |

### Error Classes

| Export | Description |
|--------|-------------|
| `StructuredOutputError` | Base error class |
| `MaxRetriesExceededError` | All retries exhausted |
| `TimeoutError` | Request timeout |

### Types

| Export | Description |
|--------|-------------|
| `InstructorConfig` | Full configuration interface |
| `ValidationResult` | Generation result interface |
| `ValidationError` | Error details interface |
| `RetryStrategy` | Retry strategy interface |
| `GrammarEnforcer` | Grammar enforcer interface |
| `LLMProvider` | LLM provider function type |
| `StreamingLLMProvider` | Streaming provider type |
| `InferSchema` | Type inference utility |

## License

MIT

## Related Packages

- [@wundr.io/core](../core) - Core utilities and types
- [@wundr.io/prompt-engine](../prompt-engine) - Prompt templates and management
- [@wundr.io/llm-router](../llm-router) - Multi-provider LLM routing
