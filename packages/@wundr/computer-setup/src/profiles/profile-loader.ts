/**
 * Profile Loader
 *
 * Loads built-in and custom developer profile definitions.
 * Each profile is a declarative list of tools with version pins,
 * platform overrides, and Claude Code conventions.
 *
 * @module profiles/profile-loader
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { Logger } from '../utils/logger';

import type {
  ProfileDefinition,
  ProfileManifest,
  ProfileOverride,
  ProfileType,
  ToolSpec,
} from './profile-types';

const logger = new Logger({ name: 'profile-loader' });

// ---------------------------------------------------------------------------
// Built-in profile definitions
// ---------------------------------------------------------------------------

const FRONTEND_PROFILE: ProfileDefinition = {
  type: 'frontend',
  displayName: 'Frontend Developer',
  description:
    'Modern web frontend development with React, Vue, Angular, and tooling',
  estimatedTimeMinutes: 20,
  tools: [
    // System
    tool('homebrew', 'Homebrew', 'system', true, [], {
      darwin: {
        supported: true,
        installCommand:
          '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
      },
      linux: {
        supported: true,
        installCommand:
          '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
      },
      win32: {
        supported: false,
        unsupportedReason: 'Use winget/chocolatey/scoop on Windows',
      },
    }),
    tool('git', 'Git', 'system', true, ['homebrew']),
    // Languages
    tool(
      'node',
      'Node.js',
      'language',
      true,
      ['homebrew'],
      {
        darwin: { supported: true, installCommand: 'brew install node@22' },
        linux: {
          supported: true,
          installCommand: 'brew install node@22',
          alternativeCommands: {
            apt: 'curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs',
            dnf: 'sudo dnf module install nodejs:22',
          },
        },
        win32: {
          supported: true,
          installCommand: 'winget install OpenJS.NodeJS.LTS',
        },
      },
      '22'
    ),
    tool(
      'typescript',
      'TypeScript',
      'language',
      true,
      ['node'],
      undefined,
      'latest'
    ),
    // Package managers
    tool(
      'pnpm',
      'pnpm',
      'package-manager',
      true,
      ['node'],
      undefined,
      'latest'
    ),
    // Frameworks (validation only, installed per-project)
    tool('vite', 'Vite', 'framework', false, ['node'], undefined, 'latest'),
    // Editors
    tool('vscode', 'Visual Studio Code', 'editor', true, ['homebrew'], {
      darwin: {
        supported: true,
        installCommand: 'brew install --cask visual-studio-code',
      },
      linux: {
        supported: true,
        installCommand: 'brew install --cask visual-studio-code',
        alternativeCommands: { apt: 'sudo snap install code --classic' },
      },
      win32: {
        supported: true,
        installCommand: 'winget install Microsoft.VisualStudioCode',
      },
    }),
    // AI
    tool('claude', 'Claude Code', 'ai', true, ['node'], {
      darwin: {
        supported: true,
        installCommand: 'npm install -g @anthropic-ai/claude-code',
      },
      linux: {
        supported: true,
        installCommand: 'npm install -g @anthropic-ai/claude-code',
      },
      win32: {
        supported: true,
        installCommand: 'npm install -g @anthropic-ai/claude-code',
      },
    }),
    // Utilities
    tool('eslint', 'ESLint', 'utility', false, ['node'], undefined, 'latest'),
    tool(
      'prettier',
      'Prettier',
      'utility',
      false,
      ['node'],
      undefined,
      'latest'
    ),
  ],
  extensions: [
    'dbaeumer.vscode-eslint',
    'esbenp.prettier-vscode',
    'bradlc.vscode-tailwindcss',
    'dsznajder.es7-react-js-snippets',
    'formulahendry.auto-rename-tag',
    'steoates.autoimport',
    'ms-vscode.vscode-typescript-next',
  ],
  globalPackages: {
    npm: ['pnpm', 'typescript', 'tsx', 'create-next-app', 'create-vite'],
  },
  claudeConventions: {
    recommendedAgents: ['coder', 'reviewer', 'tester', 'planner', 'researcher'],
    mcpTools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'WebFetch'],
    memoryArchitecture: 'tiered',
    skills: ['code-review', 'refactor', 'test-generation', 'documentation'],
    commands: ['review', 'test', 'fix'],
    claudeInstructions:
      'Focus on React/Next.js best practices, component architecture, accessibility, and responsive design.',
  },
};

const BACKEND_PROFILE: ProfileDefinition = {
  type: 'backend',
  displayName: 'Backend Developer',
  description:
    'Server-side development with Node.js, Python, Go, Rust, and databases',
  estimatedTimeMinutes: 30,
  tools: [
    tool('homebrew', 'Homebrew', 'system', true, [], {
      darwin: {
        supported: true,
        installCommand:
          '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
      },
      linux: {
        supported: true,
        installCommand:
          '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
      },
      win32: {
        supported: false,
        unsupportedReason: 'Use winget/chocolatey/scoop on Windows',
      },
    }),
    tool('git', 'Git', 'system', true, ['homebrew']),
    // Languages
    tool(
      'node',
      'Node.js',
      'language',
      true,
      ['homebrew'],
      {
        darwin: { supported: true, installCommand: 'brew install node@22' },
        linux: {
          supported: true,
          installCommand: 'brew install node@22',
          alternativeCommands: {
            apt: 'curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs',
          },
        },
        win32: {
          supported: true,
          installCommand: 'winget install OpenJS.NodeJS.LTS',
        },
      },
      '22'
    ),
    tool(
      'python',
      'Python',
      'language',
      true,
      ['homebrew'],
      {
        darwin: { supported: true, installCommand: 'brew install python@3.12' },
        linux: {
          supported: true,
          installCommand: 'brew install python@3.12',
          alternativeCommands: {
            apt: 'sudo apt install python3.12 python3.12-venv python3-pip',
            dnf: 'sudo dnf install python3.12',
          },
        },
        win32: {
          supported: true,
          installCommand: 'winget install Python.Python.3.12',
        },
      },
      '3.12'
    ),
    tool(
      'go',
      'Go',
      'language',
      false,
      ['homebrew'],
      {
        darwin: { supported: true, installCommand: 'brew install go' },
        linux: {
          supported: true,
          installCommand: 'brew install go',
          alternativeCommands: { apt: 'sudo apt install golang-go' },
        },
        win32: { supported: true, installCommand: 'winget install GoLang.Go' },
      },
      '1.22'
    ),
    tool(
      'rust',
      'Rust',
      'language',
      false,
      ['homebrew'],
      {
        darwin: {
          supported: true,
          installCommand:
            'curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y',
        },
        linux: {
          supported: true,
          installCommand:
            'curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y',
        },
        win32: {
          supported: true,
          installCommand: 'winget install Rustlang.Rustup',
        },
      },
      '1.77'
    ),
    // Package managers
    tool(
      'pnpm',
      'pnpm',
      'package-manager',
      true,
      ['node'],
      undefined,
      'latest'
    ),
    // Containers
    tool('docker', 'Docker', 'container', true, ['homebrew'], {
      darwin: { supported: true, installCommand: 'brew install --cask docker' },
      linux: {
        supported: true,
        installCommand: 'brew install docker',
        alternativeCommands: {
          apt: 'sudo apt install docker.io docker-compose-plugin',
        },
      },
      win32: {
        supported: true,
        installCommand: 'winget install Docker.DockerDesktop',
      },
    }),
    // Databases
    tool(
      'postgresql',
      'PostgreSQL',
      'database',
      false,
      ['homebrew'],
      {
        darwin: {
          supported: true,
          installCommand: 'brew install postgresql@16',
        },
        linux: {
          supported: true,
          installCommand: 'brew install postgresql@16',
          alternativeCommands: { apt: 'sudo apt install postgresql-16' },
        },
        win32: {
          supported: true,
          installCommand: 'winget install PostgreSQL.PostgreSQL.16',
        },
      },
      '16'
    ),
    tool('redis', 'Redis', 'database', false, ['homebrew'], {
      darwin: { supported: true, installCommand: 'brew install redis' },
      linux: {
        supported: true,
        installCommand: 'brew install redis',
        alternativeCommands: { apt: 'sudo apt install redis-server' },
      },
      win32: {
        supported: false,
        unsupportedReason: 'Use Redis via Docker on Windows',
      },
    }),
    // Editors
    tool('vscode', 'Visual Studio Code', 'editor', true, ['homebrew'], {
      darwin: {
        supported: true,
        installCommand: 'brew install --cask visual-studio-code',
      },
      linux: {
        supported: true,
        installCommand: 'brew install --cask visual-studio-code',
        alternativeCommands: { apt: 'sudo snap install code --classic' },
      },
      win32: {
        supported: true,
        installCommand: 'winget install Microsoft.VisualStudioCode',
      },
    }),
    // AI
    tool('claude', 'Claude Code', 'ai', true, ['node'], {
      darwin: {
        supported: true,
        installCommand: 'npm install -g @anthropic-ai/claude-code',
      },
      linux: {
        supported: true,
        installCommand: 'npm install -g @anthropic-ai/claude-code',
      },
      win32: {
        supported: true,
        installCommand: 'npm install -g @anthropic-ai/claude-code',
      },
    }),
  ],
  extensions: [
    'dbaeumer.vscode-eslint',
    'esbenp.prettier-vscode',
    'ms-python.python',
    'ms-python.vscode-pylance',
    'golang.go',
    'rust-lang.rust-analyzer',
    'ms-azuretools.vscode-docker',
    'ckolkman.vscode-postgres',
  ],
  globalPackages: {
    npm: ['pnpm', 'typescript', 'tsx', 'nodemon', 'pm2'],
    pip: ['virtualenv', 'black', 'ruff', 'mypy'],
  },
  claudeConventions: {
    recommendedAgents: ['coder', 'reviewer', 'tester', 'planner', 'researcher'],
    mcpTools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
    memoryArchitecture: 'tiered',
    skills: ['code-review', 'refactor', 'test-generation', 'documentation'],
    commands: ['review', 'test', 'fix'],
    claudeInstructions:
      'Focus on API design, database optimization, error handling, and server-side security best practices.',
  },
};

const FULLSTACK_PROFILE: ProfileDefinition = {
  type: 'fullstack',
  displayName: 'Full Stack Developer',
  description:
    'Complete development stack combining frontend and backend tools',
  estimatedTimeMinutes: 35,
  tools: [
    // Inherits all backend tools (which is the larger superset)
    ...BACKEND_PROFILE.tools,
    // Additional fullstack utilities
    tool('vite', 'Vite', 'framework', false, ['node'], undefined, 'latest'),
  ],
  extensions: [
    ...new Set([...FRONTEND_PROFILE.extensions, ...BACKEND_PROFILE.extensions]),
    'prisma.prisma',
    'graphql.vscode-graphql',
  ],
  globalPackages: {
    npm: [
      ...new Set([
        ...(FRONTEND_PROFILE.globalPackages.npm || []),
        ...(BACKEND_PROFILE.globalPackages.npm || []),
        'prisma',
      ]),
    ],
    pip: [...(BACKEND_PROFILE.globalPackages.pip || [])],
  },
  claudeConventions: {
    recommendedAgents: [
      'coder',
      'reviewer',
      'tester',
      'planner',
      'researcher',
      'pr-manager',
    ],
    mcpTools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'WebFetch'],
    memoryArchitecture: 'tiered',
    skills: ['code-review', 'refactor', 'test-generation', 'documentation'],
    commands: ['review', 'test', 'fix', 'deploy-monitor'],
    claudeInstructions:
      'Full-stack focus: consider both frontend UX and backend performance. Ensure API contracts are consistent, handle loading/error states, and test across the stack.',
  },
};

const DEVOPS_PROFILE: ProfileDefinition = {
  type: 'devops',
  displayName: 'DevOps Engineer',
  description:
    'Infrastructure and deployment tools with container orchestration, IaC, and CI/CD',
  estimatedTimeMinutes: 40,
  tools: [
    tool('homebrew', 'Homebrew', 'system', true, [], {
      darwin: {
        supported: true,
        installCommand:
          '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
      },
      linux: {
        supported: true,
        installCommand:
          '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
      },
      win32: {
        supported: false,
        unsupportedReason: 'Use winget/chocolatey/scoop on Windows',
      },
    }),
    tool('git', 'Git', 'system', true, ['homebrew']),
    // Languages
    tool(
      'python',
      'Python',
      'language',
      true,
      ['homebrew'],
      {
        darwin: { supported: true, installCommand: 'brew install python@3.12' },
        linux: {
          supported: true,
          installCommand: 'brew install python@3.12',
          alternativeCommands: {
            apt: 'sudo apt install python3.12 python3.12-venv python3-pip',
          },
        },
        win32: {
          supported: true,
          installCommand: 'winget install Python.Python.3.12',
        },
      },
      '3.12'
    ),
    tool(
      'go',
      'Go',
      'language',
      true,
      ['homebrew'],
      {
        darwin: { supported: true, installCommand: 'brew install go' },
        linux: {
          supported: true,
          installCommand: 'brew install go',
          alternativeCommands: { apt: 'sudo apt install golang-go' },
        },
        win32: { supported: true, installCommand: 'winget install GoLang.Go' },
      },
      '1.22'
    ),
    // Containers
    tool('docker', 'Docker', 'container', true, ['homebrew'], {
      darwin: { supported: true, installCommand: 'brew install --cask docker' },
      linux: {
        supported: true,
        installCommand: 'brew install docker',
        alternativeCommands: {
          apt: 'sudo apt install docker.io docker-compose-plugin',
        },
      },
      win32: {
        supported: true,
        installCommand: 'winget install Docker.DockerDesktop',
      },
    }),
    tool('kubectl', 'Kubernetes CLI', 'container', true, ['homebrew'], {
      darwin: { supported: true, installCommand: 'brew install kubectl' },
      linux: {
        supported: true,
        installCommand: 'brew install kubectl',
        alternativeCommands: { apt: 'sudo snap install kubectl --classic' },
      },
      win32: {
        supported: true,
        installCommand: 'winget install Kubernetes.kubectl',
      },
    }),
    tool('helm', 'Helm', 'container', true, ['homebrew', 'kubectl'], {
      darwin: { supported: true, installCommand: 'brew install helm' },
      linux: {
        supported: true,
        installCommand: 'brew install helm',
        alternativeCommands: { apt: 'sudo snap install helm --classic' },
      },
      win32: { supported: true, installCommand: 'winget install Helm.Helm' },
    }),
    // Infrastructure as Code
    tool('terraform', 'Terraform', 'cloud', true, ['homebrew'], {
      darwin: {
        supported: true,
        installCommand: 'brew install hashicorp/tap/terraform',
      },
      linux: {
        supported: true,
        installCommand: 'brew install hashicorp/tap/terraform',
        alternativeCommands: { apt: 'sudo apt install terraform' },
      },
      win32: {
        supported: true,
        installCommand: 'winget install Hashicorp.Terraform',
      },
    }),
    tool('ansible', 'Ansible', 'cloud', false, ['python'], {
      darwin: { supported: true, installCommand: 'pip3 install ansible' },
      linux: { supported: true, installCommand: 'pip3 install ansible' },
      win32: {
        supported: false,
        unsupportedReason:
          'Ansible does not natively support Windows as a control node',
      },
    }),
    // Cloud CLIs
    tool('awscli', 'AWS CLI', 'cloud', false, ['homebrew'], {
      darwin: { supported: true, installCommand: 'brew install awscli' },
      linux: {
        supported: true,
        installCommand: 'brew install awscli',
        alternativeCommands: { apt: 'sudo apt install awscli' },
      },
      win32: {
        supported: true,
        installCommand: 'winget install Amazon.AWSCLI',
      },
    }),
    tool('gcloud', 'Google Cloud CLI', 'cloud', false, ['homebrew'], {
      darwin: {
        supported: true,
        installCommand: 'brew install --cask google-cloud-sdk',
      },
      linux: {
        supported: true,
        installCommand: 'brew install --cask google-cloud-sdk',
      },
      win32: {
        supported: true,
        installCommand: 'winget install Google.CloudSDK',
      },
    }),
    // CI
    tool('gh', 'GitHub CLI', 'ci', true, ['homebrew'], {
      darwin: { supported: true, installCommand: 'brew install gh' },
      linux: {
        supported: true,
        installCommand: 'brew install gh',
        alternativeCommands: { apt: 'sudo apt install gh' },
      },
      win32: { supported: true, installCommand: 'winget install GitHub.cli' },
    }),
    // Monitoring
    tool('prometheus', 'Prometheus', 'monitoring', false, ['homebrew'], {
      darwin: { supported: true, installCommand: 'brew install prometheus' },
      linux: { supported: true, installCommand: 'brew install prometheus' },
      win32: {
        supported: false,
        unsupportedReason: 'Use Prometheus via Docker on Windows',
      },
    }),
    // Editors
    tool('vscode', 'Visual Studio Code', 'editor', true, ['homebrew'], {
      darwin: {
        supported: true,
        installCommand: 'brew install --cask visual-studio-code',
      },
      linux: {
        supported: true,
        installCommand: 'brew install --cask visual-studio-code',
        alternativeCommands: { apt: 'sudo snap install code --classic' },
      },
      win32: {
        supported: true,
        installCommand: 'winget install Microsoft.VisualStudioCode',
      },
    }),
    // AI
    tool('claude', 'Claude Code', 'ai', true, ['homebrew'], {
      darwin: {
        supported: true,
        installCommand: 'npm install -g @anthropic-ai/claude-code',
      },
      linux: {
        supported: true,
        installCommand: 'npm install -g @anthropic-ai/claude-code',
      },
      win32: {
        supported: true,
        installCommand: 'npm install -g @anthropic-ai/claude-code',
      },
    }),
  ],
  extensions: [
    'ms-python.python',
    'golang.go',
    'ms-azuretools.vscode-docker',
    'ms-kubernetes-tools.vscode-kubernetes-tools',
    'hashicorp.terraform',
    'redhat.vscode-yaml',
    'github.vscode-github-actions',
  ],
  globalPackages: {
    pip: ['ansible-lint', 'boto3', 'black', 'ruff'],
  },
  claudeConventions: {
    recommendedAgents: [
      'coder',
      'reviewer',
      'planner',
      'deployment-monitor',
      'log-analyzer',
    ],
    mcpTools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
    memoryArchitecture: 'tiered',
    skills: ['code-review', 'documentation'],
    commands: ['review', 'fix', 'deploy-monitor'],
    claudeInstructions:
      'Focus on infrastructure reliability, immutable deployments, GitOps workflows, and monitoring. Always consider security, cost optimization, and disaster recovery.',
  },
};

const DATA_SCIENCE_PROFILE: ProfileDefinition = {
  type: 'data-science',
  displayName: 'Data Scientist / ML Engineer',
  description:
    'Python-centric data science and ML development with Jupyter, GPU frameworks, and experiment tracking',
  estimatedTimeMinutes: 35,
  tools: [
    tool('homebrew', 'Homebrew', 'system', true, [], {
      darwin: {
        supported: true,
        installCommand:
          '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
      },
      linux: {
        supported: true,
        installCommand:
          '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
      },
      win32: {
        supported: false,
        unsupportedReason: 'Use winget/chocolatey on Windows',
      },
    }),
    tool('git', 'Git', 'system', true, ['homebrew']),
    // Languages
    tool(
      'python',
      'Python',
      'language',
      true,
      ['homebrew'],
      {
        darwin: { supported: true, installCommand: 'brew install python@3.12' },
        linux: {
          supported: true,
          installCommand: 'brew install python@3.12',
          alternativeCommands: {
            apt: 'sudo apt install python3.12 python3.12-venv python3-pip',
          },
        },
        win32: {
          supported: true,
          installCommand: 'winget install Python.Python.3.12',
        },
      },
      '3.12'
    ),
    tool(
      'node',
      'Node.js',
      'language',
      false,
      ['homebrew'],
      {
        darwin: { supported: true, installCommand: 'brew install node@22' },
        linux: { supported: true, installCommand: 'brew install node@22' },
        win32: {
          supported: true,
          installCommand: 'winget install OpenJS.NodeJS.LTS',
        },
      },
      '22'
    ),
    // Data science tools
    tool('jupyter', 'Jupyter', 'data-science', true, ['python'], {
      darwin: {
        supported: true,
        installCommand: 'pip3 install jupyterlab notebook',
      },
      linux: {
        supported: true,
        installCommand: 'pip3 install jupyterlab notebook',
      },
      win32: {
        supported: true,
        installCommand: 'pip install jupyterlab notebook',
      },
    }),
    tool('conda', 'Miniconda', 'data-science', false, ['homebrew'], {
      darwin: {
        supported: true,
        installCommand: 'brew install --cask miniconda',
      },
      linux: {
        supported: true,
        installCommand:
          'mkdir -p ~/miniconda3 && wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O ~/miniconda3/miniconda.sh && bash ~/miniconda3/miniconda.sh -b -u -p ~/miniconda3',
      },
      win32: {
        supported: true,
        installCommand: 'winget install Anaconda.Miniconda3',
      },
    }),
    tool(
      'dvc',
      'DVC (Data Version Control)',
      'data-science',
      false,
      ['python'],
      {
        darwin: { supported: true, installCommand: 'pip3 install dvc' },
        linux: { supported: true, installCommand: 'pip3 install dvc' },
        win32: { supported: true, installCommand: 'pip install dvc' },
      }
    ),
    // Containers (for reproducible environments)
    tool('docker', 'Docker', 'container', true, ['homebrew'], {
      darwin: { supported: true, installCommand: 'brew install --cask docker' },
      linux: {
        supported: true,
        installCommand: 'brew install docker',
        alternativeCommands: { apt: 'sudo apt install docker.io' },
      },
      win32: {
        supported: true,
        installCommand: 'winget install Docker.DockerDesktop',
      },
    }),
    // Editors
    tool('vscode', 'Visual Studio Code', 'editor', true, ['homebrew'], {
      darwin: {
        supported: true,
        installCommand: 'brew install --cask visual-studio-code',
      },
      linux: {
        supported: true,
        installCommand: 'brew install --cask visual-studio-code',
        alternativeCommands: { apt: 'sudo snap install code --classic' },
      },
      win32: {
        supported: true,
        installCommand: 'winget install Microsoft.VisualStudioCode',
      },
    }),
    // AI
    tool('claude', 'Claude Code', 'ai', true, ['homebrew'], {
      darwin: {
        supported: true,
        installCommand: 'npm install -g @anthropic-ai/claude-code',
      },
      linux: {
        supported: true,
        installCommand: 'npm install -g @anthropic-ai/claude-code',
      },
      win32: {
        supported: true,
        installCommand: 'npm install -g @anthropic-ai/claude-code',
      },
    }),
  ],
  extensions: [
    'ms-python.python',
    'ms-python.vscode-pylance',
    'ms-toolsai.jupyter',
    'ms-toolsai.vscode-jupyter-cell-tags',
    'ms-toolsai.vscode-jupyter-slideshow',
    'ms-azuretools.vscode-docker',
    'iterative.dvc',
  ],
  globalPackages: {
    pip: [
      'numpy',
      'pandas',
      'scikit-learn',
      'matplotlib',
      'seaborn',
      'jupyterlab',
      'notebook',
      'ipykernel',
      'torch',
      'tensorflow',
      'transformers',
      'mlflow',
      'wandb',
      'dvc',
      'black',
      'ruff',
      'mypy',
    ],
  },
  claudeConventions: {
    recommendedAgents: ['coder', 'reviewer', 'researcher', 'planner'],
    mcpTools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'WebSearch'],
    memoryArchitecture: 'tiered',
    skills: ['code-review', 'documentation', 'test-generation'],
    commands: ['review', 'test'],
    claudeInstructions:
      'Focus on data pipeline correctness, experiment reproducibility, model evaluation rigor, and clear visualization. Prefer vectorized operations over loops. Document data assumptions.',
  },
};

const MOBILE_PROFILE: ProfileDefinition = {
  type: 'mobile',
  displayName: 'Mobile Developer',
  description:
    'Cross-platform and native mobile development with React Native, Flutter, Swift, and Kotlin',
  estimatedTimeMinutes: 40,
  tools: [
    tool('homebrew', 'Homebrew', 'system', true, [], {
      darwin: {
        supported: true,
        installCommand:
          '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
      },
      linux: {
        supported: true,
        installCommand:
          '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
      },
      win32: {
        supported: false,
        unsupportedReason: 'Use winget/chocolatey on Windows',
      },
    }),
    tool('git', 'Git', 'system', true, ['homebrew']),
    // Languages
    tool(
      'node',
      'Node.js',
      'language',
      true,
      ['homebrew'],
      {
        darwin: { supported: true, installCommand: 'brew install node@22' },
        linux: { supported: true, installCommand: 'brew install node@22' },
        win32: {
          supported: true,
          installCommand: 'winget install OpenJS.NodeJS.LTS',
        },
      },
      '22'
    ),
    tool(
      'typescript',
      'TypeScript',
      'language',
      true,
      ['node'],
      undefined,
      'latest'
    ),
    // Mobile SDKs
    tool('xcode-cli', 'Xcode Command Line Tools', 'mobile', true, [], {
      darwin: { supported: true, installCommand: 'xcode-select --install' },
      linux: { supported: false, unsupportedReason: 'Xcode is macOS-only' },
      win32: { supported: false, unsupportedReason: 'Xcode is macOS-only' },
    }),
    tool('cocoapods', 'CocoaPods', 'mobile', false, ['xcode-cli'], {
      darwin: { supported: true, installCommand: 'brew install cocoapods' },
      linux: { supported: false, unsupportedReason: 'CocoaPods is macOS-only' },
      win32: { supported: false, unsupportedReason: 'CocoaPods is macOS-only' },
    }),
    tool('flutter', 'Flutter SDK', 'mobile', false, ['homebrew'], {
      darwin: {
        supported: true,
        installCommand: 'brew install --cask flutter',
      },
      linux: {
        supported: true,
        installCommand: 'sudo snap install flutter --classic',
      },
      win32: {
        supported: true,
        installCommand: 'winget install Google.Flutter',
      },
    }),
    tool('android-studio', 'Android Studio', 'mobile', false, ['homebrew'], {
      darwin: {
        supported: true,
        installCommand: 'brew install --cask android-studio',
      },
      linux: {
        supported: true,
        installCommand: 'sudo snap install android-studio --classic',
      },
      win32: {
        supported: true,
        installCommand: 'winget install Google.AndroidStudio',
      },
    }),
    tool('fastlane', 'Fastlane', 'mobile', false, ['homebrew'], {
      darwin: { supported: true, installCommand: 'brew install fastlane' },
      linux: { supported: true, installCommand: 'sudo gem install fastlane' },
      win32: {
        supported: false,
        unsupportedReason: 'Fastlane has limited Windows support',
      },
    }),
    // Package managers
    tool(
      'pnpm',
      'pnpm',
      'package-manager',
      true,
      ['node'],
      undefined,
      'latest'
    ),
    // Editors
    tool('vscode', 'Visual Studio Code', 'editor', true, ['homebrew'], {
      darwin: {
        supported: true,
        installCommand: 'brew install --cask visual-studio-code',
      },
      linux: {
        supported: true,
        installCommand: 'brew install --cask visual-studio-code',
        alternativeCommands: { apt: 'sudo snap install code --classic' },
      },
      win32: {
        supported: true,
        installCommand: 'winget install Microsoft.VisualStudioCode',
      },
    }),
    // AI
    tool('claude', 'Claude Code', 'ai', true, ['node'], {
      darwin: {
        supported: true,
        installCommand: 'npm install -g @anthropic-ai/claude-code',
      },
      linux: {
        supported: true,
        installCommand: 'npm install -g @anthropic-ai/claude-code',
      },
      win32: {
        supported: true,
        installCommand: 'npm install -g @anthropic-ai/claude-code',
      },
    }),
  ],
  extensions: [
    'dbaeumer.vscode-eslint',
    'esbenp.prettier-vscode',
    'msjsdiag.vscode-react-native',
    'dart-code.flutter',
    'dart-code.dart-code',
    'mathiasfrohlich.Kotlin',
    'nickmillerdev.swift-essentials',
  ],
  globalPackages: {
    npm: [
      'pnpm',
      'typescript',
      'tsx',
      'react-native-cli',
      'expo-cli',
      'eas-cli',
    ],
  },
  claudeConventions: {
    recommendedAgents: ['coder', 'reviewer', 'tester', 'planner', 'researcher'],
    mcpTools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
    memoryArchitecture: 'tiered',
    skills: ['code-review', 'refactor', 'test-generation'],
    commands: ['review', 'test', 'fix'],
    claudeInstructions:
      'Focus on cross-platform compatibility, responsive layouts, native performance, accessibility, and offline-first patterns. Test on both iOS and Android.',
  },
};

// ---------------------------------------------------------------------------
// Built-in registry
// ---------------------------------------------------------------------------

const BUILTIN_PROFILES: Map<ProfileType, ProfileDefinition> = new Map([
  ['frontend', FRONTEND_PROFILE],
  ['backend', BACKEND_PROFILE],
  ['fullstack', FULLSTACK_PROFILE],
  ['devops', DEVOPS_PROFILE],
  ['data-science', DATA_SCIENCE_PROFILE],
  ['mobile', MOBILE_PROFILE],
]);

// ---------------------------------------------------------------------------
// Helper to construct ToolSpec concisely
// ---------------------------------------------------------------------------

function tool(
  name: string,
  displayName: string,
  category: ToolSpec['category'],
  required: boolean,
  dependencies: string[],
  platformOverrides?: ToolSpec['platformOverrides'],
  version?: string
): ToolSpec {
  const spec: ToolSpec = {
    name,
    displayName,
    category,
    required,
    dependencies: dependencies.length > 0 ? dependencies : undefined,
    validateCommand: `${name} --version`,
  };
  if (version) {
    spec.version = version;
  }
  if (platformOverrides) {
    spec.platformOverrides = platformOverrides;
  }
  return spec;
}

// ---------------------------------------------------------------------------
// ProfileLoader class
// ---------------------------------------------------------------------------

/**
 * Loads built-in and custom profile definitions.
 */
export class ProfileLoader {
  private customProfilesDir: string;

  constructor(customProfilesDir?: string) {
    this.customProfilesDir =
      customProfilesDir || path.join(os.homedir(), '.wundr', 'profiles');
  }

  /**
   * Load a built-in profile definition by type.
   */
  getBuiltinProfile(type: ProfileType): ProfileDefinition | null {
    return BUILTIN_PROFILES.get(type) || null;
  }

  /**
   * Return all built-in profile types.
   */
  getBuiltinProfileTypes(): ProfileType[] {
    return Array.from(BUILTIN_PROFILES.keys());
  }

  /**
   * Return all built-in profile definitions.
   */
  getAllBuiltinProfiles(): ProfileDefinition[] {
    return Array.from(BUILTIN_PROFILES.values());
  }

  /**
   * Load a custom profile from the user's profiles directory.
   * Returns null if the profile file does not exist.
   */
  async loadCustomProfile(name: string): Promise<ProfileDefinition | null> {
    const filePath = path.join(this.customProfilesDir, `${name}.json`);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content) as ProfileDefinition;
      logger.info(`Loaded custom profile: ${name}`);
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * List all custom profiles stored on disk.
   */
  async listCustomProfiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.customProfilesDir);
      return files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace(/\.json$/, ''));
    } catch {
      return [];
    }
  }

  /**
   * Save a profile definition to the custom profiles directory.
   */
  async saveCustomProfile(profile: ProfileDefinition): Promise<void> {
    await fs.mkdir(this.customProfilesDir, { recursive: true });
    const filePath = path.join(this.customProfilesDir, `${profile.type}.json`);
    await fs.writeFile(filePath, JSON.stringify(profile, null, 2));
    logger.info(`Saved custom profile: ${profile.type}`);
  }

  /**
   * Load a profile, checking custom profiles first, then built-in.
   */
  async loadProfile(type: ProfileType): Promise<ProfileDefinition | null> {
    // Custom profiles take precedence
    const custom = await this.loadCustomProfile(type);
    if (custom) {
      return custom;
    }
    return this.getBuiltinProfile(type);
  }

  /**
   * Apply an override on top of a base profile definition.
   * Returns a new ProfileDefinition (does not mutate the original).
   */
  applyOverride(
    base: ProfileDefinition,
    override: ProfileOverride
  ): ProfileDefinition {
    let tools = [...base.tools];

    // Remove tools
    if (override.removeTools && override.removeTools.length > 0) {
      const removeSet = new Set(override.removeTools);
      tools = tools.filter(t => !removeSet.has(t.name));
    }

    // Add tools
    if (override.addTools && override.addTools.length > 0) {
      const existingNames = new Set(tools.map(t => t.name));
      for (const addTool of override.addTools) {
        if (!existingNames.has(addTool.name)) {
          tools.push(addTool);
        }
      }
    }

    // Apply version pins
    if (override.versionPins) {
      for (const [toolName, version] of Object.entries(override.versionPins)) {
        const existing = tools.find(t => t.name === toolName);
        if (existing) {
          existing.version = version;
        }
      }
    }

    // Extensions
    let extensions = [...base.extensions];
    if (override.removeExtensions && override.removeExtensions.length > 0) {
      const removeSet = new Set(override.removeExtensions);
      extensions = extensions.filter(e => !removeSet.has(e));
    }
    if (override.addExtensions && override.addExtensions.length > 0) {
      const existingSet = new Set(extensions);
      for (const ext of override.addExtensions) {
        if (!existingSet.has(ext)) {
          extensions.push(ext);
        }
      }
    }

    // Global packages
    const globalPackages: Record<string, string[]> = {};
    for (const [ecosystem, packages] of Object.entries(base.globalPackages)) {
      globalPackages[ecosystem] = [...packages];
    }
    if (override.addGlobalPackages) {
      for (const [ecosystem, packages] of Object.entries(
        override.addGlobalPackages
      )) {
        if (!globalPackages[ecosystem]) {
          globalPackages[ecosystem] = [];
        }
        const existing = new Set(globalPackages[ecosystem]);
        for (const pkg of packages) {
          if (!existing.has(pkg)) {
            globalPackages[ecosystem].push(pkg);
          }
        }
      }
    }

    // Claude conventions
    const claudeConventions = override.claudeConventions
      ? { ...base.claudeConventions, ...override.claudeConventions }
      : { ...base.claudeConventions };

    return {
      ...base,
      tools,
      extensions,
      globalPackages,
      claudeConventions,
    };
  }

  /**
   * Import a profile manifest (team-shared configuration).
   * Resolves base profiles and applies the manifest's overrides.
   */
  async importManifest(manifest: ProfileManifest): Promise<ProfileDefinition> {
    logger.info(`Importing manifest: ${manifest.name}`);

    // For manifests, we compose the base profiles first, then apply overrides.
    // This method returns a single ProfileDefinition; composition is handled
    // by ProfileComposer. Here we just resolve the first base profile and
    // apply overrides.
    const baseType = manifest.baseProfiles[0];
    if (!baseType) {
      throw new Error('Manifest must specify at least one base profile');
    }

    const base = await this.loadProfile(baseType);
    if (!base) {
      throw new Error(`Base profile not found: ${baseType}`);
    }

    return this.applyOverride(base, manifest.overrides);
  }

  /**
   * Export a profile definition as a shareable manifest.
   */
  exportManifest(
    profile: ProfileDefinition,
    name: string,
    description: string,
    overrides?: ProfileOverride
  ): ProfileManifest {
    const now = new Date().toISOString();
    const manifestData = {
      version: '2.0.0',
      name,
      description,
      createdAt: now,
      updatedAt: now,
      baseProfiles: [profile.type],
      overrides: overrides || {
        addTools: [],
        removeTools: [],
        versionPins: {},
      },
    };

    // Compute checksum from the canonical JSON (excluding the checksum field)
    const canonicalJson = JSON.stringify(manifestData, null, 2);
    const checksum = computeSimpleChecksum(canonicalJson);

    return {
      ...manifestData,
      checksum: `sha256:${checksum}`,
    };
  }
}

/**
 * Simple checksum implementation.
 * In production this would use crypto.createHash('sha256').
 */
function computeSimpleChecksum(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export default ProfileLoader;
