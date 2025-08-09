#!/bin/bash

set -euo pipefail
# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Source common utilities
source "${SCRIPT_DIR}/scripts/setup/common.sh"
log() {
    echo -e "[CLAUDE] $1" | tee -a "$LOG_FILE"
}

install_claude_code() {
    log "Installing Claude Code..."
    
    if command -v claude &> /dev/null; then
        log "Claude Code already installed"
        claude --version
    else
        log "Installing Claude Code via npm..."
        npm install -g @anthropic-ai/claude-code
        
        if ! command -v claude &> /dev/null; then
            log "Installing Claude Code via curl..."
            if [[ "$OS" == "macos" || "$OS" == "linux" ]]; then
                curl -fsSL claude.ai/install.sh | bash
            fi
        fi
    fi
    
    if command -v claude &> /dev/null; then
        log "Claude Code installed successfully"
    else
        log "Warning: Claude Code installation failed. Please install manually."
    fi
}

install_claude_flow() {
    log "Installing Claude Flow..."
    
    if command -v claude-flow &> /dev/null; then
        log "Claude Flow already installed"
        claude-flow --version
    else
        log "Installing Claude Flow v2.0.0 Alpha..."
        
        # Install prerequisites
        log "Installing Claude Code (prerequisite)..."
        npm install -g @anthropic-ai/claude-code
        
        # Install Claude Flow
        npm install -g claude-flow
        
        if command -v claude-flow &> /dev/null; then
            log "Claude Flow installed successfully"
            claude-flow --version
            
            # Initialize Claude Flow configuration
            log "Initializing Claude Flow configuration..."
            claude-flow config init || true
        else
            log "Warning: Claude Flow installation failed"
        fi
    fi
}

configure_claude_code() {
    log "Configuring Claude Code..."
    
    mkdir -p "$HOME/.config/claude"
    
    cat > "$HOME/.config/claude/config.json" << 'EOF'
{
  "model": {
    "default": "claude-opus-4-1-20250805",
    "enforceModel": true,
    "preventDowngrade": true,
    "alwaysUseDefault": true,
    "ignoreUsageLimits": true,
    "modelPreferences": {
      "primary": "claude-opus-4-1-20250805",
      "fallback": "claude-opus-4-1-20250805",
      "override": "claude-opus-4-1-20250805"
    }
  },
  "editor": "code",
  "theme": "dark",
  "autoSave": true,
  "telemetry": false,
  "experimental": {
    "features": true
  },
  "performance": {
    "maxWorkers": 4,
    "cacheEnabled": true,
    "modelOptimization": "quality-over-speed"
  },
  "ui": {
    "showLineNumbers": true,
    "wordWrap": true,
    "fontSize": 14
  },
  "api": {
    "modelSelection": "fixed",
    "fixedModel": "claude-opus-4-1-20250805",
    "disableModelSwitching": true
  }
}
EOF
    
    log "Claude Code configured with Opus 4.1 as default model"
}

setup_claude_flow_project() {
    log "Setting up Claude Flow project configuration..."
    
    # Create global Claude Flow config directory
    mkdir -p "${SETUP_ROOT_DIR}/.claude-flow"
    mkdir -p "${SCRIPT_DIR}/templates/claude-flow"
    
    # Create global Claude Flow configuration
    cat > "${SETUP_ROOT_DIR}/.claude-flow/global-config.json" << 'EOF'
{
  "version": "2.0.0-alpha",
  "global": {
    "defaultRootDir": "${SETUP_ROOT_DIR}",
    "defaultModel": "claude-opus-4-1-20250805",
    "enforceModelSelection": true,
    "preventModelDowngrade": true,
    "maxConcurrentAgents": 8,
    "memoryBackend": "sqlite",
    "enableHooks": true,
    "enableNeuralPatterns": true
  },
  "orchestrator": {
    "port": 3000,
    "daemon": false,
    "autoStart": true
  },
  "swarm": {
    "enabled": true,
    "queen": {
      "model": "claude-opus-4-1-20250805",
      "temperature": 0.7,
      "maxTokens": 4096,
      "alwaysOnline": true,
      "enforceModel": true,
      "preventDowngrade": true
    },
    "workers": {
      "count": 54,
      "types": {
        "// Core Development": "------------------------------",
        "coder": { "count": 3, "model": "claude-opus-4-1-20250805" },
        "reviewer": { "count": 2, "model": "claude-opus-4-1-20250805" },
        "tester": { "count": 2, "model": "claude-opus-4-1-20250805" },
        "planner": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "researcher": { "count": 1, "model": "claude-opus-4-1-20250805" },
        
        "// Swarm Coordination": "------------------------------",
        "hierarchical-coordinator": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "mesh-coordinator": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "adaptive-coordinator": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "collective-intelligence-coordinator": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "swarm-memory-manager": { "count": 1, "model": "claude-opus-4-1-20250805" },
        
        "// Consensus & Distributed": "------------------------------",
        "byzantine-coordinator": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "raft-manager": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "gossip-coordinator": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "consensus-builder": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "crdt-synchronizer": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "quorum-manager": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "security-manager": { "count": 1, "model": "claude-opus-4-1-20250805" },
        
        "// Performance & Optimization": "------------------------------",
        "perf-analyzer": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "performance-benchmarker": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "task-orchestrator": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "memory-coordinator": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "smart-agent": { "count": 1, "model": "claude-opus-4-1-20250805" },
        
        "// GitHub & Repository": "------------------------------",
        "github-modes": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "pr-manager": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "code-review-swarm": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "issue-tracker": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "release-manager": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "workflow-automation": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "project-board-sync": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "repo-architect": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "multi-repo-swarm": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "swarm-pr": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "swarm-issue": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "sync-coordinator": { "count": 1, "model": "claude-opus-4-1-20250805" },
        
        "// SPARC Methodology": "------------------------------",
        "sparc-coord": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "sparc-coder": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "specification": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "pseudocode": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "architecture": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "refinement": { "count": 1, "model": "claude-opus-4-1-20250805" },
        
        "// Specialized Development": "------------------------------",
        "backend-dev": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "mobile-dev": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "ml-developer": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "cicd-engineer": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "api-docs": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "system-architect": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "code-analyzer": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "base-template-generator": { "count": 1, "model": "claude-opus-4-1-20250805" },
        
        "// Testing & Validation": "------------------------------",
        "tdd-london-swarm": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "production-validator": { "count": 1, "model": "claude-opus-4-1-20250805" },
        
        "// Migration & Planning": "------------------------------",
        "migration-planner": { "count": 1, "model": "claude-opus-4-1-20250805" },
        "swarm-init": { "count": 1, "model": "claude-opus-4-1-20250805" }
      }
    }
  },
  "memory": {
    "type": "persistent",
    "backend": "local",
    "maxSize": "100MB",
    "autoSave": true
  },
  "tools": {
    "mcp": {
      "enabled": true,
      "tools": [
        "filesystem",
        "git",
        "docker",
        "npm",
        "terminal"
      ]
    },
    "custom": []
  },
  "github": {
    "integration": true,
    "autoCommit": false,
    "prTemplate": true,
    "issueTracking": true,
    "hooks": {
      "enabled": true,
      "events": ["push", "pull_request", "issues"]
    }
  },
  "cognitive": {
    "models": [
      "reasoning",
      "planning",
      "execution",
      "validation",
      "optimization"
    ],
    "wasm": {
      "enabled": true,
      "simd": true
    }
  },
  "performance": {
    "parallel": true,
    "caching": true,
    "optimization": "aggressive"
  },
  "logging": {
    "level": "info",
    "file": "claude-flow.log",
    "console": true
  }
}
EOF
    
    cat > "${SCRIPT_DIR}/templates/claude-flow/swarm.config.js" << 'EOF'
module.exports = {
  queen: {
    role: 'orchestrator',
    responsibilities: [
      'Task decomposition',
      'Worker assignment',
      'Quality assurance',
      'Integration management'
    ],
    config: {
      model: 'claude-opus-4-1-20250805',
      temperature: 0.7,
      maxConcurrent: 54,
      enforceModel: true,
      preventDowngrade: true
    }
  },
  
  workers: {
    // Core Development (5 agents)
    coder: { role: 'Code implementation', model: 'claude-opus-4-1-20250805' },
    reviewer: { role: 'Code review', model: 'claude-opus-4-1-20250805' },
    tester: { role: 'Testing', model: 'claude-opus-4-1-20250805' },
    planner: { role: 'Planning', model: 'claude-opus-4-1-20250805' },
    researcher: { role: 'Research', model: 'claude-opus-4-1-20250805' },
    
    // Swarm Coordination (5 agents)
    'hierarchical-coordinator': { role: 'Hierarchical swarm coordination', model: 'claude-opus-4-1-20250805' },
    'mesh-coordinator': { role: 'Mesh topology coordination', model: 'claude-opus-4-1-20250805' },
    'adaptive-coordinator': { role: 'Adaptive swarm patterns', model: 'claude-opus-4-1-20250805' },
    'collective-intelligence-coordinator': { role: 'Collective intelligence', model: 'claude-opus-4-1-20250805' },
    'swarm-memory-manager': { role: 'Distributed memory', model: 'claude-opus-4-1-20250805' },
    
    // Consensus & Distributed (7 agents)
    'byzantine-coordinator': { role: 'Byzantine fault tolerance', model: 'claude-opus-4-1-20250805' },
    'raft-manager': { role: 'Raft consensus', model: 'claude-opus-4-1-20250805' },
    'gossip-coordinator': { role: 'Gossip protocols', model: 'claude-opus-4-1-20250805' },
    'consensus-builder': { role: 'Consensus building', model: 'claude-opus-4-1-20250805' },
    'crdt-synchronizer': { role: 'CRDT synchronization', model: 'claude-opus-4-1-20250805' },
    'quorum-manager': { role: 'Quorum management', model: 'claude-opus-4-1-20250805' },
    'security-manager': { role: 'Security protocols', model: 'claude-opus-4-1-20250805' },
    
    // Performance & Optimization (5 agents)
    'perf-analyzer': { role: 'Performance analysis', model: 'claude-opus-4-1-20250805' },
    'performance-benchmarker': { role: 'Benchmarking', model: 'claude-opus-4-1-20250805' },
    'task-orchestrator': { role: 'Task orchestration', model: 'claude-opus-4-1-20250805' },
    'memory-coordinator': { role: 'Memory coordination', model: 'claude-opus-4-1-20250805' },
    'smart-agent': { role: 'Smart agent spawning', model: 'claude-opus-4-1-20250805' },
    
    // GitHub & Repository (12 agents)
    'github-modes': { role: 'GitHub integration', model: 'claude-opus-4-1-20250805' },
    'pr-manager': { role: 'PR management', model: 'claude-opus-4-1-20250805' },
    'code-review-swarm': { role: 'Code review swarm', model: 'claude-opus-4-1-20250805' },
    'issue-tracker': { role: 'Issue tracking', model: 'claude-opus-4-1-20250805' },
    'release-manager': { role: 'Release management', model: 'claude-opus-4-1-20250805' },
    'workflow-automation': { role: 'Workflow automation', model: 'claude-opus-4-1-20250805' },
    'project-board-sync': { role: 'Project board sync', model: 'claude-opus-4-1-20250805' },
    'repo-architect': { role: 'Repository architecture', model: 'claude-opus-4-1-20250805' },
    'multi-repo-swarm': { role: 'Multi-repo coordination', model: 'claude-opus-4-1-20250805' },
    'swarm-pr': { role: 'PR swarm management', model: 'claude-opus-4-1-20250805' },
    'swarm-issue': { role: 'Issue swarm management', model: 'claude-opus-4-1-20250805' },
    'sync-coordinator': { role: 'Sync coordination', model: 'claude-opus-4-1-20250805' },
    
    // SPARC Methodology (6 agents)
    'sparc-coord': { role: 'SPARC coordination', model: 'claude-opus-4-1-20250805' },
    'sparc-coder': { role: 'SPARC coding', model: 'claude-opus-4-1-20250805' },
    'specification': { role: 'Specification', model: 'claude-opus-4-1-20250805' },
    'pseudocode': { role: 'Pseudocode', model: 'claude-opus-4-1-20250805' },
    'architecture': { role: 'Architecture', model: 'claude-opus-4-1-20250805' },
    'refinement': { role: 'Refinement', model: 'claude-opus-4-1-20250805' },
    
    // Specialized Development (8 agents)
    'backend-dev': { role: 'Backend development', model: 'claude-opus-4-1-20250805' },
    'mobile-dev': { role: 'Mobile development', model: 'claude-opus-4-1-20250805' },
    'ml-developer': { role: 'ML development', model: 'claude-opus-4-1-20250805' },
    'cicd-engineer': { role: 'CI/CD engineering', model: 'claude-opus-4-1-20250805' },
    'api-docs': { role: 'API documentation', model: 'claude-opus-4-1-20250805' },
    'system-architect': { role: 'System architecture', model: 'claude-opus-4-1-20250805' },
    'code-analyzer': { role: 'Code analysis', model: 'claude-opus-4-1-20250805' },
    'base-template-generator': { role: 'Template generation', model: 'claude-opus-4-1-20250805' },
    
    // Testing & Validation (2 agents)
    'tdd-london-swarm': { role: 'TDD London methodology', model: 'claude-opus-4-1-20250805' },
    'production-validator': { role: 'Production validation', model: 'claude-opus-4-1-20250805' },
    
    // Migration & Planning (2 agents)
    'migration-planner': { role: 'Migration planning', model: 'claude-opus-4-1-20250805' },
    'swarm-init': { role: 'Swarm initialization', model: 'claude-opus-4-1-20250805' }
  },
  
  coordination: {
    communicationProtocol: 'event-driven',
    consensusAlgorithm: 'weighted-voting',
    conflictResolution: 'queen-arbitration',
    modelEnforcement: 'strict',
    defaultModel: 'claude-opus-4-1-20250805'
  },
  
  optimization: {
    loadBalancing: true,
    dynamicScaling: true,
    resourcePooling: true,
    modelOptimization: 'quality-over-speed'
  }
};
EOF
    
    log "Claude Flow project templates created"
}

create_claude_md() {
    log "Creating CLAUDE.md configuration with verification protocols..."
    
    cat > "${SCRIPT_DIR}/CLAUDE.md" << 'EOF'
# Claude Code Configuration - WITH VERIFICATION PROTOCOLS

## 🚨 CRITICAL: VERIFICATION PROTOCOL & REALITY CHECKS

### MANDATORY: ALWAYS VERIFY, NEVER ASSUME

**After EVERY code change or implementation:**
1. **TEST IT**: Run the actual command and show real output
2. **PROVE IT**: Show file contents, build results, test output  
3. **FAIL LOUDLY**: If something fails, say "❌ FAILED:" immediately
4. **VERIFY SUCCESS**: Only claim "complete" after showing it working

**FORBIDDEN BEHAVIORS:**
- ❌ NEVER claim "build successful" without running build
- ❌ NEVER say "tests pass" without running tests
- ❌ NEVER report "implemented" without verification
- ❌ NEVER hide or minimize errors
- ❌ NEVER generate fictional terminal output
- ❌ NEVER assume code works because you wrote it

**REQUIRED BEHAVIORS:**
- ✅ Run actual commands
- ✅ Show real output
- ✅ Report failures immediately
- ✅ Document issues in FAILURES.md
- ✅ Test before claiming done
- ✅ Be honest about state

### FAILURE REPORTING FORMAT
```
❌ FAILURE: [Component Name]
Error: [Exact error message]
Location: [File and line if available]
Status: BLOCKED/PARTIAL/NEEDS_INVESTIGATION
```

### SUCCESS REPORTING FORMAT
```
✅ VERIFIED: [Component Name]
Build Output: [Show actual npm run build success]
Test Output: [Show actual test results]
Execution: [Show feature actually running]
```

## Project Context

This repository contains automated setup scripts for new Node.js engineers. The setup ensures consistent development environments with all necessary tools, configurations, and best practices.

## Golden Standards

### Code Quality
- **Type Safety**: Always use TypeScript with strict mode enabled
- **Linting**: ESLint with recommended rules + custom configurations
- **Formatting**: Prettier with consistent style across all files
- **Testing**: Minimum 80% code coverage with unit and integration tests
- **Documentation**: JSDoc comments for all public APIs

### Architecture Principles
- **Modularity**: Single Responsibility Principle for all modules
- **Dependency Injection**: Use DI for better testability
- **Error Handling**: Comprehensive error handling with proper logging
- **Performance**: Optimize for performance from the start
- **Security**: Follow OWASP guidelines and security best practices

### Development Workflow
1. **Branch Strategy**: Git Flow with feature, develop, and main branches
2. **Commit Messages**: Conventional Commits format
3. **Code Review**: All changes require PR review
4. **CI/CD**: Automated testing and deployment pipelines
5. **Documentation**: Keep README and API docs up to date

## Ideal Patterns

### TypeScript Configuration
```typescript
// tsconfig.json ideal settings
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### Error Handling Pattern
```typescript
class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// Usage
try {
  // operation
} catch (error) {
  if (error instanceof AppError) {
    logger.error('Operational error:', error);
    // handle operational error
  } else {
    logger.fatal('Unexpected error:', error);
    // handle programming error
  }
}
```

### Async/Await Pattern
```typescript
// Always use async/await over callbacks or raw promises
async function fetchData<T>(url: string): Promise<T> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new AppError(response.status, 'Failed to fetch data');
    }
    return await response.json();
  } catch (error) {
    logger.error('Fetch error:', error);
    throw error;
  }
}
```

## Anti-Patterns to Avoid

### ❌ Never Do This

1. **Any Type**: Never use `any` type in TypeScript
```typescript
// BAD
let data: any = fetchData();

// GOOD
let data: UserData = await fetchData<UserData>();
```

2. **Callback Hell**: Avoid nested callbacks
```typescript
// BAD
getData((err, data) => {
  if (err) handleError(err);
  processData(data, (err, result) => {
    if (err) handleError(err);
    saveResult(result, (err) => {
      if (err) handleError(err);
    });
  });
});

// GOOD
try {
  const data = await getData();
  const result = await processData(data);
  await saveResult(result);
} catch (error) {
  handleError(error);
}
```

3. **Magic Numbers/Strings**: Always use constants
```typescript
// BAD
if (status === 200) { }
setTimeout(fn, 3000);

// GOOD
const HTTP_STATUS = { OK: 200 };
const TIMEOUT_MS = 3000;
if (status === HTTP_STATUS.OK) { }
setTimeout(fn, TIMEOUT_MS);
```

4. **Mutations**: Avoid mutating objects/arrays
```typescript
// BAD
const arr = [1, 2, 3];
arr.push(4);
obj.prop = 'new value';

// GOOD
const arr = [1, 2, 3];
const newArr = [...arr, 4];
const newObj = { ...obj, prop: 'new value' };
```

## Custom ESLint Rules

```javascript
module.exports = {
  rules: {
    // Enforce naming conventions
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'interface',
        format: ['PascalCase'],
        prefix: ['I']
      },
      {
        selector: 'typeAlias',
        format: ['PascalCase']
      },
      {
        selector: 'enum',
        format: ['PascalCase']
      },
      {
        selector: 'variable',
        format: ['camelCase', 'UPPER_CASE'],
        leadingUnderscore: 'allow'
      }
    ],
    
    // Enforce consistent imports
    'import/order': [
      'error',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index'
        ],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc'
        }
      }
    ],
    
    // Enforce error handling
    'no-throw-literal': 'error',
    'prefer-promise-reject-errors': 'error',
    
    // Enforce code quality
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'no-debugger': 'error',
    'no-alert': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    'prefer-template': 'error',
    'prefer-arrow-callback': 'error',
    'arrow-body-style': ['error', 'as-needed'],
    
    // TypeScript specific
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/no-unused-vars': 'error'
  }
};
```

## Testing Standards

### Unit Testing
```typescript
describe('UserService', () => {
  let service: UserService;
  let mockRepository: jest.Mocked<UserRepository>;
  
  beforeEach(() => {
    mockRepository = createMockRepository();
    service = new UserService(mockRepository);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('getUser', () => {
    it('should return user when found', async () => {
      // Arrange
      const userId = '123';
      const expectedUser = { id: userId, name: 'John' };
      mockRepository.findById.mockResolvedValue(expectedUser);
      
      // Act
      const result = await service.getUser(userId);
      
      // Assert
      expect(result).toEqual(expectedUser);
      expect(mockRepository.findById).toHaveBeenCalledWith(userId);
      expect(mockRepository.findById).toHaveBeenCalledTimes(1);
    });
    
    it('should throw error when user not found', async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(null);
      
      // Act & Assert
      await expect(service.getUser('999')).rejects.toThrow('User not found');
    });
  });
});
```

## Performance Guidelines

1. **Lazy Loading**: Implement lazy loading for heavy modules
2. **Memoization**: Cache expensive computations
3. **Debouncing/Throttling**: Control event handler frequency
4. **Virtual Scrolling**: For large lists
5. **Code Splitting**: Split bundles for faster initial load

## Security Best Practices

1. **Input Validation**: Always validate and sanitize user input
2. **Authentication**: Use JWT with proper expiration
3. **Authorization**: Implement role-based access control
4. **Encryption**: Encrypt sensitive data at rest and in transit
5. **Dependencies**: Regular security audits with `npm audit`
6. **Environment Variables**: Never commit secrets to repository
7. **CORS**: Configure CORS properly for production
8. **Rate Limiting**: Implement rate limiting for APIs
9. **SQL Injection**: Use parameterized queries
10. **XSS Prevention**: Sanitize HTML output

## Git Workflow

### Branch Naming
- Feature: `feature/ticket-number-description`
- Bugfix: `bugfix/ticket-number-description`
- Hotfix: `hotfix/ticket-number-description`
- Release: `release/version-number`

### Commit Message Format
```
type(scope): subject

body

footer
```

Types: feat, fix, docs, style, refactor, test, chore

### PR Guidelines
1. Keep PRs small and focused
2. Include tests for new features
3. Update documentation
4. Ensure CI passes
5. Request review from at least one team member

## Development Tools Configuration

### Prettier
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### VSCode Settings
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.updateImportsOnFileMove.enabled": "always"
}
```

## Monitoring and Logging

### Logging Levels
- **Fatal**: Application crash
- **Error**: Error events
- **Warn**: Warning events
- **Info**: Informational messages
- **Debug**: Debug information
- **Trace**: Detailed trace information

### Metrics to Track
1. Response time
2. Error rate
3. Throughput
4. CPU usage
5. Memory usage
6. Database query time

## Continuous Improvement

1. **Code Reviews**: Regular peer reviews
2. **Refactoring**: Continuous refactoring
3. **Learning**: Stay updated with latest technologies
4. **Documentation**: Keep documentation current
5. **Automation**: Automate repetitive tasks
6. **Feedback**: Act on user and team feedback

## Resources

- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [ESLint Rules](https://eslint.org/docs/rules/)
- [Prettier Options](https://prettier.io/docs/en/options.html)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
EOF
    
    log "CLAUDE.md created"
}

copy_verification_files() {
    log "Copying verification protocols and scripts..."
    
    # Create directories
    mkdir -p "${SCRIPT_DIR}/scripts"
    mkdir -p "${SCRIPT_DIR}/docs"
    mkdir -p "${SCRIPT_DIR}/.claude-flow"
    
    # Create verification script
    cat > "${SCRIPT_DIR}/scripts/verify-claims.sh" << 'EOF'
#!/bin/bash

# Verification Script - MUST pass before claiming tasks complete
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "================================================"
echo "🔍 VERIFICATION SCRIPT"
echo "================================================"

FAILURES=0
SUCCESSES=0

test_command() {
    local description=$1
    local command=$2
    
    echo -n "Testing: $description... "
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASSED${NC}"
        ((SUCCESSES++))
    else
        echo -e "${RED}❌ FAILED${NC}"
        echo "  Command: $command"
        ((FAILURES++))
    fi
}

echo "1. CHECKING BUILD SYSTEM"
test_command "Project build" "npm run build"

echo ""
echo "2. CHECKING TESTS"
test_command "Project tests" "npm test"

echo ""
echo "================================================"
echo -e "Successes: ${GREEN}$SUCCESSES${NC}"
echo -e "Failures:  ${RED}$FAILURES${NC}"

if [ $FAILURES -gt 0 ]; then
    echo -e "${RED}❌ VERIFICATION FAILED${NC}"
    echo "Cannot claim tasks complete with $FAILURES failures!"
    exit 1
else
    echo -e "${GREEN}✅ ALL VERIFICATIONS PASSED${NC}"
    exit 0
fi
EOF
    chmod +x "${SCRIPT_DIR}/scripts/verify-claims.sh"
    
    # Create FAILURES.md
    cat > "${SCRIPT_DIR}/docs/FAILURES.md" << 'EOF'
# Failure Tracking

This file tracks actual failures encountered during development.
Always update this when encountering issues that block progress.

## Format

### [Date] - [Component]
**Error**: Exact error message
**Command**: Command that failed
**Status**: BLOCKED/PARTIAL/RESOLVED
**Solution**: What fixed it (if resolved)

---

## Active Failures

_(None yet - will be populated when failures occur)_

## Resolved Failures

_(None yet - will be populated when failures are resolved)_
EOF
    
    # Create verification hooks for Claude Flow
    cat > "${SCRIPT_DIR}/.claude-flow/verification-hooks.json" << 'EOF'
{
  "version": "1.0.0",
  "hooks": {
    "pre-completion": {
      "enabled": true,
      "required": true,
      "commands": [
        "./scripts/verify-claims.sh"
      ],
      "failureMessage": "❌ Cannot mark complete - verification failed!"
    },
    "post-implementation": {
      "enabled": true,
      "commands": [
        "npm run build",
        "npm test"
      ],
      "continueOnFailure": false
    },
    "reality-check": {
      "enabled": true,
      "interval": "after-each-task",
      "checks": [
        "build-passes",
        "tests-pass",
        "no-typescript-errors",
        "dependencies-installed"
      ]
    }
  },
  "enforcement": {
    "blockHallucinatedSuccess": true,
    "requireActualOutput": true,
    "documentFailures": true,
    "verifyBeforeClaiming": true
  }
}
EOF
    
    # Create agent verification protocol
    cat > "${SCRIPT_DIR}/docs/AGENT_VERIFICATION_PROTOCOL.md" << 'EOF'
# 🚨 AGENT VERIFICATION PROTOCOL

## MANDATORY FOR ALL AGENTS

### CORE PRINCIPLE: VERIFY, DON'T HALLUCINATE

## BEFORE CLAIMING SUCCESS

**ALWAYS run these commands and show output:**
```bash
npm run build  # or appropriate build command
npm test       # if tests exist
```

## FORBIDDEN BEHAVIORS

**NEVER DO THIS:**
- ❌ Claim "build successful" without running build
- ❌ Say "tests pass" without running tests
- ❌ Report "implemented" without verification
- ❌ Hide or minimize errors
- ❌ Generate fictional terminal output

## REQUIRED BEHAVIORS

**ALWAYS DO THIS:**
- ✅ Run actual commands
- ✅ Show real output
- ✅ Report failures immediately
- ✅ Document issues in FAILURES.md
- ✅ Test before claiming done

Remember: It's better to report a failure honestly than to claim false success.
EOF
    
    log "Verification files created successfully"
}

setup_claude_agents() {
    log "Setting up Claude agents for product squad..."
    
    # Call the agent setup script
    if [ -f "${SCRIPT_DIR}/scripts/setup/11-claude-agents.sh" ]; then
        log "Running Claude agent generation..."
        bash "${SCRIPT_DIR}/scripts/setup/11-claude-agents.sh" --non-interactive
    elif [ -f "${SCRIPT_DIR}/setup/11-claude-agents.sh" ]; then
        log "Running Claude agent generation..."
        bash "${SCRIPT_DIR}/setup/11-claude-agents.sh" --non-interactive
    else
        log "Warning: Agent setup script not found at expected locations"
    fi
    
    log "Claude agents configured"
}

setup_claude_aliases() {
    log "Setting up Claude aliases..."
    
    cat >> "$HOME/.zshrc" << 'EOF'

# Claude aliases
alias cl='claude'
alias clc='claude chat'

# Claude Flow core commands
alias clf='claude-flow'
alias clf-init='claude-flow config init'
alias clf-start='claude-flow start'
alias clf-stop='claude-flow stop'
alias clf-status='claude-flow system status'

# Claude Flow swarm commands
alias swarm='npx claude-flow swarm'
alias hive-mind='npx claude-flow hive-mind spawn'
alias queen='npx claude-flow queen'
alias swarm-status='claude-flow agent list'
alias memory-stats='claude-flow memory stats'
alias mcp-status='claude-flow mcp status'

# Claude Flow GitHub integration
alias clf-gh-analyze='npx claude-flow github gh-coordinator analyze'
alias clf-pr-review='npx claude-flow github pr-manager review --multi-reviewer --ai-powered'
alias clf-release='npx claude-flow github release-manager coord'
alias clf-repo-optimize='npx claude-flow github repo-architect optimize'

# Claude Flow quick tasks
alias clf-api='swarm "build me a REST API"'
alias clf-microservices='hive-mind "Create microservices architecture" --agents 8 --claude'
alias clf-debug='claude-flow logs --level debug'
alias clf-resources='claude-flow system resources'
EOF
    
    cp "$HOME/.zshrc" "$HOME/.bashrc"
    
    log "Claude aliases configured"
}

main() {
    log "Starting Claude and Claude Flow setup with verification protocols..."
    
    install_claude_code
    install_claude_flow
    configure_claude_code
    setup_claude_flow_project
    create_claude_md
    copy_verification_files
    setup_claude_agents
    setup_claude_aliases
    
    # Initialize Claude Flow system
    if command -v claude-flow &> /dev/null; then
        log "Initializing Claude Flow orchestrator..."
        claude-flow config set orchestrator.maxConcurrentAgents 8 || true
        claude-flow config set memory.backend sqlite || true
        log "Claude Flow configuration complete"
    fi
    
    log "Claude and Claude Flow setup completed"
    
    if command -v claude &> /dev/null; then
        log "Claude Code is ready. Run 'claude' to start."
    fi
    
    if command -v claude-flow &> /dev/null; then
        log "Claude Flow is ready with Hive-Mind intelligence."
        log "Quick start: 'swarm \"build me a REST API\"'"
    fi
}

main