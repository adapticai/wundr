/**
 * @wundr/prompt-templates - Reusable macro library for prompt templating
 */

import type { MacroDefinition } from './types.js';

/**
 * System role macro - defines AI assistant behavior
 */
export const systemRoleMacro: MacroDefinition = {
  name: 'systemRole',
  description: 'Define the AI assistant role and behavior',
  template: `You are {{role}}{{#ifDefined expertise}}, specialized in {{expertise}}{{/ifDefined}}.

{{#ifDefined personality}}
Your personality traits:
{{bulletList personality}}
{{/ifDefined}}

{{#ifDefined constraints}}
You must follow these constraints:
{{bulletList constraints}}
{{/ifDefined}}`,
  parameters: [
    {
      name: 'role',
      description: 'The role of the AI assistant',
      type: 'string',
      required: true,
    },
    {
      name: 'expertise',
      description: 'Areas of expertise',
      type: 'string',
      required: false,
    },
    {
      name: 'personality',
      description: 'Personality traits',
      type: 'array',
      required: false,
    },
    {
      name: 'constraints',
      description: 'Behavioral constraints',
      type: 'array',
      required: false,
    },
  ],
  example:
    '{{> systemRole role="a helpful assistant" expertise="software development" personality=(array "friendly" "concise") }}',
};

/**
 * Task context macro - provides context for a specific task
 */
export const taskContextMacro: MacroDefinition = {
  name: 'taskContext',
  description: 'Provide context for a specific task',
  template: `## Task: {{taskName}}

{{#ifDefined description}}
### Description
{{description}}
{{/ifDefined}}

{{#ifDefined objectives}}
### Objectives
{{numberedList objectives}}
{{/ifDefined}}

{{#ifDefined constraints}}
### Constraints
{{bulletList constraints}}
{{/ifDefined}}

{{#ifDefined examples}}
### Examples
{{#each examples}}
**Example {{@index}}:**
{{#codeBlock language}}
{{code}}
{{/codeBlock}}
{{/each}}
{{/ifDefined}}`,
  parameters: [
    {
      name: 'taskName',
      description: 'Name of the task',
      type: 'string',
      required: true,
    },
    {
      name: 'description',
      description: 'Task description',
      type: 'string',
      required: false,
    },
    {
      name: 'objectives',
      description: 'List of objectives',
      type: 'array',
      required: false,
    },
    {
      name: 'constraints',
      description: 'Task constraints',
      type: 'array',
      required: false,
    },
    {
      name: 'examples',
      description: 'Example inputs/outputs',
      type: 'array',
      required: false,
    },
  ],
  example:
    '{{> taskContext taskName="Code Review" objectives=(array "Find bugs" "Suggest improvements") }}',
};

/**
 * Output format macro - specifies expected output format
 */
export const outputFormatMacro: MacroDefinition = {
  name: 'outputFormat',
  description: 'Specify the expected output format',
  template: `## Output Format

{{#compare format "eq" "json"}}
Respond with valid JSON in the following structure:
{{#codeBlock "json"}}
{{schema}}
{{/codeBlock}}
{{/compare}}

{{#compare format "eq" "markdown"}}
Respond in Markdown format with the following sections:
{{bulletList sections}}
{{/compare}}

{{#compare format "eq" "structured"}}
Respond with the following structure:
{{#each fields}}
- **{{name}}**: {{description}}{{#ifDefined required}} (required){{/ifDefined}}
{{/each}}
{{/compare}}

{{#compare format "eq" "freeform"}}
Respond in natural language.
{{/compare}}

{{#ifDefined example}}
### Example Output
{{#codeBlock language}}
{{example}}
{{/codeBlock}}
{{/ifDefined}}`,
  parameters: [
    {
      name: 'format',
      description: 'Output format type (json, markdown, structured, freeform)',
      type: 'string',
      required: true,
    },
    {
      name: 'schema',
      description: 'JSON schema for json format',
      type: 'string',
      required: false,
    },
    {
      name: 'sections',
      description: 'Section names for markdown format',
      type: 'array',
      required: false,
    },
    {
      name: 'fields',
      description: 'Field definitions for structured format',
      type: 'array',
      required: false,
    },
    {
      name: 'example',
      description: 'Example output',
      type: 'string',
      required: false,
    },
    {
      name: 'language',
      description: 'Code block language for example',
      type: 'string',
      required: false,
      default: '',
    },
  ],
  example:
    '{{> outputFormat format="json" schema=\'{"result": "string", "confidence": "number"}\' }}',
};

/**
 * Conversation history macro - formats previous messages
 */
export const conversationHistoryMacro: MacroDefinition = {
  name: 'conversationHistory',
  description: 'Include formatted conversation history',
  template: `{{#ifDefined messages}}
## Conversation History

{{formatMemory messages max=maxMessages format=format}}
{{/ifDefined}}`,
  parameters: [
    {
      name: 'messages',
      description: 'Array of conversation messages',
      type: 'array',
      required: true,
    },
    {
      name: 'maxMessages',
      description: 'Maximum number of messages to include',
      type: 'number',
      required: false,
      default: 10,
    },
    {
      name: 'format',
      description: 'Output format (default, compact, xml)',
      type: 'string',
      required: false,
      default: 'default',
    },
  ],
  example: '{{> conversationHistory messages=memory.messages maxMessages=5 }}',
};

/**
 * Tools section macro - formats available tools
 */
export const toolsSectionMacro: MacroDefinition = {
  name: 'toolsSection',
  description: 'Include available tools documentation',
  template: `{{#ifDefined tools}}
## Available Tools

You have access to the following tools:

{{formatTools tools format=format}}

{{#ifDefined instructions}}
### Tool Usage Instructions
{{instructions}}
{{/ifDefined}}
{{/ifDefined}}`,
  parameters: [
    {
      name: 'tools',
      description: 'Array of tool definitions',
      type: 'array',
      required: true,
    },
    {
      name: 'format',
      description: 'Tool format (default, compact, json)',
      type: 'string',
      required: false,
      default: 'default',
    },
    {
      name: 'instructions',
      description: 'Additional tool usage instructions',
      type: 'string',
      required: false,
    },
  ],
  example: '{{> toolsSection tools=tools format="compact" }}',
};

/**
 * Code context macro - provides code snippet context
 */
export const codeContextMacro: MacroDefinition = {
  name: 'codeContext',
  description: 'Provide code context for analysis or generation',
  template: `## Code Context

{{#ifDefined filename}}
**File:** \`{{filename}}\`
{{/ifDefined}}

{{#ifDefined language}}
**Language:** {{language}}
{{/ifDefined}}

{{#codeBlock language}}
{{code}}
{{/codeBlock}}

{{#ifDefined lineNumbers}}
**Lines:** {{lineNumbers.start}} - {{lineNumbers.end}}
{{/ifDefined}}

{{#ifDefined relatedFiles}}
### Related Files
{{bulletList relatedFiles}}
{{/ifDefined}}`,
  parameters: [
    {
      name: 'code',
      description: 'The code snippet',
      type: 'string',
      required: true,
    },
    {
      name: 'language',
      description: 'Programming language',
      type: 'string',
      required: false,
    },
    {
      name: 'filename',
      description: 'Source filename',
      type: 'string',
      required: false,
    },
    {
      name: 'lineNumbers',
      description: 'Line number range',
      type: 'object',
      required: false,
    },
    {
      name: 'relatedFiles',
      description: 'List of related files',
      type: 'array',
      required: false,
    },
  ],
  example:
    '{{> codeContext code=sourceCode language="typescript" filename="index.ts" }}',
};

/**
 * Chain of thought macro - encourages step-by-step reasoning
 */
export const chainOfThoughtMacro: MacroDefinition = {
  name: 'chainOfThought',
  description: 'Encourage step-by-step reasoning',
  template: `## Reasoning Instructions

Think through this problem step by step:

{{#ifDefined steps}}
{{numberedList steps}}
{{else}}
1. First, understand the problem/request completely
2. Break down the problem into smaller parts
3. Consider different approaches
4. Evaluate the pros and cons of each approach
5. Select the best approach and implement it
6. Verify your solution
{{/ifDefined}}

{{#ifDefined showThinking}}
Please show your reasoning process before providing the final answer.
{{/ifDefined}}`,
  parameters: [
    {
      name: 'steps',
      description: 'Custom reasoning steps',
      type: 'array',
      required: false,
    },
    {
      name: 'showThinking',
      description: 'Whether to show reasoning process',
      type: 'boolean',
      required: false,
      default: true,
    },
  ],
  example: '{{> chainOfThought showThinking=true }}',
};

/**
 * Few-shot examples macro - provides learning examples
 */
export const fewShotExamplesMacro: MacroDefinition = {
  name: 'fewShotExamples',
  description: 'Provide few-shot learning examples',
  template: `## Examples

Here are some examples to guide your response:

{{#each examples}}
### Example {{add @index 1}}

**Input:**
{{#codeBlock inputLanguage}}
{{input}}
{{/codeBlock}}

**Output:**
{{#codeBlock outputLanguage}}
{{output}}
{{/codeBlock}}

{{#ifDefined explanation}}
**Explanation:** {{explanation}}
{{/ifDefined}}

---
{{/each}}`,
  parameters: [
    {
      name: 'examples',
      description: 'Array of input/output examples',
      type: 'array',
      required: true,
    },
    {
      name: 'inputLanguage',
      description: 'Language for input code blocks',
      type: 'string',
      required: false,
      default: '',
    },
    {
      name: 'outputLanguage',
      description: 'Language for output code blocks',
      type: 'string',
      required: false,
      default: '',
    },
  ],
  example:
    '{{> fewShotExamples examples=examples inputLanguage="text" outputLanguage="json" }}',
};

/**
 * Safety guardrails macro - adds safety constraints
 */
export const safetyGuardrailsMacro: MacroDefinition = {
  name: 'safetyGuardrails',
  description: 'Add safety constraints and guardrails',
  template: `## Safety Guidelines

{{#ifDefined level}}
**Safety Level:** {{uppercase level}}
{{/ifDefined}}

You must adhere to these safety guidelines:

{{#ifDefined allowed}}
### Allowed Actions
{{bulletList allowed}}
{{/ifDefined}}

{{#ifDefined prohibited}}
### Prohibited Actions
{{bulletList prohibited}}
{{/ifDefined}}

{{#ifDefined responseGuidelines}}
### Response Guidelines
{{bulletList responseGuidelines}}
{{/ifDefined}}

{{#compare level "eq" "strict"}}
If a request violates any guideline, politely decline and explain why.
{{/compare}}`,
  parameters: [
    {
      name: 'level',
      description: 'Safety level (strict, moderate, relaxed)',
      type: 'string',
      required: false,
      default: 'moderate',
    },
    {
      name: 'allowed',
      description: 'List of allowed actions',
      type: 'array',
      required: false,
    },
    {
      name: 'prohibited',
      description: 'List of prohibited actions',
      type: 'array',
      required: false,
    },
    {
      name: 'responseGuidelines',
      description: 'Guidelines for responses',
      type: 'array',
      required: false,
    },
  ],
  example:
    '{{> safetyGuardrails level="strict" prohibited=(array "Generate harmful content" "Share personal data") }}',
};

/**
 * Persona definition macro - creates a detailed persona
 */
export const personaMacro: MacroDefinition = {
  name: 'persona',
  description: 'Define a detailed AI persona',
  template: `# Persona: {{name}}

{{#ifDefined tagline}}
*{{tagline}}*
{{/ifDefined}}

## About
{{description}}

{{#ifDefined background}}
## Background
{{background}}
{{/ifDefined}}

{{#ifDefined skills}}
## Skills & Expertise
{{bulletList skills}}
{{/ifDefined}}

{{#ifDefined communication}}
## Communication Style
{{bulletList communication}}
{{/ifDefined}}

{{#ifDefined knowledge}}
## Knowledge Base
{{bulletList knowledge}}
{{/ifDefined}}

{{#ifDefined limitations}}
## Limitations
{{bulletList limitations}}
{{/ifDefined}}`,
  parameters: [
    {
      name: 'name',
      description: 'Persona name',
      type: 'string',
      required: true,
    },
    {
      name: 'description',
      description: 'Short description',
      type: 'string',
      required: true,
    },
    {
      name: 'tagline',
      description: 'Persona tagline',
      type: 'string',
      required: false,
    },
    {
      name: 'background',
      description: 'Background information',
      type: 'string',
      required: false,
    },
    {
      name: 'skills',
      description: 'List of skills',
      type: 'array',
      required: false,
    },
    {
      name: 'communication',
      description: 'Communication style traits',
      type: 'array',
      required: false,
    },
    {
      name: 'knowledge',
      description: 'Knowledge domains',
      type: 'array',
      required: false,
    },
    {
      name: 'limitations',
      description: 'Known limitations',
      type: 'array',
      required: false,
    },
  ],
  example:
    '{{> persona name="CodeBot" description="A helpful coding assistant" skills=(array "JavaScript" "Python" "TypeScript") }}',
};

/**
 * Get all built-in macro definitions
 *
 * @returns Array of macro definitions
 */
export function getBuiltinMacros(): MacroDefinition[] {
  return [
    systemRoleMacro,
    taskContextMacro,
    outputFormatMacro,
    conversationHistoryMacro,
    toolsSectionMacro,
    codeContextMacro,
    chainOfThoughtMacro,
    fewShotExamplesMacro,
    safetyGuardrailsMacro,
    personaMacro,
  ];
}

/**
 * Get a macro by name
 *
 * @param name - Macro name
 * @returns Macro definition or undefined
 */
export function getMacroByName(name: string): MacroDefinition | undefined {
  const macros = getBuiltinMacros();
  return macros.find(macro => macro.name === name);
}

/**
 * Get macro names
 *
 * @returns Array of macro names
 */
export function getMacroNames(): string[] {
  return getBuiltinMacros().map(macro => macro.name);
}
