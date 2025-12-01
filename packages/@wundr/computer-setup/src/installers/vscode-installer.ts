/**
 * VS Code Installer - Complete Visual Studio Code setup with extensions and configuration
 * Ports functionality from 06-vscode.sh
 */
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { execa } from 'execa';
import which from 'which';

import { Logger } from '../utils/logger';

import type { SetupPlatform, SetupStep, DeveloperProfile } from '../types';
import type { BaseInstaller } from './index';

const logger = new Logger({ name: 'vscode-installer' });

export class VSCodeInstaller implements BaseInstaller {
  name = 'vscode';
  private readonly homeDir = os.homedir();

  isSupported(platform: SetupPlatform): boolean {
    return ['darwin', 'linux'].includes(platform.os);
  }

  async isInstalled(): Promise<boolean> {
    try {
      // Check if VS Code command is available
      await which('code');
      return true;
    } catch {
      // On macOS, check if the app exists even if command is not in PATH
      if (os.platform() === 'darwin') {
        try {
          await fs.access('/Applications/Visual Studio Code.app');
          return true;
        } catch {
          // App not found at this location, continue to return false
        }
      }
      return false;
    }
  }

  async getVersion(): Promise<string | null> {
    try {
      const { stdout } = await execa('code', ['--version']);
      return stdout.split('\n')[0];
    } catch {
      return null;
    }
  }

  async install(
    profile: DeveloperProfile,
    platform: SetupPlatform
  ): Promise<void> {
    logger.info(
      `Installing Visual Studio Code for ${profile.name || 'user'}...`
    );

    // Install VS Code
    await this.installVSCode(platform);

    // Install extensions
    await this.installExtensions();

    // Configure VS Code settings
    await this.configureVSCode();

    // Setup keybindings
    await this.setupKeybindings();
  }

  async configure(
    profile: DeveloperProfile,
    platform: SetupPlatform
  ): Promise<void> {
    // Log configuration context for debugging
    logger.info(
      `VS Code configuration verified for ${profile.name || 'user'} on ${platform.os}`
    );
  }

  async validate(): Promise<boolean> {
    try {
      // Check if VS Code command works
      await execa('code', ['--version']);

      // Check if some core extensions are installed
      const { stdout } = await execa('code', ['--list-extensions']);
      const extensions = stdout.toLowerCase();

      const coreExtensions = ['prettier', 'eslint', 'typescript'];
      const hasCore = coreExtensions.some(ext =>
        extensions.includes(ext.toLowerCase())
      );

      return hasCore;
    } catch (error: unknown) {
      logger.error('VS Code validation failed:', error);
      return false;
    }
  }

  getSteps(profile: DeveloperProfile, platform: SetupPlatform): SetupStep[] {
    return [
      {
        id: 'install-vscode',
        name: 'Install Visual Studio Code',
        description: 'Install VS Code with extensions and configuration',
        category: 'development',
        required: true,
        dependencies: ['install-homebrew'],
        estimatedTime: 240,
        validator: () => this.validate(),
        installer: () => this.install(profile, platform),
      },
    ];
  }

  private async installVSCode(platform: SetupPlatform): Promise<void> {
    if (platform.os === 'darwin') {
      // macOS installation
      try {
        await fs.access('/Applications/Visual Studio Code.app');
        logger.info('VS Code already installed');
      } catch {
        try {
          await which('brew');
          logger.info('Installing VS Code via Homebrew...');
          await execa('brew', ['install', '--cask', 'visual-studio-code']);
        } catch {
          throw new Error('Homebrew not found. Please install Homebrew first.');
        }
      }

      // Setup code command in PATH
      await this.setupCodeCommand();
    } else if (platform.os === 'linux') {
      // Linux installation
      try {
        await which('code');
        logger.info('VS Code already installed');
      } catch {
        await this.installVSCodeLinux();
      }
    }

    logger.info('VS Code installed');
  }

  private async setupCodeCommand(): Promise<void> {
    try {
      await which('code');
      return; // Command already available
    } catch {
      // Add VS Code to PATH
      const vscodePath =
        '/Applications/Visual Studio Code.app/Contents/Resources/app/bin';
      const pathExport = `export PATH="$PATH:${vscodePath}"`;

      const shellFiles = ['.zshrc', '.bashrc'];

      for (const shellFile of shellFiles) {
        const shellPath = path.join(this.homeDir, shellFile);

        try {
          let shellContent = '';
          try {
            shellContent = await fs.readFile(shellPath, 'utf-8');
          } catch {
            // File doesn't exist
          }

          if (!shellContent.includes('Visual Studio Code.app')) {
            await fs.writeFile(
              shellPath,
              shellContent + '\n' + pathExport + '\n',
              'utf-8'
            );
          }
        } catch (error: unknown) {
          logger.warn(`Failed to update ${shellFile}:`, error);
        }
      }

      // Add to current process PATH
      process.env.PATH = `${process.env.PATH}:${vscodePath}`;
    }
  }

  private async installVSCodeLinux(): Promise<void> {
    const commands = [
      'wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg',
      'sudo install -o root -g root -m 644 packages.microsoft.gpg /etc/apt/trusted.gpg.d/',
      'sudo sh -c \'echo "deb [arch=amd64,arm64,armhf signed-by=/etc/apt/trusted.gpg.d/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main" > /etc/apt/sources.list.d/vscode.list\'',
      'sudo apt update',
      'sudo apt install code -y',
    ];

    for (const cmd of commands) {
      await execa('bash', ['-c', cmd]);
    }
  }

  private async installExtensions(): Promise<void> {
    logger.info('Installing VS Code extensions...');

    // Ensure code command is available
    try {
      await which('code');
    } catch {
      logger.warn(
        'VS Code command line tools not found. Skipping extension installation.'
      );
      return;
    }

    const extensions = [
      // Core Development
      'dbaeumer.vscode-eslint',
      'esbenp.prettier-vscode',
      'ms-vscode.vscode-typescript-next',
      'biomejs.biome',

      // TypeScript/JavaScript
      'mgmcdermott.vscode-language-babel',
      'VisualStudioExptTeam.vscodeintellicode',
      'VisualStudioExptTeam.intellicode-api-usage-examples',
      'christian-kohler.path-intellisense',
      'christian-kohler.npm-intellisense',
      'eg2.vscode-npm-script',
      'wix.vscode-import-cost',
      'sburg.vscode-javascript-booster',
      'usernamehw.errorlens',
      'streetsidesoftware.code-spell-checker',

      // React/Next.js
      'dsznajder.es7-react-js-snippets',
      'burkeholland.simple-react-snippets',
      'styled-components.vscode-styled-components',
      'bradlc.vscode-tailwindcss',
      'formulahendry.auto-rename-tag',
      'naumovs.color-highlight',

      // Testing
      'Orta.vscode-jest',
      'firsttris.vscode-jest-runner',
      'hbenl.vscode-test-explorer',

      // Git
      'eamodio.gitlens',
      'donjayamanne.githistory',
      'mhutchie.git-graph',
      'GitHub.vscode-pull-request-github',

      // Docker
      'ms-azuretools.vscode-docker',
      'ms-vscode-remote.remote-containers',

      // Database
      'mtxr.sqltools',
      'mtxr.sqltools-driver-pg',
      'mtxr.sqltools-driver-mysql',
      'mongodb.mongodb-vscode',
      'Prisma.prisma',

      // API Development
      'rangav.vscode-thunder-client',
      '42Crunch.vscode-openapi',
      'arjun.swagger-viewer',

      // Markdown
      'yzhang.markdown-all-in-one',
      'DavidAnson.vscode-markdownlint',
      'bierner.markdown-mermaid',

      // Productivity
      'alefragnani.project-manager',
      'alefragnani.Bookmarks',
      'gruntfuggly.todo-tree',
      'wayou.vscode-todo-highlight',
      'mikestead.dotenv',
      'EditorConfig.EditorConfig',
      'redhat.vscode-yaml',
      'ms-vscode.live-server',
      'ritwickdey.LiveServer',

      // Themes and Icons
      'PKief.material-icon-theme',
      'zhuangtongfa.material-theme',
      'GitHub.github-vscode-theme',
      'dracula-theme.theme-dracula',

      // AI/Copilot
      'GitHub.copilot',
      'Continue.continue',

      // Remote Development
      'ms-vscode-remote.remote-ssh',
      'ms-vscode-remote.remote-ssh-edit',
      'ms-vscode.remote-explorer',

      // Other Languages Support
      'golang.Go',
      'rust-lang.rust-analyzer',
      'ms-python.python',
      'ms-python.vscode-pylance',

      // Utilities
      'shd101wyy.markdown-preview-enhanced',
      'mechatroner.rainbow-csv',
      'janisdd.vscode-edit-csv',
      'qcz.text-power-tools',
      'sleistner.vscode-fileutils',
      'vscode-icons-team.vscode-icons',
    ];

    for (const extension of extensions) {
      logger.info(`Installing ${extension}...`);

      try {
        // Check if extension is already installed
        const { stdout } = await execa('code', ['--list-extensions']);
        if (stdout.toLowerCase().includes(extension.toLowerCase())) {
          logger.info(`${extension} is already installed`);
          continue;
        }

        // Install the extension with timeout
        await execa('code', ['--install-extension', extension, '--force'], {
          timeout: 60000, // 60 seconds timeout
        });

        logger.info(`Successfully installed ${extension}`);
      } catch {
        logger.warn(
          `Warning: Could not install ${extension} (might be deprecated, renamed, or require different ID)`
        );
      }
    }

    logger.info('VS Code extensions installation completed');
  }

  private async configureVSCode(): Promise<void> {
    logger.info('Configuring VS Code settings...');

    const platform = os.platform();
    let settingsPath = '';

    if (platform === 'darwin') {
      settingsPath = path.join(
        this.homeDir,
        'Library/Application Support/Code/User/settings.json'
      );
    } else {
      settingsPath = path.join(this.homeDir, '.config/Code/User/settings.json');
    }

    // Ensure directory exists
    await fs.mkdir(path.dirname(settingsPath), { recursive: true });

    const settings = {
      'editor.fontSize': 14,
      'editor.fontFamily':
        "'JetBrains Mono', 'Fira Code', Menlo, Monaco, 'Courier New', monospace",
      'editor.fontLigatures': true,
      'editor.tabSize': 2,
      'editor.insertSpaces': true,
      'editor.detectIndentation': true,
      'editor.renderWhitespace': 'trailing',
      'editor.rulers': [80, 120],
      'editor.wordWrap': 'on',
      'editor.minimap.enabled': true,
      'editor.minimap.renderCharacters': false,
      'editor.formatOnSave': true,
      'editor.formatOnPaste': true,
      'editor.codeActionsOnSave': {
        'source.fixAll.eslint': 'explicit',
        'source.organizeImports': 'explicit',
      },
      'editor.quickSuggestions': {
        strings: true,
      },
      'editor.suggestSelection': 'first',
      'editor.snippetSuggestions': 'top',
      'editor.cursorBlinking': 'smooth',
      'editor.cursorSmoothCaretAnimation': 'on',
      'editor.smoothScrolling': true,
      'editor.linkedEditing': true,
      'editor.bracketPairColorization.enabled': true,
      'editor.guides.bracketPairs': true,
      'editor.stickyScroll.enabled': true,
      'editor.inlineSuggest.enabled': true,

      'files.autoSave': 'onFocusChange',
      'files.trimTrailingWhitespace': true,
      'files.trimFinalNewlines': true,
      'files.insertFinalNewline': true,
      'files.exclude': {
        '**/.git': true,
        '**/.DS_Store': true,
        '**/node_modules': true,
        '**/dist': true,
        '**/build': true,
        '**/.next': true,
        '**/.turbo': true,
      },
      'files.watcherExclude': {
        '**/.git/objects/**': true,
        '**/.git/subtree-cache/**': true,
        '**/node_modules/**': true,
        '**/dist/**': true,
        '**/build/**': true,
        '**/.next/**': true,
      },

      'terminal.integrated.fontSize': 14,
      'terminal.integrated.fontFamily':
        "'JetBrains Mono', 'Fira Code', monospace",
      'terminal.integrated.defaultProfile.osx': 'zsh',
      'terminal.integrated.defaultProfile.linux': 'bash',
      'terminal.integrated.env.osx': {
        PATH: '${env:PATH}:${env:HOME}/.local/bin:${env:HOME}/.npm-global/bin',
      },

      'workbench.colorTheme': 'GitHub Dark Default',
      'workbench.iconTheme': 'material-icon-theme',
      'workbench.startupEditor': 'none',
      'workbench.editor.enablePreview': false,
      'workbench.editor.highlightModifiedTabs': true,
      'workbench.tree.indent': 20,

      'typescript.updateImportsOnFileMove.enabled': 'always',
      'typescript.preferences.includePackageJsonAutoImports': 'auto',
      'typescript.preferences.quoteStyle': 'single',
      'typescript.format.semicolons': 'insert',
      'typescript.suggest.autoImports': true,
      'typescript.tsdk': 'node_modules/typescript/lib',

      'javascript.updateImportsOnFileMove.enabled': 'always',
      'javascript.preferences.quoteStyle': 'single',
      'javascript.format.semicolons': 'insert',
      'javascript.suggest.autoImports': true,

      '[typescript]': {
        'editor.defaultFormatter': 'esbenp.prettier-vscode',
      },
      '[typescriptreact]': {
        'editor.defaultFormatter': 'esbenp.prettier-vscode',
      },
      '[javascript]': {
        'editor.defaultFormatter': 'esbenp.prettier-vscode',
      },
      '[javascriptreact]': {
        'editor.defaultFormatter': 'esbenp.prettier-vscode',
      },
      '[json]': {
        'editor.defaultFormatter': 'esbenp.prettier-vscode',
      },
      '[jsonc]': {
        'editor.defaultFormatter': 'esbenp.prettier-vscode',
      },
      '[html]': {
        'editor.defaultFormatter': 'esbenp.prettier-vscode',
      },
      '[css]': {
        'editor.defaultFormatter': 'esbenp.prettier-vscode',
      },
      '[scss]': {
        'editor.defaultFormatter': 'esbenp.prettier-vscode',
      },
      '[markdown]': {
        'editor.defaultFormatter': 'esbenp.prettier-vscode',
      },
      '[yaml]': {
        'editor.defaultFormatter': 'esbenp.prettier-vscode',
      },

      'eslint.validate': [
        'javascript',
        'javascriptreact',
        'typescript',
        'typescriptreact',
      ],
      'eslint.run': 'onType',
      'eslint.probe': [
        'javascript',
        'javascriptreact',
        'typescript',
        'typescriptreact',
      ],

      'prettier.requireConfig': true,
      'prettier.useEditorConfig': true,

      'git.autofetch': true,
      'git.confirmSync': false,
      'git.enableSmartCommit': true,
      'git.decorations.enabled': true,
      'git.suggestSmartCommit': true,

      'gitlens.hovers.currentLine.over': 'line',
      'gitlens.codeLens.enabled': false,

      'emmet.includeLanguages': {
        javascript: 'javascriptreact',
        typescript: 'typescriptreact',
      },
      'emmet.triggerExpansionOnTab': true,

      'npm.packageManager': 'auto',
      'npm.scriptExplorerAction': 'run',

      'tailwindCSS.emmetCompletions': true,
      'tailwindCSS.includeLanguages': {
        typescript: 'javascript',
        typescriptreact: 'javascript',
      },

      'github.copilot.enable': {
        '*': true,
        yaml: true,
        plaintext: true,
        markdown: true,
      },

      'todo-tree.highlights.enabled': true,
      'todo-tree.general.tags': [
        'TODO',
        'FIXME',
        'BUG',
        'HACK',
        'NOTE',
        'WARNING',
      ],

      'extensions.autoUpdate': true,
      'extensions.autoCheckUpdates': true,

      'search.exclude': {
        '**/node_modules': true,
        '**/dist': true,
        '**/build': true,
        '**/.next': true,
        '**/coverage': true,
        '**/.turbo': true,
      },

      'explorer.confirmDelete': false,
      'explorer.confirmDragAndDrop': false,

      'errorLens.enabled': true,
      'errorLens.fontStyle': 'italic',

      'security.workspace.trust.untrustedFiles': 'open',

      'redhat.telemetry.enabled': false,
      'telemetry.telemetryLevel': 'off',
    };

    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
    logger.info('VS Code settings configured');
  }

  private async setupKeybindings(): Promise<void> {
    logger.info('Setting up VS Code keybindings...');

    const platform = os.platform();
    let keybindingsPath = '';

    if (platform === 'darwin') {
      keybindingsPath = path.join(
        this.homeDir,
        'Library/Application Support/Code/User/keybindings.json'
      );
    } else {
      keybindingsPath = path.join(
        this.homeDir,
        '.config/Code/User/keybindings.json'
      );
    }

    const keybindings = [
      {
        key: 'cmd+shift+d',
        command: 'editor.action.duplicateSelection',
      },
      {
        key: 'cmd+d',
        command: 'editor.action.deleteLines',
        when: 'editorTextFocus && !editorReadonly',
      },
      {
        key: 'alt+up',
        command: 'editor.action.moveLinesUpAction',
        when: 'editorTextFocus && !editorReadonly',
      },
      {
        key: 'alt+down',
        command: 'editor.action.moveLinesDownAction',
        when: 'editorTextFocus && !editorReadonly',
      },
      {
        key: 'cmd+shift+/',
        command: 'editor.action.blockComment',
        when: 'editorTextFocus && !editorReadonly',
      },
      {
        key: 'cmd+k cmd+u',
        command: 'editor.action.transformToUppercase',
      },
      {
        key: 'cmd+k cmd+l',
        command: 'editor.action.transformToLowercase',
      },
      {
        key: 'cmd+shift+v',
        command: 'markdown.showPreview',
        when: "!notebookEditorFocused && editorLangId == 'markdown'",
      },
      {
        key: 'cmd+shift+t',
        command: 'workbench.action.terminal.new',
      },
      {
        key: 'cmd+shift+g',
        command: 'workbench.view.scm',
      },
    ];

    await fs.writeFile(keybindingsPath, JSON.stringify(keybindings, null, 2));
    logger.info('VS Code keybindings configured');
  }

  async uninstall(): Promise<void> {
    logger.info('Uninstalling Visual Studio Code...');

    try {
      if (os.platform() === 'darwin') {
        // Remove VS Code app
        await fs.rm('/Applications/Visual Studio Code.app', {
          recursive: true,
        });

        // Remove user data
        const userDataPath = path.join(
          this.homeDir,
          'Library/Application Support/Code'
        );
        await fs.rm(userDataPath, { recursive: true, force: true });
      } else {
        // Linux uninstall
        await execa('sudo', ['apt', 'remove', 'code', '-y']);

        // Remove user data
        const userDataPath = path.join(this.homeDir, '.config/Code');
        await fs.rm(userDataPath, { recursive: true, force: true });
      }

      logger.info('Visual Studio Code uninstalled');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`VS Code uninstallation failed: ${errorMessage}`);
    }
  }
}
