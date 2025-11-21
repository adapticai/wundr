/**
 * MCP Prompts for Wundr
 */

export interface Prompt {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
}

export interface PromptMessage {
  role: 'user' | 'assistant';
  content: {
    type: 'text';
    text: string;
  };
}

export interface PromptResponse {
  description: string;
  messages: PromptMessage[];
}

/**
 * Register all available prompts
 */
export function registerPrompts(): Prompt[] {
  return [
    {
      name: 'quality-check',
      description: 'Run a comprehensive code quality check on the project',
      arguments: [
        {
          name: 'path',
          description: 'Path to analyze',
          required: false,
        },
      ],
    },
    {
      name: 'weekly-review',
      description: 'Generate a weekly code review summary',
      arguments: [],
    },
    {
      name: 'pre-commit',
      description: 'Validate code before committing',
      arguments: [
        {
          name: 'files',
          description: 'Files to validate (comma-separated)',
          required: false,
        },
      ],
    },
    {
      name: 'fix-patterns',
      description: 'Identify and fix code pattern issues',
      arguments: [
        {
          name: 'pattern',
          description: 'Pattern type to fix (imports, errors, naming, async, types)',
          required: false,
        },
      ],
    },
  ];
}

/**
 * Handle getting a prompt by name
 */
export async function handlePromptGet(
  name: string,
  args: Record<string, string>
): Promise<PromptResponse> {
  switch (name) {
    case 'quality-check':
      return qualityCheckPrompt(args['path']);

    case 'weekly-review':
      return weeklyReviewPrompt();

    case 'pre-commit':
      return preCommitPrompt(args['files']);

    case 'fix-patterns':
      return fixPatternsPrompt(args['pattern']);

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
}

function qualityCheckPrompt(path?: string): PromptResponse {
  const targetPath = path || 'the current project';

  return {
    description: `Comprehensive code quality check for ${targetPath}`,
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Please run a comprehensive code quality check on ${targetPath}.

I need you to:
1. Check for code drift using drift_detection with action "check"
2. Analyze patterns using pattern_standardize with action "analyze"
3. Check dependencies using dependency_analyze with action "analyze"
4. Generate a quality report using governance_report with action "quality"

After running these checks, provide a summary of:
- Overall code health score
- Key issues that need attention
- Recommended actions prioritized by impact
- Any blockers for deployment`,
        },
      },
    ],
  };
}

function weeklyReviewPrompt(): PromptResponse {
  return {
    description: 'Weekly code review summary',
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Generate a weekly code review summary for the project.

Please:
1. Run governance_report with action "weekly" to get the weekly metrics
2. Run test_baseline with action "compare" to check test coverage changes
3. Run drift_detection with action "trends" with period "week"

Compile the results into an executive summary that includes:
- Key accomplishments this week
- Code quality trends (improving/stable/declining)
- Test coverage status
- Any technical debt introduced
- Recommendations for next week`,
        },
      },
    ],
  };
}

function preCommitPrompt(files?: string): PromptResponse {
  const fileList = files ? `the following files: ${files}` : 'all staged files';

  return {
    description: 'Pre-commit validation',
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Validate ${fileList} before committing.

Run these checks:
1. pattern_standardize with action "analyze" to check for pattern violations
2. dependency_analyze with action "circular" to ensure no circular dependencies were introduced
3. test_baseline with action "compare" with failOnDecrease true

Report:
- Any blocking issues that must be fixed before commit
- Warnings that should be addressed soon
- A clear PASS/FAIL verdict

If there are issues, provide specific guidance on how to fix them.`,
        },
      },
    ],
  };
}

function fixPatternsPrompt(pattern?: string): PromptResponse {
  const patternType = pattern || 'all';

  return {
    description: `Fix ${patternType} code patterns`,
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Identify and fix ${patternType} code pattern issues in the project.

Steps:
1. Run pattern_standardize with action "analyze" and pattern "${patternType}"
2. Review the patterns that need manual attention using pattern_standardize with action "review"
3. For auto-fixable issues, run pattern_standardize with action "fix" and pattern "${patternType}" with dryRun true first
4. Show me the proposed changes before applying them

Present:
- Summary of issues found
- Proposed fixes (dry run results)
- Items requiring manual review
- Expected improvement in pattern compliance score

Wait for my approval before applying any fixes with dryRun false.`,
        },
      },
    ],
  };
}
