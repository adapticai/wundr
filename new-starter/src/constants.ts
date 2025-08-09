export const TOOLS = {
  PERMISSIONS: 'permissions',
  BREW: 'brew',
  NODE: 'node',
  DOCKER: 'docker',
  GITHUB: 'github',
  VSCODE: 'vscode',
  SLACK: 'slack',
  CLAUDE: 'claude',
  CONFIG: 'config',
  PROFILE: 'profile',
} as const;

export const TOOL_GROUPS = {
  CORE: [TOOLS.PERMISSIONS, TOOLS.BREW, TOOLS.NODE],
  DEVELOPMENT: [TOOLS.GITHUB, TOOLS.VSCODE, TOOLS.CONFIG],
  COLLABORATION: [TOOLS.SLACK],
  AI: [TOOLS.CLAUDE],
  CONTAINERS: [TOOLS.DOCKER],
  PERSONALIZATION: [TOOLS.PROFILE],
} as const;

export const DEFAULT_CONFIG = {
  rootDir: '~/Development',
  skipPrompts: false,
  verbose: false,
  tools: Object.values(TOOLS),
} as const;

export const SCRIPT_PATHS = {
  [TOOLS.PERMISSIONS]: 'scripts/setup/01-permissions.sh',
  [TOOLS.BREW]: 'scripts/setup/02-brew.sh',
  [TOOLS.NODE]: 'scripts/setup/03-node-tools.sh',
  [TOOLS.DOCKER]: 'scripts/setup/04-docker.sh',
  [TOOLS.GITHUB]: 'scripts/setup/05-github.sh',
  [TOOLS.VSCODE]: 'scripts/setup/06-vscode.sh',
  [TOOLS.SLACK]: 'scripts/setup/07-slack.sh',
  [TOOLS.CLAUDE]: 'scripts/setup/08-claude.sh',
  [TOOLS.CONFIG]: 'scripts/setup/09-dev-config.sh',
  [TOOLS.PROFILE]: 'scripts/setup/12-profile-setup.sh',
} as const;