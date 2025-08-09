#!/usr/bin/env ts-node

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// Using dynamic import for prompts due to ESM/CJS compatibility
interface PromptQuestion {
  type: 'text' | 'confirm';
  name: string;
  message: string;
  initial?: string | boolean;
}

const promptUser = async (questions: PromptQuestion[]) => {
  const { default: prompts } = await import('prompts');
  return prompts(questions);
};

interface AgentConfig {
  companyName: string;
  platformDescription: string;
  globalAgentsDir: string;
  localAgentsDir: string;
}

interface AgentTemplate {
  category: string;
  filename: string;
  content: string;
}

// Default configuration
const DEFAULT_CONFIG: AgentConfig = {
  companyName: 'Your Company',
  platformDescription: 'Enterprise SaaS Platform',
  globalAgentsDir: path.join(os.homedir(), '.claude', 'agents'),
  localAgentsDir: path.join(process.cwd(), '.claude', 'agents'),
};

// Agent categories
const AGENT_CATEGORIES = [
  'product',
  'design',
  'engineering',
  'data',
  'qa',
  'devops',
  'management',
];

// Agent definitions
const AGENT_DEFINITIONS = [
  { category: 'product', name: 'product-owner', title: 'Product Owner' },
  { category: 'product', name: 'business-analyst', title: 'Business Analyst' },
  { category: 'design', name: 'product-designer', title: 'Product Designer' },
  { category: 'design', name: 'ux-researcher', title: 'UX Researcher' },
  { category: 'engineering', name: 'software-engineer', title: 'Software Engineer' },
  { category: 'engineering', name: 'frontend-engineer', title: 'Frontend Engineer' },
  { category: 'engineering', name: 'backend-engineer', title: 'Backend Engineer' },
  { category: 'engineering', name: 'api-engineer', title: 'API Engineer' },
  { category: 'engineering', name: 'react-native-engineer', title: 'React Native Engineer' },
  { category: 'data', name: 'data-scientist', title: 'Data Scientist' },
  { category: 'data', name: 'ml-engineer', title: 'ML Engineer' },
  { category: 'data', name: 'llm-engineer', title: 'LLM Engineer' },
  { category: 'qa', name: 'qa-engineer', title: 'QA Engineer' },
  { category: 'qa', name: 'test-automation-engineer', title: 'Test Automation Engineer' },
  { category: 'devops', name: 'devops-engineer', title: 'DevOps Engineer' },
  { category: 'devops', name: 'deployment-manager', title: 'Deployment Manager' },
];

// Process template content
function processTemplate(content: string, config: AgentConfig): string {
  return content
    .replaceAll('{{COMPANY_NAME}}', config.companyName)
    .replaceAll('{{PLATFORM_DESCRIPTION}}', config.platformDescription);
}

// Create directory structure
function createDirectoryStructure(baseDir: string): void {
  for (const category of AGENT_CATEGORIES) {
    const categoryDir = path.join(baseDir, category);
    if (!fs.existsSync(categoryDir)) {
      fs.mkdirSync(categoryDir, { recursive: true });
      console.log(`✓ Created directory: ${categoryDir}`);
    }
  }
}

// Read agent templates
function readAgentTemplates(sourceDir: string): AgentTemplate[] {
  const templates: AgentTemplate[] = [];
  
  for (const category of AGENT_CATEGORIES) {
    const categoryDir = path.join(sourceDir, category);
    if (fs.existsSync(categoryDir)) {
      const files = fs.readdirSync(categoryDir);
      for (const file of files) {
        if (file.endsWith('.md')) {
          const content = fs.readFileSync(path.join(categoryDir, file), 'utf8');
          templates.push({
            category,
            filename: file,
            content,
          });
        }
      }
    }
  }
  
  return templates;
}

// Generate agents
function generateAgents(templates: AgentTemplate[], targetDir: string, config: AgentConfig): void {
  createDirectoryStructure(targetDir);
  
  for (const template of templates) {
    const processedContent = processTemplate(template.content, config);
    const outputPath = path.join(targetDir, template.category, template.filename);
    fs.writeFileSync(outputPath, processedContent);
    console.log(`✓ Generated: ${template.category}/${template.filename}`);
  }
}

// Create agent index
function createAgentIndex(targetDir: string, config: AgentConfig): void {
  const indexContent = `# Claude Agent Index

## Company: ${config.companyName}
## Platform: ${config.platformDescription}

### Available Agents

${AGENT_DEFINITIONS.map(agent => {
  return `- **${agent.title}** - [View](${agent.category}/${agent.name}.md)`;
}).join('\n')}

## Quick Start

To use these agents with Claude:

1. Reference the specific agent configuration when starting a conversation
2. The agent will adopt the role's expertise and best practices
3. Customize agent files for your specific needs

## Customization

Edit the individual agent files to:
- Update company-specific workflows
- Add custom tools and technologies
- Modify evaluation criteria
- Include internal documentation references

Generated on: ${new Date().toISOString()}
`;

  fs.writeFileSync(path.join(targetDir, 'INDEX.md'), indexContent);
  console.log('✓ Created agent index');
}

// Save configuration
function saveConfiguration(config: AgentConfig): void {
  const configDir = path.join(os.homedir(), '.claude');
  const configFile = path.join(configDir, 'agent-config.json');
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  const configData = {
    ...config,
    createdAt: new Date().toISOString(),
  };
  
  fs.writeFileSync(configFile, JSON.stringify(configData, null, 2));
  console.log(`✓ Configuration saved to: ${configFile}`);
}

// Main execution
async function main() {
  console.log('\n═══ Claude Agent Generation Tool ═══\n');
  
  // Check if running in interactive mode
  const isInteractive = process.argv.includes('--interactive');
  let config = DEFAULT_CONFIG;
  
  if (isInteractive) {
    const questions = [
      {
        type: 'text' as const,
        name: 'companyName',
        message: 'Enter your company name:',
        initial: DEFAULT_CONFIG.companyName,
      },
      {
        type: 'text' as const,
        name: 'platformDescription',
        message: 'Enter your platform description:',
        initial: DEFAULT_CONFIG.platformDescription,
      },
      {
        type: 'confirm' as const,
        name: 'setupGlobal',
        message: 'Setup global agents in ~/.claude/agents?',
        initial: true,
      },
      {
        type: 'confirm' as const,
        name: 'setupLocal',
        message: 'Setup project agents in .claude/agents?',
        initial: true,
      },
    ];
    
    const answers = await promptUser(questions);
    
    config = {
      ...config,
      companyName: answers.companyName || DEFAULT_CONFIG.companyName,
      platformDescription: answers.platformDescription || DEFAULT_CONFIG.platformDescription,
    };
    
    // Read templates from local .claude/agents directory
    const localTemplates = readAgentTemplates(config.localAgentsDir);
    
    if (answers.setupGlobal) {
      console.log('\n→ Setting up global agents...');
      generateAgents(localTemplates, config.globalAgentsDir, config);
      createAgentIndex(config.globalAgentsDir, config);
    }
    
    if (answers.setupLocal) {
      console.log('\n→ Setting up project agents...');
      if (localTemplates.length === 0) {
        console.log('⚠ No local templates found. Please ensure .claude/agents contains agent templates.');
      } else {
        createAgentIndex(config.localAgentsDir, config);
      }
    }
  } else {
    // Non-interactive mode: setup both global and local
    const localTemplates = readAgentTemplates(config.localAgentsDir);
    
    console.log('→ Setting up global agents...');
    generateAgents(localTemplates, config.globalAgentsDir, config);
    createAgentIndex(config.globalAgentsDir, config);
    
    console.log('\n→ Setting up project agents...');
    createAgentIndex(config.localAgentsDir, config);
  }
  
  // Save configuration
  saveConfiguration(config);
  
  console.log('\n═══ Agent Generation Complete! ═══\n');
  console.log(`✅ Agents configured for ${config.companyName}`);
  console.log(`📁 Global agents: ${config.globalAgentsDir}`);
  console.log(`📁 Project agents: ${config.localAgentsDir}`);
  console.log('\nNext steps:');
  console.log('  1. Review generated agent configurations');
  console.log('  2. Customize for your specific needs');
  console.log('  3. Use with Claude for role-specific assistance\n');
}

// Run the script
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});