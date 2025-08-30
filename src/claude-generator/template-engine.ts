import type { TemplateContext, ProjectType, ClaudeConfig } from './types.js';

export class TemplateEngine {
  /**
   * Generate CLAUDE.md content from template context
   */
  generateClaudeConfig(context: TemplateContext): string {
    const sections = [
      this.generateHeader(context),
      this.generateVerificationProtocol(),
      this.generateConcurrentExecution(),
      this.generateProjectOverview(context),
      this.generateCommands(context),
      this.generateWorkflowPhases(context),
      this.generateCodeStyle(context),
      this.generateAgentConfiguration(context),
      this.generateMCPTools(context),
      this.generateBuildSystem(context),
      this.generateQualityStandards(context),
      this.generateIntegrationTips(context),
      this.generateFooter()
    ].filter(Boolean);

    return sections.join('\n\n');
  }

  private generateHeader(context: TemplateContext): string {
    const { project, type } = context;
    
    return `# Claude Code Configuration - ${project.name}

## Project: ${project.name}
**Type**: ${this.getProjectTypeDisplay(type)}  
**Description**: ${project.description}  
${project.version ? `**Version**: ${project.version}  ` : ''}
${project.author ? `**Author**: ${project.author}  ` : ''}
${project.license ? `**License**: ${project.license}  ` : ''}

---`;
  }

  private generateVerificationProtocol(): string {
    return `## 🚨 CRITICAL: VERIFICATION PROTOCOL & REALITY CHECKS

### MANDATORY: ALWAYS VERIFY, NEVER ASSUME

**After EVERY code change or implementation:**
1. **TEST IT**: Run the actual command and show real output
2. **PROVE IT**: Show file contents, build results, test output  
3. **FAIL LOUDLY**: If something fails, say "❌ FAILED:" immediately
4. **VERIFY SUCCESS**: Only claim "complete" after showing it working

**NEVER claim completion without:**
- Actual terminal output proving it works
- Build command succeeding (\`npm run build\`, etc.)
- Tests passing (if applicable)
- The feature demonstrably working

**When something fails:**
1. Report immediately: "❌ FAILURE: [specific error]"
2. Show the actual error message
3. Do NOT continue pretending it worked
4. Do NOT claim partial success without verification

### VERIFICATION CHECKPOINTS

Before claiming ANY task complete:
- [ ] Does the build succeed? (show build output)
- [ ] Do tests pass? (show test output)
- [ ] Can you run it? (show execution)
- [ ] Did you verify, not assume? (show proof)`;
  }

  private generateConcurrentExecution(): string {
    return `## 🚨 CRITICAL: CONCURRENT EXECUTION & FILE MANAGEMENT

**ABSOLUTE RULES**:
1. ALL operations MUST be concurrent/parallel in a single message
2. **NEVER save working files, text/mds and tests to the root folder**
3. ALWAYS organize files in appropriate subdirectories
4. **ALWAYS VERIFY before claiming success**

### ⚡ GOLDEN RULE: "1 MESSAGE = ALL RELATED OPERATIONS"

**MANDATORY PATTERNS:**
- **TodoWrite**: ALWAYS batch ALL todos in ONE call (5-10+ todos minimum)
- **File operations**: ALWAYS batch ALL reads/writes/edits in ONE message
- **Bash commands**: ALWAYS batch ALL terminal operations in ONE message

### 📁 File Organization Rules

**NEVER save to root folder. Use these directories:**
- \`/src\` - Source code files
- \`/tests\` - Test files
- \`/docs\` - Documentation and markdown files
- \`/config\` - Configuration files
- \`/scripts\` - Utility scripts
- \`/examples\` - Example code`;
  }

  private generateProjectOverview(context: TemplateContext): string {
    const { project, structure, type } = context;

    let overview = `## Project Overview

This is a ${this.getProjectTypeDisplay(type)} project`;

    if (structure.frameworks.length > 0) {
      overview += ` built with ${structure.frameworks.join(', ')}`;
    }

    if (structure.buildTools.length > 0) {
      overview += `, using ${structure.buildTools.join(', ')} for build processes`;
    }

    overview += '.';

    // Add specific details based on project type
    switch (type) {
      case 'monorepo':
        overview += `\n\n**Monorepo Structure**:
- Multiple packages managed together
- Workspace-based dependency management
- Shared tooling and configurations`;
        break;
      case 'react':
      case 'nextjs':
        overview += `\n\n**Frontend Application**:
- Component-based architecture
- Modern React patterns and hooks
- Responsive design principles`;
        break;
      case 'nodejs':
        overview += `\n\n**Node.js Application**:
- Server-side JavaScript runtime
- RESTful API or service architecture
- Node.js ecosystem and npm packages`;
        break;
      case 'cli':
        overview += `\n\n**Command Line Interface**:
- Interactive terminal commands
- Extensible command structure
- User-friendly help and documentation`;
        break;
    }

    return overview;
  }

  private generateCommands(context: TemplateContext): string {
    const { buildCommands, testCommands, lintCommands, customCommands } = context;

    let commands = `## Available Commands

### Core Commands`;

    if (buildCommands.length > 0) {
      commands += `\n**Build**:\n${buildCommands.map(cmd => `- \`${cmd}\``).join('\n')}`;
    }

    if (testCommands.length > 0) {
      commands += `\n\n**Testing**:\n${testCommands.map(cmd => `- \`${cmd}\``).join('\n')}`;
    }

    if (lintCommands.length > 0) {
      commands += `\n\n**Linting & Formatting**:\n${lintCommands.map(cmd => `- \`${cmd}\``).join('\n')}`;
    }

    if (customCommands.length > 0) {
      commands += `\n\n**Custom Commands**:\n${customCommands.map(cmd => `- \`${cmd}\``).join('\n')}`;
    }

    return commands;
  }

  private generateWorkflowPhases(context: TemplateContext): string {
    const { type } = context;

    let workflow = `## Development Workflow

### SPARC Methodology Phases

1. **Specification** - Requirements analysis
2. **Pseudocode** - Algorithm design  
3. **Architecture** - System design
4. **Refinement** - Implementation with TDD
5. **Completion** - Integration and testing`;

    // Add project-specific workflow considerations
    switch (type) {
      case 'react':
      case 'nextjs':
        workflow += `

### Frontend Development Flow
1. Component design and mockups
2. Component implementation with TypeScript
3. Unit testing with React Testing Library
4. Integration testing
5. Accessibility and performance testing`;
        break;
      case 'monorepo':
        workflow += `

### Monorepo Development Flow
1. Package dependency analysis
2. Incremental development by package
3. Cross-package integration testing
4. Coordinated versioning and publishing`;
        break;
      case 'cli':
        workflow += `

### CLI Development Flow
1. Command specification and help design
2. Argument parsing and validation
3. Core functionality implementation
4. User experience testing
5. Documentation and examples`;
        break;
    }

    return workflow;
  }

  private generateCodeStyle(context: TemplateContext): string {
    const { quality, structure } = context;

    let style = `## Code Style & Best Practices

### Core Principles
- **Modular Design**: Files under 500 lines
- **Environment Safety**: Never hardcode secrets
- **Test-First**: Write tests before implementation
- **Clean Architecture**: Separate concerns
- **Documentation**: Keep updated`;

    if (quality.linting.enabled) {
      style += `\n\n### Linting Standards
- **Tool**: ${quality.linting.configs.join(', ')}
- **Rules**: Enforced via pre-commit hooks
- **Auto-fix**: Available for most issues`;
    }

    if (quality.typeChecking.enabled) {
      style += `\n\n### Type Safety
- **TypeScript**: ${quality.typeChecking.strict ? 'Strict mode enabled' : 'Standard configuration'}
- **Type Coverage**: Aim for 100% type coverage
- **Interface Design**: Prefer interfaces over types for extensibility`;
    }

    if (quality.formatting.enabled) {
      style += `\n\n### Code Formatting
- **Tools**: ${quality.formatting.tools.join(', ')}
- **Consistency**: Automated formatting on save
- **Standards**: Team-agreed formatting rules`;
    }

    return style;
  }

  private generateAgentConfiguration(context: TemplateContext): string {
    const { agents, type } = context;

    let config = `## 🚀 Agent Configuration

### Core Development Agents
\`coder\`, \`reviewer\`, \`tester\`, \`planner\`, \`researcher\`

### Specialized Agents for ${this.getProjectTypeDisplay(type)}`;

    const specializedAgents = agents.specializedAgents[type] || [];
    if (specializedAgents.length > 0) {
      config += `\n${specializedAgents.map(agent => `\`${agent}\``).join(', ')}`;
    }

    config += `\n\n### Swarm Configuration
- **Topology**: ${agents.swarmTopology}
- **Max Agents**: ${agents.maxAgents}
- **Auto-scaling**: Enabled based on task complexity`;

    // Add project-specific agent recommendations
    switch (type) {
      case 'react':
      case 'nextjs':
        config += `\n\n### Frontend-Specific Agents
- \`ui-designer\`: Component design and styling
- \`accessibility-tester\`: A11y compliance
- \`performance-optimizer\`: Bundle analysis and optimization`;
        break;
      case 'monorepo':
        config += `\n\n### Monorepo-Specific Agents
- \`package-coordinator\`: Cross-package dependency management
- \`build-orchestrator\`: Optimized build ordering
- \`version-manager\`: Semantic versioning coordination`;
        break;
      case 'cli':
        config += `\n\n### CLI-Specific Agents
- \`ux-designer\`: Command interface design
- \`help-writer\`: Documentation and help text
- \`integration-tester\`: Cross-platform testing`;
        break;
    }

    return config;
  }

  private generateMCPTools(context: TemplateContext): string {
    const { mcp, type } = context;

    let mcpConfig = `## 🔧 MCP Tools Integration

### Available MCP Tools

The Wundr toolkit provides powerful MCP tools for governance and code quality:`;

    if (mcp.tools.length > 0) {
      for (const tool of mcp.tools) {
        mcpConfig += `\n\n**${tool.name}** - ${tool.description}`;
      }
    } else {
      // Add default recommended tools based on project type
      mcpConfig += `\n\n1. **drift_detection** - Monitor code quality drift
2. **pattern_standardize** - Auto-fix code patterns  
3. **dependency_analyze** - Analyze dependencies
4. **test_baseline** - Manage test coverage
5. **claude_config** - Configure Claude Code`;
    }

    mcpConfig += `\n\n### Quick MCP Setup

\`\`\`bash
# Install MCP tools
cd mcp-tools && ./install.sh

# Verify installation
claude mcp list
\`\`\``;

    return mcpConfig;
  }

  private generateBuildSystem(context: TemplateContext): string {
    const { structure, buildCommands, testCommands } = context;

    let buildSystem = `## 🏗️ Build System`;

    if (structure.buildTools.length > 0) {
      buildSystem += `\n\n### Build Tools
- **Primary**: ${structure.buildTools[0]}`;
      
      if (structure.buildTools.length > 1) {
        buildSystem += `\n- **Additional**: ${structure.buildTools.slice(1).join(', ')}`;
      }
    }

    if (buildCommands.length > 0) {
      buildSystem += `\n\n### Build Commands
${buildCommands.map(cmd => `- \`${cmd}\` - Build the project`).join('\n')}`;
    }

    if (testCommands.length > 0) {
      buildSystem += `\n\n### Test Commands  
${testCommands.map(cmd => `- \`${cmd}\` - Run tests`).join('\n')}`;
    }

    return buildSystem;
  }

  private generateQualityStandards(context: TemplateContext): string {
    const { quality } = context;

    let standards = `## 📊 Quality Standards`;

    if (quality.linting.enabled) {
      standards += `\n\n### Linting
- **Status**: ✅ Enabled
- **Tools**: ${quality.linting.configs.join(', ')}`;
    }

    if (quality.typeChecking.enabled) {
      standards += `\n\n### Type Checking
- **Status**: ✅ Enabled  
- **Strict Mode**: ${quality.typeChecking.strict ? '✅ Yes' : '⚠️ No'}
- **Tools**: ${quality.typeChecking.configs.join(', ')}`;
    }

    if (quality.testing.enabled) {
      standards += `\n\n### Testing
- **Status**: ✅ Enabled
- **Frameworks**: ${quality.testing.frameworks.join(', ')}
- **Coverage**: ${quality.coverage?.enabled ? '✅ Enabled' : '❌ Disabled'}`;
      
      if (quality.testing.coverage.threshold) {
        standards += `\n- **Threshold**: ${quality.testing.coverage.threshold}%`;
      }
    }

    if (quality.formatting.enabled) {
      standards += `\n\n### Code Formatting
- **Status**: ✅ Enabled
- **Tools**: ${quality.formatting.tools.join(', ')}`;
    }

    if (quality.preCommitHooks.enabled) {
      standards += `\n\n### Pre-commit Hooks
- **Status**: ✅ Enabled
- **Tools**: ${quality.preCommitHooks.hooks.join(', ')}`;
    }

    return standards;
  }

  private generateIntegrationTips(context: TemplateContext): string {
    const { type } = context;

    let tips = `## 💡 Integration Tips

### General Guidelines
1. Start with basic swarm initialization
2. Scale agents gradually based on complexity
3. Use memory for maintaining context
4. Monitor progress with regular status checks
5. Train patterns from successful completions

### Project-Specific Tips`;

    switch (type) {
      case 'monorepo':
        tips += `\n- Use package-scoped agents for isolated work
- Coordinate builds with dependency-aware scheduling  
- Monitor cross-package impacts carefully`;
        break;
      case 'react':
      case 'nextjs':
        tips += `\n- Component-first development approach
- Use storybook for isolated component testing
- Accessibility testing in all UI changes`;
        break;
      case 'nodejs':
        tips += `\n- API-first design with OpenAPI specs
- Environment-specific configurations
- Database migration coordination`;
        break;
      case 'cli':
        tips += `\n- Test across multiple platforms
- Comprehensive help documentation
- Error handling with helpful messages`;
        break;
    }

    return tips;
  }

  private generateFooter(): string {
    return `---

## Support & Resources

- **Claude Flow**: Orchestration and coordination
- **Claude Code**: Implementation and execution  
- **Wundr MCP**: Quality assurance and governance

Remember: **Claude Flow coordinates, Claude Code creates, Wundr ensures quality!**

---

*This configuration was automatically generated by the Wundr Dynamic CLAUDE.md Generator*`;
  }

  private getProjectTypeDisplay(type: ProjectType): string {
    const displayMap: Record<ProjectType, string> = {
      'react': 'React Application',
      'nextjs': 'Next.js Application',
      'nodejs': 'Node.js Application', 
      'typescript': 'TypeScript Project',
      'python': 'Python Project',
      'monorepo': 'Monorepo',
      'library': 'Library Package',
      'cli': 'Command Line Interface',
      'full-stack': 'Full-Stack Application',
      'unknown': 'Generic Project'
    };

    return displayMap[type] || 'Unknown Project Type';
  }
}