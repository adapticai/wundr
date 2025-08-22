/**
 * Configuration Service for Developer Setup
 * Handles configuration of various tools and environments
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { getLogger } from '../utils/logger';
import { 
  DeveloperProfile, 
  GitConfiguration, 
  AIToolsConfiguration,
  SetupStep,
  ConfigurationChange 
} from '../types';

const logger = getLogger('computer-setup:configurator');

export class ConfiguratorService {
  private configChanges: ConfigurationChange[] = [];
  private backupDir: string;

  constructor() {
    this.backupDir = path.join(os.homedir(), '.wundr', 'backups');
    this.ensureBackupDirectory();
  }

  private async ensureBackupDirectory(): Promise<void> {
    await fs.ensureDir(this.backupDir);
  }

  async initialize(): Promise<void> {
    logger.info('Configurator service initialized');
  }

  /**
   * Get Git configuration steps
   */
  async getGitConfigSteps(config: GitConfiguration): Promise<SetupStep[]> {
    const steps: SetupStep[] = [];

    steps.push({
      id: 'git-user-config',
      name: 'Configure Git user',
      description: 'Set Git user name and email',
      category: 'configuration',
      required: true,
      dependencies: [],
      estimatedTime: 5,
      installer: async () => {
        await this.configureGitUser(config);
      }
    });

    if (config.signCommits) {
      steps.push({
        id: 'git-gpg-signing',
        name: 'Configure GPG signing',
        description: 'Set up commit signing with GPG',
        category: 'configuration',
        required: false,
        dependencies: ['git-user-config'],
        estimatedTime: 30,
        installer: async () => {
          await this.configureGPGSigning(config);
        }
      });
    }

    if (config.sshKey) {
      steps.push({
        id: 'git-ssh-key',
        name: 'Configure SSH key',
        description: 'Set up SSH key for Git',
        category: 'configuration',
        required: false,
        dependencies: ['git-user-config'],
        estimatedTime: 20,
        installer: async () => {
          await this.configureSSHKey(config);
        }
      });
    }

    steps.push({
      id: 'git-aliases',
      name: 'Configure Git aliases',
      description: 'Set up useful Git aliases',
      category: 'configuration',
      required: false,
      dependencies: ['git-user-config'],
      estimatedTime: 5,
      installer: async () => {
        await this.configureGitAliases(config.aliases);
      }
    });

    return steps;
  }

  /**
   * Get editor configuration steps
   */
  async getEditorSteps(editor: string): Promise<SetupStep[]> {
    const steps: SetupStep[] = [];

    switch (editor) {
      case 'vscode':
        steps.push({
          id: 'vscode-settings',
          name: 'Configure VS Code',
          description: 'Set up VS Code settings and extensions',
          category: 'configuration',
          required: false,
          dependencies: [],
          estimatedTime: 60,
          installer: async () => {
            await this.configureVSCode();
          }
        });
        break;

      case 'vim':
      case 'neovim':
        steps.push({
          id: 'vim-config',
          name: `Configure ${editor}`,
          description: `Set up ${editor} configuration`,
          category: 'configuration',
          required: false,
          dependencies: [],
          estimatedTime: 30,
          installer: async () => {
            await this.configureVim(editor);
          }
        });
        break;

      case 'sublime':
        steps.push({
          id: 'sublime-config',
          name: 'Configure Sublime Text',
          description: 'Set up Sublime Text preferences',
          category: 'configuration',
          required: false,
          dependencies: [],
          estimatedTime: 20,
          installer: async () => {
            await this.configureSublime();
          }
        });
        break;
    }

    return steps;
  }

  /**
   * Configure Git user
   */
  private async configureGitUser(config: GitConfiguration): Promise<void> {
    logger.info('Configuring Git user');

    const commands = [
      `git config --global user.name "${config.userName}"`,
      `git config --global user.email "${config.userEmail}"`,
      `git config --global init.defaultBranch "${config.defaultBranch || 'main'}"`
    ];

    for (const cmd of commands) {
      execSync(cmd);
    }

    this.recordConfigChange('~/.gitconfig', ['user.name', 'user.email', 'init.defaultBranch']);
  }

  /**
   * Configure GPG signing
   */
  private async configureGPGSigning(config: GitConfiguration): Promise<void> {
    logger.info('Configuring GPG signing');

    if (!config.gpgKey) {
      // Generate a new GPG key
      logger.info('Generating new GPG key');
      // This would involve interactive GPG key generation
      // For now, we'll skip the actual generation
      return;
    }

    execSync(`git config --global user.signingkey ${config.gpgKey}`);
    execSync('git config --global commit.gpgsign true');

    this.recordConfigChange('~/.gitconfig', ['user.signingkey', 'commit.gpgsign']);
  }

  /**
   * Configure SSH key
   */
  private async configureSSHKey(config: GitConfiguration): Promise<void> {
    logger.info('Configuring SSH key');

    const sshDir = path.join(os.homedir(), '.ssh');
    await fs.ensureDir(sshDir);

    if (!config.sshKey) {
      // Generate a new SSH key
      const keyPath = path.join(sshDir, 'id_ed25519');
      if (!await fs.pathExists(keyPath)) {
        execSync(`ssh-keygen -t ed25519 -C "${config.userEmail}" -f ${keyPath} -N ""`);
        logger.info('Generated new SSH key');
      }
    }

    // Add to SSH agent
    try {
      execSync('eval "$(ssh-agent -s)"');
      execSync(`ssh-add ${path.join(sshDir, 'id_ed25519')}`);
    } catch (error) {
      logger.warn('Could not add SSH key to agent', error);
    }

    this.recordConfigChange('~/.ssh/', ['id_ed25519', 'id_ed25519.pub']);
  }

  /**
   * Configure Git aliases
   */
  private async configureGitAliases(aliases: Record<string, string>): Promise<void> {
    logger.info('Configuring Git aliases');

    for (const [alias, command] of Object.entries(aliases)) {
      execSync(`git config --global alias.${alias} "${command}"`);
    }

    this.recordConfigChange('~/.gitconfig', Object.keys(aliases).map(a => `alias.${a}`));
  }

  /**
   * Configure VS Code
   */
  async configureVSCode(): Promise<void> {
    logger.info('Configuring VS Code');

    const settingsPath = this.getVSCodeSettingsPath();
    const settings = {
      'editor.fontSize': 14,
      'editor.fontFamily': "'Fira Code', 'Cascadia Code', Consolas, monospace",
      'editor.fontLigatures': true,
      'editor.formatOnSave': true,
      'editor.minimap.enabled': false,
      'editor.rulers': [80, 120],
      'editor.tabSize': 2,
      'editor.wordWrap': 'on',
      'files.autoSave': 'afterDelay',
      'files.autoSaveDelay': 1000,
      'workbench.colorTheme': 'Dark+ (default dark)',
      'terminal.integrated.fontSize': 14,
      'git.autofetch': true,
      'git.confirmSync': false,
      'typescript.updateImportsOnFileMove.enabled': 'always',
      'editor.codeActionsOnSave': {
        'source.organizeImports': true,
        'source.fixAll.eslint': true
      }
    };

    await fs.ensureDir(path.dirname(settingsPath));
    await fs.writeJson(settingsPath, settings, { spaces: 2 });

    this.recordConfigChange(settingsPath, ['VS Code settings']);
  }

  /**
   * Install VS Code extensions
   */
  async installVSCodeExtensions(): Promise<void> {
    logger.info('Installing VS Code extensions');

    const extensions = [
      'dbaeumer.vscode-eslint',
      'esbenp.prettier-vscode',
      'ms-vscode.vscode-typescript-tslint-plugin',
      'christian-kohler.path-intellisense',
      'christian-kohler.npm-intellisense',
      'formulahendry.auto-rename-tag',
      'formulahendry.auto-close-tag',
      'eamodio.gitlens',
      'github.copilot',
      'github.copilot-chat',
      'ms-azuretools.vscode-docker',
      'ms-vscode-remote.remote-containers',
      'bradlc.vscode-tailwindcss',
      'prisma.prisma',
      'graphql.vscode-graphql',
      'mikestead.dotenv',
      'usernamehw.errorlens'
    ];

    for (const ext of extensions) {
      try {
        execSync(`code --install-extension ${ext}`);
        logger.info(`Installed extension: ${ext}`);
      } catch (error) {
        logger.warn(`Failed to install extension: ${ext}`, error);
      }
    }
  }

  /**
   * Configure Vim/Neovim
   */
  private async configureVim(editor: string): Promise<void> {
    logger.info(`Configuring ${editor}`);

    const vimrc = `
" Basic settings
set number
set relativenumber
set tabstop=2
set shiftwidth=2
set expandtab
set autoindent
set smartindent
set nowrap
set ignorecase
set smartcase
set incsearch
set hlsearch
set mouse=a
set clipboard=unnamedplus
set encoding=utf-8
set fileencoding=utf-8
set termguicolors
set background=dark

" Key mappings
let mapleader = " "
nnoremap <leader>w :w<CR>
nnoremap <leader>q :q<CR>
nnoremap <leader>e :Explore<CR>

" Plugin manager (vim-plug)
call plug#begin('~/.vim/plugged')
Plug 'tpope/vim-sensible'
Plug 'tpope/vim-fugitive'
Plug 'tpope/vim-surround'
Plug 'tpope/vim-commentary'
Plug 'preservim/nerdtree'
Plug 'vim-airline/vim-airline'
Plug 'morhetz/gruvbox'
Plug 'neoclide/coc.nvim', {'branch': 'release'}
call plug#end()

" Color scheme
colorscheme gruvbox
`;

    const configPath = editor === 'neovim' 
      ? path.join(os.homedir(), '.config', 'nvim', 'init.vim')
      : path.join(os.homedir(), '.vimrc');

    await fs.ensureDir(path.dirname(configPath));
    await fs.writeFile(configPath, vimrc);

    this.recordConfigChange(configPath, ['Vim configuration']);
  }

  /**
   * Configure Sublime Text
   */
  private async configureSublime(): Promise<void> {
    logger.info('Configuring Sublime Text');

    const settings = {
      'font_size': 14,
      'font_face': 'Fira Code',
      'theme': 'Default Dark.sublime-theme',
      'color_scheme': 'Monokai.sublime-color-scheme',
      'tab_size': 2,
      'translate_tabs_to_spaces': true,
      'trim_trailing_white_space_on_save': true,
      'ensure_newline_at_eof_on_save': true,
      'save_on_focus_lost': true,
      'rulers': [80, 120],
      'word_wrap': true
    };

    const settingsPath = this.getSublimeSettingsPath();
    await fs.ensureDir(path.dirname(settingsPath));
    await fs.writeJson(settingsPath, settings, { spaces: 2 });

    this.recordConfigChange(settingsPath, ['Sublime Text settings']);
  }

  /**
   * Generate shell configuration
   */
  async generateShellConfig(profile: DeveloperProfile): Promise<void> {
    logger.info('Generating shell configuration');

    const shell = profile.preferences.shell;
    const rcFile = this.getShellRcFile(shell);
    
    const config = `
# Wundr Computer Setup Configuration
# Generated: ${new Date().toISOString()}

# Environment variables
export EDITOR="${profile.preferences.editor}"
export WUNDR_PROFILE="${profile.name}"

# Aliases
alias ll="ls -la"
alias gs="git status"
alias gc="git commit"
alias gp="git push"
alias gl="git pull"
alias wundr="npx wundr"

# Node.js configuration
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# pnpm configuration
export PNPM_HOME="$HOME/.pnpm"
export PATH="$PNPM_HOME:$PATH"

# Claude Flow configuration
export CLAUDE_FLOW_MEMORY="${profile.preferences.aiTools.memoryAllocation}"

# Custom functions
function mkcd() {
  mkdir -p "$1" && cd "$1"
}

function serve() {
  python -m http.server \${1:-8000}
}
`;

    const rcPath = path.join(os.homedir(), rcFile);
    
    // Backup existing file
    if (await fs.pathExists(rcPath)) {
      const backupPath = path.join(this.backupDir, `${rcFile}.${Date.now()}`);
      await fs.copy(rcPath, backupPath);
    }

    // Append configuration
    await fs.appendFile(rcPath, config);

    this.recordConfigChange(rcPath, ['Shell configuration']);
  }

  /**
   * Clone team repositories
   */
  async cloneTeamRepos(team: string): Promise<void> {
    logger.info(`Cloning repositories for team: ${team}`);

    // This would fetch team configuration and clone repos
    // For now, we'll create a workspace directory
    const workspaceDir = path.join(os.homedir(), 'workspace', team);
    await fs.ensureDir(workspaceDir);

    logger.info(`Created workspace directory: ${workspaceDir}`);
  }

  /**
   * Configure Claude Flow
   */
  async configureClaudeFlow(aiTools: AIToolsConfiguration): Promise<void> {
    logger.info('Configuring Claude Flow');

    const config = {
      memoryAllocation: aiTools.memoryAllocation,
      mcpTools: aiTools.mcpTools,
      swarmAgents: aiTools.swarmAgents,
      claudeCode: aiTools.claudeCode,
      claudeFlow: aiTools.claudeFlow
    };

    const configPath = path.join(os.homedir(), '.claude-flow', 'config.json');
    await fs.ensureDir(path.dirname(configPath));
    await fs.writeJson(configPath, config, { spaces: 2 });

    this.recordConfigChange(configPath, ['Claude Flow configuration']);
  }

  /**
   * Get configuration changes
   */
  getConfigurationChanges(): ConfigurationChange[] {
    return this.configChanges;
  }

  /**
   * Record a configuration change
   */
  private recordConfigChange(file: string, changes: string[], backup?: string): void {
    this.configChanges.push({
      file,
      changes,
      backup: backup || undefined
    });
  }

  /**
   * Get VS Code settings path
   */
  private getVSCodeSettingsPath(): string {
    switch (process.platform) {
      case 'darwin':
        return path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'settings.json');
      case 'linux':
        return path.join(os.homedir(), '.config', 'Code', 'User', 'settings.json');
      case 'win32':
        return path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User', 'settings.json');
      default:
        return path.join(os.homedir(), '.vscode', 'settings.json');
    }
  }

  /**
   * Get Sublime Text settings path
   */
  private getSublimeSettingsPath(): string {
    switch (process.platform) {
      case 'darwin':
        return path.join(os.homedir(), 'Library', 'Application Support', 'Sublime Text', 'Packages', 'User', 'Preferences.sublime-settings');
      case 'linux':
        return path.join(os.homedir(), '.config', 'sublime-text', 'Packages', 'User', 'Preferences.sublime-settings');
      case 'win32':
        return path.join(os.homedir(), 'AppData', 'Roaming', 'Sublime Text', 'Packages', 'User', 'Preferences.sublime-settings');
      default:
        return path.join(os.homedir(), '.sublime', 'Preferences.sublime-settings');
    }
  }

  /**
   * Get shell RC file
   */
  private getShellRcFile(shell: string): string {
    switch (shell) {
      case 'bash':
        return '.bashrc';
      case 'zsh':
        return '.zshrc';
      case 'fish':
        return '.config/fish/config.fish';
      default:
        return '.profile';
    }
  }
}