import chalk from 'chalk';
import inquirer from 'inquirer';
import type { SetupOptions } from '../types';
import { 
  type Questions,
  createInputQuestion,
  createCheckboxQuestion,
  createConfirmQuestion
} from '../types/inquirer';
import { asInquirerQuestions } from '../types/inquirer-helpers';

export async function promptForMissingInfo(options: SetupOptions): Promise<SetupOptions> {
  const questions: Questions = [];

  if (!options.email) {
    questions.push(createInputQuestion(
      'email',
      'What is your email address?',
      undefined,
      (input) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const email = String(input);
        return emailRegex.test(email) || 'Please enter a valid email address';
      }
    ));
  }

  if (!options.githubUsername) {
    questions.push(createInputQuestion(
      'githubUsername',
      'What is your GitHub username?',
      undefined,
      (input) => String(input).length > 0 || 'GitHub username is required'
    ));
  }

  if (!options.name) {
    questions.push(createInputQuestion(
      'name',
      'What is your full name?',
      undefined,
      (input) => String(input).length > 0 || 'Name is required'
    ));
  }

  if (!options.company) {
    questions.push(createInputQuestion(
      'company',
      'What is your company name? (optional)',
      ''
    ));
  }

  if (!options.rootDir) {
    questions.push(createInputQuestion(
      'rootDir',
      'Where should the development directory be created?',
      '~/Development'
    ));
  }

  if (!options.role) {
    questions.push(createInputQuestion(
      'role',
      'What is your role/position?',
      'Software Engineer'
    ));
  }

  if (!options.jobTitle) {
    questions.push(createInputQuestion(
      'jobTitle',
      'What is your job title description? (e.g., "Building scalable systems")',
      'Building amazing software'
    ));
  }

  const tools = await promptForTools();

  if (questions.length > 0) {
    console.log(chalk.cyan('\n📝 Please provide the following information:\n'));
    const answers = await inquirer.prompt(asInquirerQuestions(questions));
    return { ...options, ...answers, only: tools };
  }

  return { ...options, only: tools };
}

async function promptForTools(): Promise<string> {
  const question = createCheckboxQuestion(
    'tools',
    'Which tools would you like to install?',
    [
      { name: 'Homebrew (Package Manager)', value: 'brew', checked: true },
      { name: 'Node.js (via NVM)', value: 'node', checked: true },
      { name: 'Docker Desktop', value: 'docker', checked: true },
      { name: 'Git & GitHub CLI', value: 'github', checked: true },
      { name: 'VS Code & Extensions', value: 'vscode', checked: true },
      { name: 'Slack', value: 'slack', checked: false },
      { name: 'Claude & Claude Flow', value: 'claude', checked: true },
      { name: 'Development Config (ESLint, Prettier, etc)', value: 'config', checked: true },
      { name: 'Profile & Personalization (AI-generated photo, Mac customization)', value: 'profile', checked: true },
    ]
  );
  
  const { tools } = await inquirer.prompt(asInquirerQuestions([question]));

  // Ensure tools is an array of strings
  const toolsArray = Array.isArray(tools) ? tools as string[] : [];
  
  // Always include permissions as it's required
  if (!toolsArray.includes('permissions')) {
    toolsArray.unshift('permissions');
  }

  return toolsArray.join(',');
}

export async function confirmAction(message: string): Promise<boolean> {
  const question = createConfirmQuestion(
    'confirmed',
    message,
    true
  );
  
  const { confirmed } = await inquirer.prompt(asInquirerQuestions([question]));

  return confirmed as boolean;
}