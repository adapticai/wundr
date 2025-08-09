# @wundr/computer-setup

Engineering team computer provisioning and setup tool - configure new developer machines with all required tools.

## 🚀 Overview

The `@wundr/computer-setup` package automates the setup of developer workstations with a comprehensive suite of development tools, configurations, and environments. It provides role-based profiles for different types of developers and ensures consistent development environments across teams.

## ✨ Features

- **6 Pre-configured Developer Profiles** - Frontend, Backend, Full Stack, DevOps, ML, Mobile
- **Cross-Platform Support** - macOS, Linux, Windows (WSL2)
- **Smart Installation** - Parallel/sequential execution with rollback support
- **Team Configurations** - Apply organization-specific settings
- **Profile Management** - Import/export custom profiles
- **Validation & Verification** - Ensure all tools are properly installed
- **Dry Run Mode** - Preview changes before applying

## 📦 Installation

As part of the Wundr CLI:
```bash
npm install -g @wundr/cli
```

Or standalone:
```bash
npm install -g @wundr/computer-setup
```

## 🎯 Quick Start

### Interactive Setup
```bash
wundr computer-setup
```

### With Specific Profile
```bash
wundr computer-setup --profile fullstack
```

### Dry Run (Preview)
```bash
wundr computer-setup --dry-run --profile frontend
```

### Validate Current Setup
```bash
wundr computer-setup validate
```

## 👥 Developer Profiles

### Frontend Developer
- **Runtimes**: Node.js, Bun, Deno
- **Package Managers**: npm, pnpm, yarn
- **Build Tools**: Vite, Webpack, Parcel
- **Frameworks**: React DevTools, Vue DevTools
- **CSS Tools**: Sass, PostCSS, Tailwind CSS CLI
- **Testing**: Playwright, Cypress
- **Browsers**: Chrome, Firefox, Safari DevTools

### Backend Developer
- **Runtimes**: Node.js, Python, Go, Rust
- **Databases**: PostgreSQL, MySQL, MongoDB, Redis
- **API Tools**: Postman/Insomnia, ngrok
- **Containers**: Docker, Docker Compose
- **Message Queues**: RabbitMQ, Kafka tools
- **Monitoring**: htop, ctop, lazydocker

### Full Stack Developer
- Combination of Frontend + Backend tools
- **Additional**: GraphQL tools, Prisma CLI
- **Cloud CLIs**: AWS, Google Cloud, Azure
- **Database GUIs**: TablePlus, DBeaver

### DevOps Engineer
- **Container Orchestration**: Kubernetes, Helm, k9s
- **Infrastructure**: Terraform, Ansible, Pulumi
- **CI/CD**: Jenkins CLI, CircleCI CLI
- **Cloud Tools**: All major cloud provider CLIs
- **Monitoring**: Prometheus, Grafana tools
- **Security**: Vault, SOPS

### Machine Learning Engineer
- **Python Stack**: Python 3.11+, pip, conda
- **ML Frameworks**: TensorFlow, PyTorch, scikit-learn
- **Data Tools**: Jupyter, pandas, numpy
- **GPU Support**: CUDA toolkit (if applicable)
- **Visualization**: matplotlib, seaborn
- **Environments**: virtualenv, pyenv

### Mobile Developer
- **React Native**: Expo CLI, EAS CLI
- **iOS**: Xcode Command Line Tools, CocoaPods
- **Android**: Android Studio, Android SDK
- **Flutter**: Flutter SDK, Dart
- **Testing**: Detox, Appium
- **Debugging**: Flipper, React Native Debugger

## 🛠️ Setup Process

The setup follows a 6-phase orchestration process:

### 1. Validation Phase
- Check system requirements
- Verify OS compatibility
- Ensure sufficient disk space
- Check network connectivity

### 2. Preparation Phase
- Load selected profile
- Resolve dependencies
- Plan installation order
- Prepare package managers

### 3. Installation Phase
- Install tools in dependency order
- Use parallel execution where possible
- Provide progress feedback
- Handle errors with rollback

### 4. Configuration Phase
- Configure Git settings
- Set up SSH keys
- Configure shell (bash/zsh/fish)
- Apply editor settings
- Set environment variables

### 5. Verification Phase
- Validate all installations
- Check tool versions
- Test configurations
- Verify PATH settings

### 6. Finalization Phase
- Generate setup report
- Save profile snapshot
- Clean up temporary files
- Display next steps

## 💻 CLI Commands

### Main Commands
```bash
# Interactive setup wizard
wundr computer-setup

# Setup with specific profile
wundr computer-setup --profile <role>

# Apply team configuration
wundr computer-setup --team <team-name>

# Dry run to preview changes
wundr computer-setup --dry-run

# Validate current setup
wundr computer-setup validate

# Diagnose issues
wundr computer-setup doctor
```

### Profile Management
```bash
# List available profiles
wundr computer-setup profile list

# Show profile details
wundr computer-setup profile show frontend

# Export current setup
wundr computer-setup profile export > my-setup.json

# Import custom profile
wundr computer-setup profile import my-setup.json
```

### Team Configurations
```bash
# Apply team settings
wundr computer-setup team platform

# List available team configs
wundr computer-setup team list

# Create team configuration
wundr computer-setup team create
```

## ⚙️ Configuration

### Profile Structure
```typescript
interface DeveloperProfile {
  name: string;
  description: string;
  role: 'frontend' | 'backend' | 'fullstack' | 'devops' | 'ml' | 'mobile';
  tools: {
    required: Tool[];
    optional: Tool[];
  };
  configurations: {
    git?: GitConfig;
    shell?: ShellConfig;
    editor?: EditorConfig;
    env?: EnvironmentVariables;
  };
  validations: Validation[];
}
```

### Custom Profile Example
```json
{
  "name": "custom-frontend",
  "role": "frontend",
  "tools": {
    "required": [
      {
        "name": "node",
        "version": ">=20.0.0",
        "installer": "nvm"
      },
      {
        "name": "pnpm",
        "version": "latest",
        "installer": "npm"
      }
    ]
  },
  "configurations": {
    "git": {
      "user.name": "Your Name",
      "user.email": "you@example.com"
    }
  }
}
```

## 🔧 Platform-Specific Notes

### macOS
- Uses Homebrew as primary package manager
- Installs Xcode Command Line Tools if needed
- Configures macOS-specific tools (e.g., FSWatch)

### Linux
- Detects distribution (Ubuntu, Fedora, Arch)
- Uses appropriate package manager (apt, yum, pacman)
- Handles snap and flatpak packages

### Windows
- Requires WSL2 for full functionality
- Uses Chocolatey/Scoop for Windows-native tools
- Configures Windows Terminal

## 📊 Installers

The package includes specialized installers for different tool categories:

- **NodeInstaller**: Node.js, npm, nvm
- **GitInstaller**: Git with configuration
- **DockerInstaller**: Docker Desktop/Engine
- **PythonInstaller**: Python, pip, virtualenv
- **DatabaseInstaller**: Database clients and servers
- **CloudInstaller**: Cloud provider CLIs

## 🔍 Validation

Built-in validators ensure proper installation:

```typescript
interface Validator {
  checkInstallation(tool: string): Promise<boolean>;
  checkVersion(tool: string, version: string): Promise<boolean>;
  checkConfiguration(config: Config): Promise<boolean>;
  generateReport(): Promise<ValidationReport>;
}
```

## 🚀 Development

### Running in Development
```bash
# Check tools without building
npx tsx packages/@wundr/computer-setup/dev.ts check-tools

# List profiles in dev mode
npx tsx packages/@wundr/computer-setup/dev.ts list-profiles

# Dry run in dev mode
npx tsx packages/@wundr/computer-setup/dev.ts dry-run frontend
```

### Building
```bash
cd packages/@wundr/computer-setup
pnpm build
```

### Testing
```bash
pnpm test
```

## 📄 API Usage

```typescript
import { 
  SetupOrchestrator, 
  ProfileManager,
  ToolValidator 
} from '@wundr/computer-setup';

// Orchestrate setup
const orchestrator = new SetupOrchestrator();
await orchestrator.setup({
  profile: 'fullstack',
  dryRun: false,
  parallel: true
});

// Manage profiles
const profileManager = new ProfileManager();
const profile = await profileManager.loadProfile('frontend');

// Validate tools
const validator = new ToolValidator();
const isValid = await validator.checkInstallation('node');
```

## 🤝 Contributing

We welcome contributions! Areas for improvement:
- Additional developer profiles
- More tool installers
- Platform-specific optimizations
- Team configuration templates

## 📄 License

MIT - See [LICENSE](../../../LICENSE) for details.