import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

interface MonorepoManageArgs {
  action: 'init' | 'plan' | 'add-package' | 'check-deps';
  packageName?: string;
  packageType?: 'app' | 'package' | 'tool';
  analysisReport?: string;
}

export class MonorepoManageHandler {
  private scriptPath: string;
  private checkDepsPath: string;

  constructor() {
    this.scriptPath = path.resolve(
      process.cwd(),
      'scripts/monorepo/monorepo-setup.ts'
    );
    this.checkDepsPath = path.resolve(
      process.cwd(),
      'scripts/monorepo/check-dependencies.ts'
    );
  }

  async execute(args: MonorepoManageArgs): Promise<string> {
    const { action, packageName, packageType, analysisReport } = args;

    try {
      switch (action) {
        case 'init':
          return this.initializeMonorepo();

        case 'plan':
          if (!analysisReport) {
            throw new Error(
              'Analysis report path required for migration planning'
            );
          }
          return this.generateMigrationPlan(analysisReport);

        case 'add-package':
          if (!packageName) {
            throw new Error('Package name required for add-package action');
          }
          return this.addPackage(packageName, packageType || 'package');

        case 'check-deps':
          return this.checkDependencies();

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Monorepo management failed: ${error.message}`);
      }
      throw error;
    }
  }

  private initializeMonorepo(): string {
    if (!fs.existsSync(this.scriptPath)) {
      throw new Error(`Monorepo setup script not found at: ${this.scriptPath}`);
    }

    const output = execSync(`npx ts-node ${this.scriptPath} init`, {
      encoding: 'utf-8',
      cwd: process.cwd(),
    });

    // Parse the created structure
    const createdDirs = ['packages', 'apps', 'tools', 'docs', 'scripts'];
    const createdConfigs = [
      'package.json',
      'pnpm-workspace.yaml',
      'tsconfig.json',
      'turbo.json',
      '.gitignore',
      '.npmrc',
    ];

    return JSON.stringify(
      {
        success: true,
        action: 'init',
        structure: {
          directories: createdDirs,
          configs: createdConfigs,
        },
        packageManager: 'pnpm',
        nextSteps: [
          'Run: pnpm install',
          'Migrate existing code to packages/',
          'Update imports to use package names',
          'Run: pnpm run build',
          'Start development: pnpm run dev',
        ],
        message: 'Monorepo structure created successfully!',
        details: output,
      },
      null,
      2
    );
  }

  private generateMigrationPlan(analysisReport: string): string {
    if (!fs.existsSync(analysisReport)) {
      throw new Error(`Analysis report not found: ${analysisReport}`);
    }

    const output = execSync(
      `npx ts-node ${this.scriptPath} plan ${analysisReport}`,
      {
        encoding: 'utf-8',
        cwd: process.cwd(),
      }
    );

    // Read the generated migration plan
    const migrationPlanPath = path.join(process.cwd(), 'MIGRATION_PLAN.md');
    let migrationPlan = '';

    if (fs.existsSync(migrationPlanPath)) {
      migrationPlan = fs.readFileSync(migrationPlanPath, 'utf-8');
    }

    return JSON.stringify(
      {
        success: true,
        action: 'plan',
        planPath: 'MIGRATION_PLAN.md',
        summary: 'Migration plan generated successfully',
        phases: this.extractPhasesFromPlan(migrationPlan),
        verificationSteps: [
          'Run type checking: pnpm run type-check',
          'Run tests: pnpm run test',
          'Check circular dependencies: pnpm run check:deps',
          'Build all packages: pnpm run build',
        ],
        details: output,
      },
      null,
      2
    );
  }

  private addPackage(
    packageName: string,
    packageType: 'app' | 'package' | 'tool'
  ): string {
    const addPackageScript = path.join(process.cwd(), 'scripts/add-package.sh');

    // Create the script if it doesn't exist
    if (!fs.existsSync(addPackageScript)) {
      this.createAddPackageScript(addPackageScript);
    }

    const output = execSync(
      `bash ${addPackageScript} ${packageName} ${packageType}`,
      {
        encoding: 'utf-8',
        cwd: process.cwd(),
      }
    );

    const packageDir =
      packageType === 'app' ? `apps/${packageName}` : `packages/${packageName}`;
    const fullPackageName = `@company/${packageName}`;

    return JSON.stringify(
      {
        success: true,
        action: 'add-package',
        package: {
          name: fullPackageName,
          type: packageType,
          path: packageDir,
        },
        createdFiles: [
          `${packageDir}/package.json`,
          `${packageDir}/tsconfig.json`,
          `${packageDir}/src/index.ts`,
          `${packageDir}/README.md`,
        ],
        nextSteps: [
          `cd ${packageDir}`,
          'Start adding your code in src/',
          'Run "pnpm install" from the root',
        ],
        message: `Package ${fullPackageName} created successfully!`,
        details: output,
      },
      null,
      2
    );
  }

  private checkDependencies(): string {
    if (!fs.existsSync(this.checkDepsPath)) {
      throw new Error(
        `Check dependencies script not found at: ${this.checkDepsPath}`
      );
    }

    try {
      const output = execSync(`npx ts-node ${this.checkDepsPath}`, {
        encoding: 'utf-8',
        cwd: process.cwd(),
      });

      const hasCircular = output.includes('Circular dependency detected');
      const circularDeps: string[] = [];

      if (hasCircular) {
        // Extract circular dependency paths
        const lines = output.split('\n');
        for (const line of lines) {
          if (line.includes('Circular dependency detected:')) {
            const depPath = line.substring(line.indexOf(':') + 1).trim();
            circularDeps.push(depPath);
          }
        }
      }

      return JSON.stringify(
        {
          success: !hasCircular,
          action: 'check-deps',
          hasCircularDependencies: hasCircular,
          circularDependencies: circularDeps,
          message: hasCircular
            ? `Found ${circularDeps.length} circular dependencies`
            : 'No circular dependencies found!',
          recommendation: hasCircular
            ? 'Refactor to remove circular dependencies before proceeding'
            : 'Dependencies are healthy',
          details: output,
        },
        null,
        2
      );
    } catch (error) {
      // Script exits with 1 if circular deps found
      const errorOutput =
        error instanceof Error ? error.message : String(error);
      return JSON.stringify(
        {
          success: false,
          action: 'check-deps',
          hasCircularDependencies: true,
          error: 'Circular dependencies detected',
          details: errorOutput,
        },
        null,
        2
      );
    }
  }

  private extractPhasesFromPlan(planContent: string): any[] {
    const phases: any[] = [];
    const phaseMatches = planContent.matchAll(
      /### Phase (\d+): (.+)\n\n\*\*Target Package\*\*: (.+)\n\*\*Files to Move\*\*: (\d+)/g
    );

    for (const match of phaseMatches) {
      phases.push({
        phase: parseInt(match[1], 10),
        name: match[2],
        targetPackage: match[3],
        filesToMove: parseInt(match[4], 10),
      });
    }

    return phases;
  }

  private createAddPackageScript(scriptPath: string): void {
    const script = `#!/bin/bash
# Auto-generated add-package script

PACKAGE_NAME=$1
PACKAGE_TYPE=\${2:-package}

if [ -z "$PACKAGE_NAME" ]; then
  echo "Usage: $0 <package-name> [package|app|tool]"
  exit 1
fi

# Determine directory
case "$PACKAGE_TYPE" in
  app)
    PACKAGE_DIR="apps/$PACKAGE_NAME"
    ;;
  tool)
    PACKAGE_DIR="tools/$PACKAGE_NAME"
    ;;
  *)
    PACKAGE_DIR="packages/$PACKAGE_NAME"
    ;;
esac

echo "Creating new package: @company/$PACKAGE_NAME in $PACKAGE_DIR"

# Create directory structure
mkdir -p "$PACKAGE_DIR/src"

# Create package.json
cat > "$PACKAGE_DIR/package.json" << EOF
{
  "name": "@company/$PACKAGE_NAME",
  "version": "0.0.0",
  "description": "Description for $PACKAGE_NAME",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "clean": "rm -rf dist"
  }
}
EOF

# Create tsconfig.json
cat > "$PACKAGE_DIR/tsconfig.json" << EOF
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
EOF

# Create index.ts
echo "export const packageName = '@company/$PACKAGE_NAME';" > "$PACKAGE_DIR/src/index.ts"

# Create README
echo "# @company/$PACKAGE_NAME" > "$PACKAGE_DIR/README.md"

echo "✅ Package created successfully!"
`;

    fs.writeFileSync(scriptPath, script);
    fs.chmodSync(scriptPath, '755');
  }
}
