/**
 * AI Prompt Templates Library
 *
 * Built-in prompt templates with variable interpolation, categorization,
 * and template management features.
 *
 * @module lib/ai/prompt-templates
 */

export interface PromptVariable {
  name: string;
  description: string;
  required: boolean;
  defaultValue?: string;
  type: 'string' | 'number' | 'boolean' | 'array';
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
  variables: PromptVariable[];
  tags: string[];
  author?: string;
  authorId?: string;
  isPublic: boolean;
  isSystem: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
  starCount: number;
  workspaceId?: string;
}

export type PromptCategory =
  | 'writing'
  | 'coding'
  | 'analysis'
  | 'brainstorming'
  | 'documentation'
  | 'communication'
  | 'workflow'
  | 'research'
  | 'custom';

export const PROMPT_CATEGORIES: Record<
  PromptCategory,
  { label: string; icon: string; description: string }
> = {
  writing: {
    label: 'Writing',
    icon: '✍️',
    description: 'Content creation, editing, and writing assistance',
  },
  coding: {
    label: 'Coding',
    icon: '💻',
    description: 'Code generation, review, and technical assistance',
  },
  analysis: {
    label: 'Analysis',
    icon: '📊',
    description: 'Data analysis, insights, and reporting',
  },
  brainstorming: {
    label: 'Brainstorming',
    icon: '💡',
    description: 'Idea generation and creative thinking',
  },
  documentation: {
    label: 'Documentation',
    icon: '📝',
    description: 'Creating docs, guides, and technical writing',
  },
  communication: {
    label: 'Communication',
    icon: '💬',
    description: 'Messages, emails, and professional communication',
  },
  workflow: {
    label: 'Workflow',
    icon: '⚙️',
    description: 'Process automation and task management',
  },
  research: {
    label: 'Research',
    icon: '🔬',
    description: 'Research, investigation, and knowledge gathering',
  },
  custom: {
    label: 'Custom',
    icon: '🎯',
    description: 'User-created custom templates',
  },
};

/**
 * Built-in system prompt templates
 */
export const SYSTEM_TEMPLATES: Omit<
  PromptTemplate,
  'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'starCount'
>[] = [
  // Writing Templates
  {
    name: 'Content Summarizer',
    description: 'Summarize long-form content into concise key points',
    category: 'writing',
    content: `Please summarize the following content:

{{content}}

Provide a summary that:
- Captures the main ideas in {{max_points}} key points
- Uses {{tone}} tone
- Is approximately {{word_count}} words
- Maintains accuracy and context`,
    variables: [
      {
        name: 'content',
        description: 'Content to summarize',
        required: true,
        type: 'string',
      },
      {
        name: 'max_points',
        description: 'Maximum number of key points',
        required: false,
        defaultValue: '5',
        type: 'number',
      },
      {
        name: 'tone',
        description: 'Tone of the summary',
        required: false,
        defaultValue: 'professional',
        type: 'string',
      },
      {
        name: 'word_count',
        description: 'Target word count',
        required: false,
        defaultValue: '200',
        type: 'number',
      },
    ],
    tags: ['summary', 'content', 'writing'],
    isPublic: true,
    isSystem: true,
    version: 1,
  },
  {
    name: 'Blog Post Writer',
    description: 'Generate engaging blog posts on any topic',
    category: 'writing',
    content: `Write a compelling blog post about: {{topic}}

Requirements:
- Target audience: {{audience}}
- Tone: {{tone}}
- Length: {{length}} words
- Include: {{elements}}

The post should be engaging, well-structured with headings, and optimized for readability.`,
    variables: [
      {
        name: 'topic',
        description: 'Blog post topic',
        required: true,
        type: 'string',
      },
      {
        name: 'audience',
        description: 'Target audience',
        required: false,
        defaultValue: 'general readers',
        type: 'string',
      },
      {
        name: 'tone',
        description: 'Writing tone',
        required: false,
        defaultValue: 'conversational',
        type: 'string',
      },
      {
        name: 'length',
        description: 'Word count',
        required: false,
        defaultValue: '800',
        type: 'number',
      },
      {
        name: 'elements',
        description: 'Special elements to include',
        required: false,
        defaultValue: 'examples, statistics',
        type: 'string',
      },
    ],
    tags: ['blog', 'writing', 'content creation'],
    isPublic: true,
    isSystem: true,
    version: 1,
  },

  // Coding Templates
  {
    name: 'Code Reviewer',
    description: 'Review code for best practices, bugs, and improvements',
    category: 'coding',
    content: `Please review the following {{language}} code:

\`\`\`{{language}}
{{code}}
\`\`\`

Focus on:
- {{focus_areas}}
- Code quality and best practices
- Potential bugs or security issues
- Performance optimizations
- Readability and maintainability

Provide specific, actionable feedback.`,
    variables: [
      {
        name: 'code',
        description: 'Code to review',
        required: true,
        type: 'string',
      },
      {
        name: 'language',
        description: 'Programming language',
        required: true,
        type: 'string',
      },
      {
        name: 'focus_areas',
        description: 'Specific areas to focus on',
        required: false,
        defaultValue: 'all aspects',
        type: 'string',
      },
    ],
    tags: ['code review', 'coding', 'quality'],
    isPublic: true,
    isSystem: true,
    version: 1,
  },
  {
    name: 'API Documentation Generator',
    description: 'Generate comprehensive API documentation',
    category: 'coding',
    content: `Generate API documentation for the following endpoint:

Method: {{method}}
Endpoint: {{endpoint}}
Description: {{description}}

Code:
\`\`\`{{language}}
{{code}}
\`\`\`

Include:
- Clear description
- Parameters with types and descriptions
- Request/response examples
- Possible error codes
- Usage notes`,
    variables: [
      {
        name: 'method',
        description: 'HTTP method',
        required: true,
        type: 'string',
      },
      {
        name: 'endpoint',
        description: 'API endpoint path',
        required: true,
        type: 'string',
      },
      {
        name: 'description',
        description: 'Brief endpoint description',
        required: true,
        type: 'string',
      },
      {
        name: 'code',
        description: 'Endpoint implementation code',
        required: true,
        type: 'string',
      },
      {
        name: 'language',
        description: 'Programming language',
        required: false,
        defaultValue: 'typescript',
        type: 'string',
      },
    ],
    tags: ['api', 'documentation', 'coding'],
    isPublic: true,
    isSystem: true,
    version: 1,
  },

  // Analysis Templates
  {
    name: 'Data Analyzer',
    description: 'Analyze data and provide insights',
    category: 'analysis',
    content: `Analyze the following data:

{{data}}

Analysis requirements:
- Type of analysis: {{analysis_type}}
- Focus on: {{focus_areas}}
- Output format: {{output_format}}

Provide:
1. Key findings and insights
2. Trends and patterns
3. Anomalies or outliers
4. Recommendations based on the data`,
    variables: [
      {
        name: 'data',
        description: 'Data to analyze',
        required: true,
        type: 'string',
      },
      {
        name: 'analysis_type',
        description: 'Type of analysis needed',
        required: false,
        defaultValue: 'general',
        type: 'string',
      },
      {
        name: 'focus_areas',
        description: 'Specific areas to focus on',
        required: false,
        defaultValue: 'all aspects',
        type: 'string',
      },
      {
        name: 'output_format',
        description: 'Desired output format',
        required: false,
        defaultValue: 'bullet points',
        type: 'string',
      },
    ],
    tags: ['analysis', 'data', 'insights'],
    isPublic: true,
    isSystem: true,
    version: 1,
  },

  // Brainstorming Templates
  {
    name: 'Idea Generator',
    description: 'Generate creative ideas for any topic or challenge',
    category: 'brainstorming',
    content: `Help me brainstorm ideas for: {{topic}}

Context: {{context}}

Generate {{count}} creative ideas that:
- Are {{approach}} and innovative
- Consider {{constraints}}
- Target: {{target}}

For each idea, provide:
1. Brief description
2. Key benefits
3. Potential challenges
4. Next steps`,
    variables: [
      {
        name: 'topic',
        description: 'Topic or challenge',
        required: true,
        type: 'string',
      },
      {
        name: 'context',
        description: 'Additional context',
        required: false,
        defaultValue: '',
        type: 'string',
      },
      {
        name: 'count',
        description: 'Number of ideas',
        required: false,
        defaultValue: '10',
        type: 'number',
      },
      {
        name: 'approach',
        description: 'Approach style',
        required: false,
        defaultValue: 'practical',
        type: 'string',
      },
      {
        name: 'constraints',
        description: 'Constraints to consider',
        required: false,
        defaultValue: 'none specified',
        type: 'string',
      },
      {
        name: 'target',
        description: 'Target audience or use case',
        required: false,
        defaultValue: 'general',
        type: 'string',
      },
    ],
    tags: ['brainstorming', 'ideas', 'creativity'],
    isPublic: true,
    isSystem: true,
    version: 1,
  },

  // Communication Templates
  {
    name: 'Professional Email',
    description: 'Compose professional emails for any situation',
    category: 'communication',
    content: `Compose a professional email:

Purpose: {{purpose}}
Recipient: {{recipient}}
Tone: {{tone}}
Key points: {{key_points}}

The email should be:
- Professional and {{tone}}
- Clear and concise
- Action-oriented
- Appropriately formatted`,
    variables: [
      {
        name: 'purpose',
        description: 'Purpose of the email',
        required: true,
        type: 'string',
      },
      {
        name: 'recipient',
        description: 'Who will receive this',
        required: true,
        type: 'string',
      },
      {
        name: 'tone',
        description: 'Tone of the email',
        required: false,
        defaultValue: 'formal',
        type: 'string',
      },
      {
        name: 'key_points',
        description: 'Key points to include',
        required: false,
        defaultValue: '',
        type: 'string',
      },
    ],
    tags: ['email', 'communication', 'professional'],
    isPublic: true,
    isSystem: true,
    version: 1,
  },

  // Documentation Templates
  {
    name: 'README Generator',
    description: 'Generate comprehensive README files for projects',
    category: 'documentation',
    content: `Create a README.md file for: {{project_name}}

Project details:
- Description: {{description}}
- Type: {{project_type}}
- Tech stack: {{tech_stack}}
- Target users: {{target_users}}

Include:
- Project overview
- Installation instructions
- Usage examples
- API documentation (if applicable)
- Contributing guidelines
- License information`,
    variables: [
      {
        name: 'project_name',
        description: 'Project name',
        required: true,
        type: 'string',
      },
      {
        name: 'description',
        description: 'Project description',
        required: true,
        type: 'string',
      },
      {
        name: 'project_type',
        description: 'Type of project',
        required: false,
        defaultValue: 'application',
        type: 'string',
      },
      {
        name: 'tech_stack',
        description: 'Technologies used',
        required: false,
        defaultValue: '',
        type: 'string',
      },
      {
        name: 'target_users',
        description: 'Target audience',
        required: false,
        defaultValue: 'developers',
        type: 'string',
      },
    ],
    tags: ['readme', 'documentation', 'project'],
    isPublic: true,
    isSystem: true,
    version: 1,
  },

  // Workflow Templates
  {
    name: 'Task Breakdown',
    description: 'Break down complex tasks into actionable steps',
    category: 'workflow',
    content: `Break down this task into actionable steps:

Task: {{task}}
Goal: {{goal}}
Timeline: {{timeline}}
Resources: {{resources}}

Create a detailed breakdown with:
1. Sub-tasks with clear descriptions
2. Estimated time for each
3. Dependencies between tasks
4. Priority levels
5. Required resources
6. Success criteria`,
    variables: [
      {
        name: 'task',
        description: 'Task to break down',
        required: true,
        type: 'string',
      },
      { name: 'goal', description: 'End goal', required: true, type: 'string' },
      {
        name: 'timeline',
        description: 'Timeline constraints',
        required: false,
        defaultValue: 'flexible',
        type: 'string',
      },
      {
        name: 'resources',
        description: 'Available resources',
        required: false,
        defaultValue: 'standard',
        type: 'string',
      },
    ],
    tags: ['workflow', 'planning', 'tasks'],
    isPublic: true,
    isSystem: true,
    version: 1,
  },

  // Research Templates
  {
    name: 'Research Assistant',
    description: 'Help research and synthesize information on any topic',
    category: 'research',
    content: `Research the following topic:

Topic: {{topic}}
Specific questions: {{questions}}
Depth: {{depth}}
Sources: {{sources}}

Provide:
1. Overview of the topic
2. Key findings
3. Different perspectives/viewpoints
4. Supporting evidence
5. Gaps in current knowledge
6. Recommendations for further research

Focus on {{focus_areas}}`,
    variables: [
      {
        name: 'topic',
        description: 'Research topic',
        required: true,
        type: 'string',
      },
      {
        name: 'questions',
        description: 'Specific questions to answer',
        required: false,
        defaultValue: '',
        type: 'string',
      },
      {
        name: 'depth',
        description: 'Research depth',
        required: false,
        defaultValue: 'moderate',
        type: 'string',
      },
      {
        name: 'sources',
        description: 'Type of sources preferred',
        required: false,
        defaultValue: 'all reliable sources',
        type: 'string',
      },
      {
        name: 'focus_areas',
        description: 'Areas to focus on',
        required: false,
        defaultValue: 'comprehensive coverage',
        type: 'string',
      },
    ],
    tags: ['research', 'analysis', 'investigation'],
    isPublic: true,
    isSystem: true,
    version: 1,
  },
];

/**
 * Interpolate variables in a prompt template
 */
export function interpolatePrompt(
  template: string,
  variables: Record<string, string | number | boolean>
): string {
  let result = template;

  // Replace all {{variable}} placeholders
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    result = result.replace(regex, String(value));
  });

  return result;
}

/**
 * Extract variable names from a template
 */
export function extractVariables(template: string): string[] {
  const regex = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
  const variables = new Set<string>();
  let match;

  while ((match = regex.exec(template)) !== null) {
    variables.add(match[1]);
  }

  return Array.from(variables);
}

/**
 * Validate that all required variables are provided
 */
export function validateVariables(
  template: PromptTemplate,
  provided: Record<string, unknown>
): { valid: boolean; missing: string[] } {
  const required = template.variables.filter(v => v.required).map(v => v.name);

  const missing = required.filter(name => !provided[name]);

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Get default values for template variables
 */
export function getDefaultValues(
  template: PromptTemplate
): Record<string, string> {
  return template.variables.reduce(
    (acc, variable) => {
      if (variable.defaultValue !== undefined) {
        acc[variable.name] = variable.defaultValue;
      }
      return acc;
    },
    {} as Record<string, string>
  );
}

/**
 * Search templates by query
 */
export function searchTemplates(
  templates: PromptTemplate[],
  query: string
): PromptTemplate[] {
  const lowerQuery = query.toLowerCase();

  return templates.filter(
    template =>
      template.name.toLowerCase().includes(lowerQuery) ||
      template.description.toLowerCase().includes(lowerQuery) ||
      template.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
      template.category.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Filter templates by category
 */
export function filterByCategory(
  templates: PromptTemplate[],
  category: PromptCategory
): PromptTemplate[] {
  return templates.filter(template => template.category === category);
}

/**
 * Sort templates by different criteria
 */
export function sortTemplates(
  templates: PromptTemplate[],
  sortBy: 'name' | 'usage' | 'stars' | 'recent'
): PromptTemplate[] {
  return [...templates].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'usage':
        return b.usageCount - a.usageCount;
      case 'stars':
        return b.starCount - a.starCount;
      case 'recent':
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      default:
        return 0;
    }
  });
}
