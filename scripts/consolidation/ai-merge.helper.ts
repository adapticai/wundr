#!/usr/bin/env node
// scripts/consolidation/ai-merge-helper.ts

import * as fs from 'fs';
import * as path from 'path';

interface MergeCandidate {
  entities: Array<{
    name: string;
    file: string;
    content: string;
    type: string;
  }>;
  similarity: number;
  reason: string[];
}

interface MergePrompt {
  instruction: string;
  context: string;
  entities: string;
  guidelines: string;
  expectedOutput: string;
}

export class AIMergeHelper {
  private goldenStandardsPath = './GOLDEN_STANDARDS.md';
  private goldenStandards: string;

  constructor() {
    // Load golden standards
    if (fs.existsSync(this.goldenStandardsPath)) {
      this.goldenStandards = fs.readFileSync(this.goldenStandardsPath, 'utf-8');
    } else {
      this.goldenStandards = 'No golden standards found. Use TypeScript best practices.';
    }
  }

  /**
   * Generate a merge prompt for AI assistant
   */
  generateMergePrompt(candidates: MergeCandidate): MergePrompt {
    const entityType = candidates.entities[0]?.type || 'unknown';
    const entityCount = candidates.entities.length;

    const instruction = this.generateInstruction(entityType, entityCount);
    const context = this.generateContext(candidates);
    const entities = this.formatEntities(candidates.entities);
    const guidelines = this.extractRelevantGuidelines(entityType);
    const expectedOutput = this.generateExpectedOutput(entityType);

    return {
      instruction,
      context,
      entities,
      guidelines,
      expectedOutput
    };
  }

  /**
   * Generate instruction based on entity type
   */
  private generateInstruction(entityType: string, count: number): string {
    const instructions: Record<string, string> = {
      interface: `Merge ${count} similar TypeScript interfaces into a single, well-structured interface.`,
      type: `Consolidate ${count} type aliases into a single, comprehensive type definition.`,
      class: `Merge ${count} similar classes into a single, well-designed class that combines all functionality.`,
      enum: `Consolidate ${count} similar enums into a single enum with all unique values.`,
      function: `Merge ${count} similar functions into a single, robust function that handles all cases.`
    };

    return instructions[entityType] || `Merge ${count} similar ${entityType}s into a single entity.`;
  }

  /**
   * Generate context about the merge
   */
  private generateContext(candidates: MergeCandidate): string {
    const reasons = candidates.reason.join('\n- ');

    return `## Context

These entities were identified as duplicates with ${Math.round(candidates.similarity * 100)}% similarity.

### Reasons for merging:
- ${reasons}

### Goals:
1. Eliminate duplication while preserving all functionality
2. Create a single, well-named entity following our naming conventions
3. Ensure the merged entity is more maintainable than the originals
4. Add comprehensive JSDoc documentation
5. Maintain backward compatibility where possible`;
  }

  /**
   * Format entities for the prompt
   */
  private formatEntities(entities: Array<any>): string {
    return entities.map((entity, index) => `
### Entity ${index + 1}: ${entity.name}
**File**: ${entity.file}

\`\`\`typescript
${entity.content}
\`\`\`
`).join('\n');
  }

  /**
   * Extract relevant guidelines for the entity type
   */
  private extractRelevantGuidelines(entityType: string): string {
    const sections: Record<string, string[]> = {
      interface: ['Type System Guidelines', 'When to Use Interfaces', 'Naming Conventions'],
      type: ['Type System Guidelines', 'When to Use Type Aliases', 'Naming Conventions'],
      class: ['Service Architecture', 'Base Service Pattern', 'Naming Conventions'],
      enum: ['Naming Conventions', 'Enums'],
      function: ['Naming Conventions', 'Async/Await Patterns', 'Error Handling']
    };

    const relevantSections = sections[entityType] || ['Naming Conventions'];

    // Extract relevant sections from golden standards
    let guidelines = '## Relevant Guidelines\n\n';

    for (const section of relevantSections) {
      const sectionRegex = new RegExp(`### ${section}[\\s\\S]*?(?=###|$)`, 'g');
      const match = this.goldenStandards.match(sectionRegex);
      if (match) {
        guidelines += match[0] + '\n\n';
      }
    }

    return guidelines;
  }

  /**
   * Generate expected output format
   */
  private generateExpectedOutput(entityType: string): string {
    const examples: Record<string, string> = {
      interface: `## Expected Output Format

\`\`\`typescript
/**
 * Comprehensive description of the merged interface
 *
 * @example
 * const user: User = {
 *   id: '123',
 *   name: 'John Doe',
 *   email: 'john@example.com'
 * };
 */
export interface MergedEntityName {
  // Group related properties with comments

  /** User identification */
  id: string;
  uuid?: string; // Optional if not always present

  /** User information */
  name: string;
  email: string;

  /** Additional properties from all sources */
  // ...
}
\`\`\``,

      type: `## Expected Output Format

\`\`\`typescript
/**
 * Description of the merged type
 * Explain when to use this type vs an interface
 */
export type MergedTypeName = {
  // All properties from source types
  property1: string;
  property2?: number;
} & AdditionalType; // Use intersection if needed

// Or for union types:
export type Status = 'pending' | 'active' | 'completed' | 'error';
\`\`\``,

      class: `## Expected Output Format

\`\`\`typescript
/**
 * Description of the merged class
 * Explains the responsibility and usage
 */
export class MergedClassName extends BaseService {
  constructor(
    private readonly dependency1: Dependency1,
    private readonly dependency2: Dependency2
  ) {
    super('MergedClassName');
  }

  /**
   * Method documentation
   */
  async methodName(param: Type): Promise<ReturnType> {
    // Combined implementation
  }

  // All unique methods from source classes
}
\`\`\``,

      enum: `## Expected Output Format

\`\`\`typescript
/**
 * Description of the merged enum
 * Lists all possible values and their meanings
 */
export enum MergedEnumName {
  VALUE_ONE = 'VALUE_ONE',
  VALUE_TWO = 'VALUE_TWO',
  // All unique values from source enums
}
\`\`\``,

      function: `## Expected Output Format

\`\`\`typescript
/**
 * Description of the merged function
 *
 * @param param1 - Description
 * @param param2 - Description
 * @returns Description of return value
 *
 * @example
 * const result = await mergedFunction(param1, param2);
 */
export async function mergedFunctionName(
  param1: Type1,
  param2: Type2
): Promise<ReturnType> {
  // Input validation
  if (!param1) {
    throw new ValidationError('param1 is required', ['param1']);
  }

  try {
    // Combined logic from all source functions

    return result;
  } catch (error) {
    // Consistent error handling
    throw new AppError('Operation failed', 'OPERATION_ERROR');
  }
}
\`\`\``
    };

    return examples[entityType] || '## Expected Output Format\n\nProvide the merged entity with comprehensive documentation.';
  }

  /**
   * Generate complete prompt for AI
   */
  formatCompletePrompt(prompt: MergePrompt): string {
    return `# Merge Duplicate ${prompt.instruction}

${prompt.context}

${prompt.guidelines}

## Entities to Merge

${prompt.entities}

${prompt.expectedOutput}

## Additional Requirements

1. **Naming**: Choose the best name from the candidates or create a better one following our conventions
2. **Documentation**: Add comprehensive JSDoc with examples
3. **Properties**: Include all unique properties/methods from all sources
4. **Types**: Use the most specific type when there are conflicts
5. **Optionality**: Mark properties as optional (?) if they don't appear in all sources
6. **Organization**: Group related properties/methods with comments
7. **Compatibility**: Note any breaking changes in comments

Please provide the merged entity following the expected format above.`;
  }

  /**
   * Generate prompts for a batch of candidates
   */
  generateBatchPrompts(batchFile: string): void {
    const batch = JSON.parse(fs.readFileSync(batchFile, 'utf-8'));
    const outputDir = path.join('ai-prompts', new Date().toISOString().split('T')[0] || 'unknown');

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    batch.items.forEach((item: any, index: number) => {
      const candidates: MergeCandidate = {
        entities: item.entities.map((e: any) => ({
          name: e.name,
          file: e.file,
          content: this.loadEntityContent(e.file, e.name),
          type: e.type
        })),
        similarity: item.similarity,
        reason: item.reason || [`${item.entities.length} duplicate ${item.type}s found`]
      };

      const prompt = this.generateMergePrompt(candidates);
      const completePrompt = this.formatCompletePrompt(prompt);

      const filename = path.join(outputDir, `merge-${item.type}-${index + 1}.md`);
      fs.writeFileSync(filename, completePrompt);

      console.log(`✓ Generated prompt: ${filename}`);
    });

    // Generate index file
    const indexContent = `# AI Merge Prompts

Generated: ${new Date().toISOString()}

## Prompts in this batch:

${batch.items.map((item: any, index: number) =>
      `${index + 1}. [${item.type} merge](merge-${item.type}-${index + 1}.md) - ${item.entities.length} entities`
    ).join('\n')}

## How to use:

1. Open each prompt file
2. Copy the content to your AI coding assistant
3. Review and refine the generated code
4. Save the result to the appropriate file
5. Run the consolidation manager to apply changes
`;

    fs.writeFileSync(path.join(outputDir, 'README.md'), indexContent);
    console.log(`\n✓ Generated ${batch.items.length} prompts in ${outputDir}`);
  }

  /**
   * Load entity content from file
   */
  private loadEntityContent(filePath: string, entityName: string): string {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');

      // Simple regex patterns to extract entity content
      const patterns = [
        // Interface
        new RegExp(`export\\s+interface\\s+${entityName}\\s*{[^}]+}`, 's'),
        // Type
        new RegExp(`export\\s+type\\s+${entityName}\\s*=\\s*[^;]+;`, 's'),
        // Class
        new RegExp(`export\\s+class\\s+${entityName}\\s*{[^}]+}`, 's'),
        // Enum
        new RegExp(`export\\s+enum\\s+${entityName}\\s*{[^}]+}`, 's'),
        // Function
        new RegExp(`export\\s+(async\\s+)?function\\s+${entityName}\\s*\\([^)]*\\)[^{]*{[^}]+}`, 's')
      ];

      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
          return match[0];
        }
      }

      return `// Entity ${entityName} not found in ${filePath}`;
    } catch (error) {
      return `// Error loading ${entityName} from ${filePath}: ${error}`;
    }
  }

  /**
   * Apply AI-generated merge results
   */
  async applyMergeResult(
    mergeResultFile: string,
    targetFile: string,
    entitiesToRemove: Array<{ file: string; name: string }>
  ) {
    // Read the AI-generated result
    const mergedCode = fs.readFileSync(mergeResultFile, 'utf-8');

    // Extract just the code block
    const codeMatch = mergedCode.match(/```typescript\n([\s\S]+?)\n```/);
    if (!codeMatch) {
      throw new Error('No TypeScript code block found in merge result');
    }

    const code = codeMatch[1] || '';

    // Append to target file or create new
    if (fs.existsSync(targetFile)) {
      const existingContent = fs.readFileSync(targetFile, 'utf-8');
      fs.writeFileSync(targetFile, existingContent + '\n\n' + code);
    } else {
      fs.writeFileSync(targetFile, code);
    }

    console.log(`✓ Applied merge to ${targetFile}`);

    // Create a script to remove old entities
    const removalScript = `#!/usr/bin/env node
// Auto-generated removal script

const entitiesToRemove = ${JSON.stringify(entitiesToRemove, null, 2)};

// TODO: Run consolidation-manager.ts to update all imports and remove old entities
console.log('Entities to remove:', entitiesToRemove);
`;

    const removalScriptPath = mergeResultFile.replace('.md', '-removal.js');
    fs.writeFileSync(removalScriptPath, removalScript);

    console.log(`✓ Created removal script: ${removalScriptPath}`);
  }
}

// CLI interface
if (require.main === module) {
  const helper = new AIMergeHelper();
  const command = process.argv[2];
  const arg = process.argv[3];

  switch (command) {
    case 'generate':
      if (!arg) {
        console.error('Usage: ai-merge-helper.ts generate <batch-file>');
        process.exit(1);
      }
      helper.generateBatchPrompts(arg);
      break;

    case 'apply':
      if (!arg) {
        console.error('Usage: ai-merge-helper.ts apply <merge-result.md> <target-file> <entities-json>');
        process.exit(1);
      }
      const targetFile = process.argv[4];
      const entitiesJson = process.argv[5];

      if (!targetFile || !entitiesJson) {
        console.error('Missing arguments');
        process.exit(1);
      }

      const entities = JSON.parse(entitiesJson);
      helper.applyMergeResult(arg, targetFile, entities)
        .catch(error => {
          console.error('Failed to apply merge:', error);
          process.exit(1);
        });
      break;

    default:
      console.log(`
Usage: ai-merge-helper.ts <command> [args]

Commands:
  generate <batch-file>  - Generate AI prompts for a batch
  apply <result> <target> <entities>  - Apply AI-generated merge result
      `);
  }
}
