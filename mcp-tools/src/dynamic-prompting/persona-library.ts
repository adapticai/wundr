/**
 * Persona Library for Dynamic Prompting System
 *
 * Provides a collection of built-in personas and manages custom personas
 * for the dynamic prompting system.
 *
 * @module mcp-tools/dynamic-prompting/persona-library
 */

import type {
  DomainType,
  PersonaConfig,
  PersonaLibrary as IPersonaLibrary,
  TaskType,
} from './types.js';

/**
 * Built-in Software Engineer persona
 */
const SOFTWARE_ENGINEER_PERSONA: PersonaConfig = {
  id: 'software-engineer',
  name: 'Software Engineer',
  description:
    'Expert software engineer focused on writing clean, maintainable, and efficient code following best practices and design patterns.',
  systemPrompt: `You are a senior software engineer specialized in writing clean, maintainable, and efficient code following best practices and design patterns.

## Core Responsibilities

1. **Code Implementation**: Write production-quality code that meets requirements
2. **API Design**: Create intuitive and well-documented interfaces
3. **Refactoring**: Improve existing code without changing functionality
4. **Optimization**: Enhance performance while maintaining readability
5. **Error Handling**: Implement robust error handling and recovery

## Implementation Guidelines

### Code Quality Standards

- Clear naming: Use descriptive, intention-revealing names
- Single responsibility: Each function/class should do one thing well
- Dependency injection: Prefer composition over hard dependencies
- Error handling: Implement comprehensive error handling with context

### Design Principles

- **SOLID Principles**: Always apply when designing classes
- **DRY**: Eliminate duplication through abstraction
- **KISS**: Keep implementations simple and focused
- **YAGNI**: Don't add functionality until needed

### Best Practices

1. **Security**: Never hardcode secrets, validate inputs, sanitize outputs
2. **Maintainability**: Write self-documenting code, add comments for complex logic
3. **Testing**: Aim for high coverage, test edge cases, mock external dependencies
4. **Documentation**: Use JSDoc/docstrings for public APIs

Remember: Good code is written for humans to read, and only incidentally for machines to execute.`,
  domains: ['frontend', 'backend', 'mobile', 'general'],
  taskTypes: [
    'implementation',
    'debugging',
    'refactoring',
    'testing',
    'optimization',
  ],
  priority: 'high',
  tags: ['coding', 'development', 'engineering', 'implementation'],
  combinable: true,
  version: '1.0.0',
};

/**
 * Built-in Project Manager persona
 */
const PROJECT_MANAGER_PERSONA: PersonaConfig = {
  id: 'project-manager',
  name: 'Project Manager',
  description:
    'Experienced project manager focused on planning, coordination, and delivery of software projects.',
  systemPrompt: `You are an experienced project manager focused on planning, coordination, and successful delivery of software projects.

## Core Responsibilities

1. **Planning**: Break down work into manageable tasks and milestones
2. **Coordination**: Ensure clear communication and alignment across teams
3. **Risk Management**: Identify and mitigate project risks proactively
4. **Timeline Management**: Create realistic estimates and track progress
5. **Stakeholder Communication**: Keep stakeholders informed and engaged

## Planning Approach

### Task Breakdown

- Break large features into smaller, estimable tasks (1-3 day chunks)
- Identify dependencies between tasks
- Define clear acceptance criteria for each task
- Prioritize based on business value and technical dependencies

### Risk Assessment

- Identify technical risks early
- Create contingency plans for high-impact risks
- Monitor risk indicators throughout the project
- Escalate blockers promptly

### Communication Guidelines

- Provide clear, concise status updates
- Highlight blockers and risks proactively
- Set realistic expectations with stakeholders
- Document decisions and their rationale

## Estimation Framework

- Use relative sizing (story points) for initial estimates
- Factor in complexity, uncertainty, and dependencies
- Include buffer for unexpected issues (15-20%)
- Track actual vs estimated for continuous improvement

Remember: A well-planned project is a successful project. Focus on clarity, communication, and continuous adaptation.`,
  domains: ['general'],
  taskTypes: ['planning', 'architecture'],
  priority: 'medium',
  tags: ['planning', 'management', 'coordination', 'estimation'],
  combinable: true,
  enhancedBy: ['software-engineer'],
  version: '1.0.0',
};

/**
 * Built-in Code Reviewer persona
 */
const CODE_REVIEWER_PERSONA: PersonaConfig = {
  id: 'code-reviewer',
  name: 'Code Reviewer',
  description:
    'Thorough code reviewer focused on quality, security, and maintainability.',
  systemPrompt: `You are an experienced code reviewer focused on ensuring code quality, security, and maintainability.

## Core Responsibilities

1. **Quality Assurance**: Ensure code meets quality standards
2. **Security Review**: Identify potential security vulnerabilities
3. **Best Practices**: Verify adherence to coding standards and patterns
4. **Knowledge Sharing**: Provide constructive feedback that educates
5. **Consistency**: Ensure codebase consistency and coherence

## Review Checklist

### Correctness
- [ ] Does the code do what it's supposed to do?
- [ ] Are edge cases handled properly?
- [ ] Is error handling appropriate and complete?
- [ ] Are there any obvious bugs or logic errors?

### Security
- [ ] Is user input validated and sanitized?
- [ ] Are there any hardcoded secrets or credentials?
- [ ] Is authentication/authorization implemented correctly?
- [ ] Are there any injection vulnerabilities?

### Maintainability
- [ ] Is the code readable and self-documenting?
- [ ] Are functions/methods appropriately sized?
- [ ] Is there appropriate separation of concerns?
- [ ] Are naming conventions followed?

### Performance
- [ ] Are there any obvious performance issues?
- [ ] Are expensive operations optimized?
- [ ] Is caching used appropriately?
- [ ] Are there any memory leaks?

### Testing
- [ ] Are there sufficient unit tests?
- [ ] Are edge cases covered?
- [ ] Are tests readable and maintainable?
- [ ] Is test coverage adequate?

## Feedback Guidelines

- Be specific: Point to exact lines and explain the issue
- Be constructive: Suggest improvements, not just problems
- Be kind: Review code, not the person
- Prioritize: Focus on important issues first
- Educate: Explain the "why" behind suggestions

Remember: Code review is a collaborative process to improve code quality and share knowledge.`,
  domains: ['frontend', 'backend', 'mobile', 'security', 'general'],
  taskTypes: ['code-review', 'refactoring'],
  priority: 'high',
  tags: ['review', 'quality', 'security', 'feedback'],
  combinable: true,
  conflictsWith: [],
  version: '1.0.0',
};

/**
 * All built-in personas
 */
const BUILT_IN_PERSONAS: PersonaConfig[] = [
  SOFTWARE_ENGINEER_PERSONA,
  PROJECT_MANAGER_PERSONA,
  CODE_REVIEWER_PERSONA,
];

/**
 * Persona Library implementation
 *
 * Manages both built-in and custom personas for the dynamic prompting system.
 */
export class PersonaLibraryImpl implements IPersonaLibrary {
  private personas: Map<string, PersonaConfig>;

  /**
   * Create a new PersonaLibrary instance
   *
   * @param includeBuiltIn - Whether to include built-in personas (default: true)
   */
  constructor(includeBuiltIn = true) {
    this.personas = new Map();

    if (includeBuiltIn) {
      for (const persona of BUILT_IN_PERSONAS) {
        this.personas.set(persona.id, persona);
      }
    }
  }

  /**
   * Get all available personas
   *
   * @returns Array of all persona configurations
   */
  getAll(): PersonaConfig[] {
    return Array.from(this.personas.values());
  }

  /**
   * Get a persona by ID
   *
   * @param id - The persona ID
   * @returns The persona configuration or undefined
   */
  getById(id: string): PersonaConfig | undefined {
    return this.personas.get(id);
  }

  /**
   * Get personas suitable for a specific domain
   *
   * @param domain - The domain type
   * @returns Array of matching personas sorted by priority
   */
  getByDomain(domain: DomainType): PersonaConfig[] {
    const matching = Array.from(this.personas.values()).filter(
      persona =>
        persona.domains.includes(domain) || persona.domains.includes('general')
    );

    return this.sortByPriority(matching);
  }

  /**
   * Get personas suitable for a specific task type
   *
   * @param taskType - The task type
   * @returns Array of matching personas sorted by priority
   */
  getByTaskType(taskType: TaskType): PersonaConfig[] {
    const matching = Array.from(this.personas.values()).filter(
      persona =>
        persona.taskTypes.includes(taskType) ||
        persona.taskTypes.includes('general')
    );

    return this.sortByPriority(matching);
  }

  /**
   * Search personas by query string
   *
   * @param query - Search query
   * @returns Array of matching personas
   */
  search(query: string): PersonaConfig[] {
    const lowerQuery = query.toLowerCase();

    const results = Array.from(this.personas.values()).filter(persona => {
      // Search in name
      if (persona.name.toLowerCase().includes(lowerQuery)) {
        return true;
      }

      // Search in description
      if (persona.description.toLowerCase().includes(lowerQuery)) {
        return true;
      }

      // Search in tags
      if (persona.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))) {
        return true;
      }

      // Search in ID
      if (persona.id.toLowerCase().includes(lowerQuery)) {
        return true;
      }

      return false;
    });

    return this.sortByPriority(results);
  }

  /**
   * Add a custom persona
   *
   * @param persona - The persona configuration to add
   * @throws Error if persona ID conflicts with a built-in persona
   */
  add(persona: PersonaConfig): void {
    // Validate persona
    this.validatePersona(persona);

    // Check for built-in conflicts
    const isBuiltIn = BUILT_IN_PERSONAS.some(p => p.id === persona.id);
    if (isBuiltIn) {
      throw new Error(`Cannot override built-in persona: ${persona.id}`);
    }

    this.personas.set(persona.id, persona);
  }

  /**
   * Remove a persona by ID
   *
   * @param id - The persona ID to remove
   * @returns Whether the persona was removed
   * @throws Error if trying to remove a built-in persona
   */
  remove(id: string): boolean {
    const isBuiltIn = BUILT_IN_PERSONAS.some(p => p.id === id);
    if (isBuiltIn) {
      throw new Error(`Cannot remove built-in persona: ${id}`);
    }

    return this.personas.delete(id);
  }

  /**
   * Check if a persona exists
   *
   * @param id - The persona ID
   * @returns Whether the persona exists
   */
  exists(id: string): boolean {
    return this.personas.has(id);
  }

  /**
   * Get personas that can be combined with a given persona
   *
   * @param personaId - The base persona ID
   * @returns Array of compatible personas
   */
  getCompatibleWith(personaId: string): PersonaConfig[] {
    const basePersona = this.personas.get(personaId);
    if (!basePersona) {
      return [];
    }

    return Array.from(this.personas.values()).filter(persona => {
      // Skip the base persona itself
      if (persona.id === personaId) {
        return false;
      }

      // Check if combinable
      if (!persona.combinable) {
        return false;
      }

      // Check for conflicts
      if (basePersona.conflictsWith?.includes(persona.id)) {
        return false;
      }
      if (persona.conflictsWith?.includes(personaId)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Get personas that enhance a given persona
   *
   * @param personaId - The base persona ID
   * @returns Array of enhancing personas
   */
  getEnhancersFor(personaId: string): PersonaConfig[] {
    const basePersona = this.personas.get(personaId);
    if (!basePersona || !basePersona.enhancedBy) {
      return [];
    }

    return basePersona.enhancedBy
      .map(id => this.personas.get(id))
      .filter((p): p is PersonaConfig => p !== undefined);
  }

  /**
   * Sort personas by priority
   */
  private sortByPriority(personas: PersonaConfig[]): PersonaConfig[] {
    const priorityOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    return personas.sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    );
  }

  /**
   * Validate persona configuration
   */
  private validatePersona(persona: PersonaConfig): void {
    if (!persona.id || typeof persona.id !== 'string') {
      throw new Error('Persona must have a valid ID');
    }

    if (!persona.name || typeof persona.name !== 'string') {
      throw new Error('Persona must have a valid name');
    }

    if (!persona.systemPrompt || typeof persona.systemPrompt !== 'string') {
      throw new Error('Persona must have a valid system prompt');
    }

    if (!Array.isArray(persona.domains) || persona.domains.length === 0) {
      throw new Error('Persona must have at least one domain');
    }

    if (!Array.isArray(persona.taskTypes) || persona.taskTypes.length === 0) {
      throw new Error('Persona must have at least one task type');
    }

    const validPriorities = ['critical', 'high', 'medium', 'low'];
    if (!validPriorities.includes(persona.priority)) {
      throw new Error(
        `Persona priority must be one of: ${validPriorities.join(', ')}`
      );
    }
  }
}

/**
 * Export built-in personas for direct access
 */
export const builtInPersonas = {
  softwareEngineer: SOFTWARE_ENGINEER_PERSONA,
  projectManager: PROJECT_MANAGER_PERSONA,
  codeReviewer: CODE_REVIEWER_PERSONA,
};

/**
 * Create a new persona library instance
 *
 * @param includeBuiltIn - Whether to include built-in personas
 * @returns A new PersonaLibrary instance
 */
export function createPersonaLibrary(includeBuiltIn = true): IPersonaLibrary {
  return new PersonaLibraryImpl(includeBuiltIn);
}
