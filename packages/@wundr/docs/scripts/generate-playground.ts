#!/usr/bin/env ts-node

/**
 * Interactive Playground Generator
 * 
 * Generates interactive examples and playground configurations
 * for the Wundr documentation site.
 */

import fs from 'fs-extra';
import path from 'path';

interface PlaygroundExample {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  code: string;
  expectedIssues: string[];
  learningObjectives: string[];
  relatedDocs: string[];
}

interface PlaygroundConfig {
  examples: PlaygroundExample[];
  categories: string[];
  features: {
    aiSuggestions: boolean;
    realTimeAnalysis: boolean;
    shareableLinks: boolean;
    exportResults: boolean;
  };
}

class PlaygroundGenerator {
  private configPath: string;
  private examplesPath: string;
  private outputPath: string;

  constructor() {
    this.configPath = path.resolve(__dirname, '../src/data');
    this.examplesPath = path.resolve(__dirname, '../src/examples');
    this.outputPath = path.resolve(__dirname, '../src/pages/playground.tsx');
  }

  async generate(): Promise<void> {
    console.log('🎯 Generating interactive playground...');
    
    await this.ensureDirectories();
    await this.generateExamples();
    await this.generatePlaygroundConfig();
    await this.generatePlaygroundPage();
    
    console.log('✅ Playground generated successfully!');
  }

  private async ensureDirectories(): Promise<void> {
    await fs.ensureDir(this.configPath);
    await fs.ensureDir(this.examplesPath);
    await fs.ensureDir(path.dirname(this.outputPath));
  }

  private async generateExamples(): Promise<void> {
    const examples: PlaygroundExample[] = [
      {
        id: 'react-component-basic',
        name: 'React Component Analysis',
        description: 'A simple React component with common code quality issues',
        category: 'React',
        difficulty: 'beginner',
        code: `import React, { useState } from 'react';

// This component has several issues for Wundr to detect
export const UserProfile = ({ user }) => {
  const [isEditing, setIsEditing] = useState(false);
  
  // Issue: No error handling
  const handleSave = () => {
    fetch('/api/users/' + user.id, {
      method: 'POST',
      body: JSON.stringify(user)
    });
    setIsEditing(false);
  };
  
  // Issue: Inline styles should be extracted
  const containerStyle = {
    padding: '20px',
    border: '1px solid #ccc',
    borderRadius: '8px',
    backgroundColor: '#f9f9f9'
  };
  
  return (
    <div style={containerStyle}>
      {isEditing ? (
        <div>
          {/* Issue: Accessibility - missing labels */}
          <input type="text" defaultValue={user.name} />
          <input type="email" defaultValue={user.email} />
          <button onClick={handleSave}>Save</button>
          <button onClick={() => setIsEditing(false)}>Cancel</button>
        </div>
      ) : (
        <div>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          <button onClick={() => setIsEditing(true)}>Edit</button>
        </div>
      )}
    </div>
  );
};`,
        expectedIssues: [
          'Missing error handling in API call',
          'Inline styles should be extracted',
          'Missing accessibility labels',
          'Component could benefit from TypeScript',
          'No loading states'
        ],
        learningObjectives: [
          'Identify common React component issues',
          'Understand accessibility concerns',
          'Learn about error handling patterns',
          'Recognize inline style anti-patterns'
        ],
        relatedDocs: [
          '/guides/best-practices/coding-standards',
          '/guides/advanced/pattern-development'
        ]
      },
      {
        id: 'typescript-types',
        name: 'TypeScript Type Safety',
        description: 'Examples of TypeScript code with type-related issues',
        category: 'TypeScript',
        difficulty: 'intermediate',
        code: `// TypeScript code with various type issues
import { Request, Response } from 'express';

// Issue: Using 'any' type defeats the purpose of TypeScript
export const processUserData = (data: any): any => {
  return data.map((item: any) => {
    return {
      ...item,
      processed: true,
      timestamp: new Date().toISOString()
    };
  });
};

// Issue: Missing return type annotation
export const validateUser = (user) => {
  if (!user.email || !user.name) {
    return false;
  }
  return true;
};

// Issue: Non-null assertion without proper checking
export const getUserById = (users: User[], id: string) => {
  const user = users.find(u => u.id === id)!; // Dangerous!
  return user.name.toUpperCase();
};

// Issue: Interface could be more specific
interface User {
  id: string;
  name: string;
  email: string;
  metadata: any; // Should be more specific
}

// Issue: Function signature is too loose
export const apiHandler = (req: Request, res: Response) => {
  const { body } = req;
  // No validation of body structure
  const result = processUserData(body.users);
  res.json(result);
};

// Issue: Duplicate type definitions
type UserProfile = {
  id: string;
  name: string;
  email: string;
};

interface UserDetails { // Essentially the same as UserProfile
  id: string;
  name: string;
  email: string;
}`,
        expectedIssues: [
          'Excessive use of any type',
          'Missing return type annotations',
          'Unsafe non-null assertions',
          'Duplicate type definitions',
          'Insufficient input validation'
        ],
        learningObjectives: [
          'Improve TypeScript type safety',
          'Avoid common TypeScript pitfalls',
          'Create more specific type definitions',
          'Understand proper null checking'
        ],
        relatedDocs: [
          '/guides/best-practices/coding-standards',
          '/docs/concepts/patterns'
        ]
      },
      {
        id: 'node-service-patterns',
        name: 'Node.js Service Architecture',
        description: 'Backend service code with architectural issues',
        category: 'Node.js',
        difficulty: 'advanced',
        code: `// Node.js service with architectural issues
import express from 'express';
import fs from 'fs';
import { MongoClient } from 'mongodb';

// Issue: Global state and no dependency injection
let dbClient: MongoClient;
let isConnected = false;

// Issue: Synchronous file operations
const loadConfig = () => {
  const configData = fs.readFileSync('./config.json', 'utf-8');
  return JSON.parse(configData);
};

// Issue: No error handling, mixed concerns
export class UserService {
  async getUsers() {
    if (!isConnected) {
      dbClient = new MongoClient('mongodb://localhost:27017');
      await dbClient.connect();
      isConnected = true;
    }
    
    // Issue: Direct database access in service
    const db = dbClient.db('myapp');
    const users = await db.collection('users').find({}).toArray();
    
    // Issue: Business logic mixed with data access
    return users.map(user => ({
      ...user,
      displayName: user.firstName + ' ' + user.lastName,
      isActive: user.lastLogin > Date.now() - (30 * 24 * 60 * 60 * 1000)
    }));
  }
  
  // Issue: No input validation
  async createUser(userData: any) {
    const db = dbClient.db('myapp');
    const result = await db.collection('users').insertOne({
      ...userData,
      createdAt: new Date(),
      id: Math.random().toString(36) // Issue: Poor ID generation
    });
    
    // Issue: Logging should be abstracted
    console.log('User created:', result.insertedId);
    
    return result;
  }
  
  // Issue: Duplicate logic from getUsers
  async getUserById(id: string) {
    if (!isConnected) {
      dbClient = new MongoClient('mongodb://localhost:27017');
      await dbClient.connect();
      isConnected = true;
    }
    
    const db = dbClient.db('myapp');
    const user = await db.collection('users').findOne({ id });
    
    if (!user) return null;
    
    return {
      ...user,
      displayName: user.firstName + ' ' + user.lastName,
      isActive: user.lastLogin > Date.now() - (30 * 24 * 60 * 60 * 1000)
    };
  }
}

// Issue: Express setup mixed with business logic
const app = express();
const userService = new UserService();

app.get('/users', async (req, res) => {
  try {
    const users = await userService.getUsers();
    res.json(users);
  } catch (error) {
    // Issue: Poor error handling
    console.error(error);
    res.status(500).send('Something went wrong');
  }
});`,
        expectedIssues: [
          'Global state management',
          'Mixed architectural concerns',
          'Synchronous file operations',
          'Duplicate database connection logic',
          'Poor error handling patterns',
          'No input validation',
          'Weak ID generation strategy'
        ],
        learningObjectives: [
          'Implement dependency injection',
          'Separate data access from business logic',
          'Improve error handling strategies',
          'Apply single responsibility principle',
          'Design better service architectures'
        ],
        relatedDocs: [
          '/guides/advanced/large-scale-deployment',
          '/guides/best-practices/pattern-enforcement',
          '/examples/nodejs-backend'
        ]
      }
    ];

    // Write examples to data file
    const configData: PlaygroundConfig = {
      examples,
      categories: ['React', 'TypeScript', 'Node.js', 'General'],
      features: {
        aiSuggestions: true,
        realTimeAnalysis: true,
        shareableLinks: true,
        exportResults: true
      }
    };

    await fs.writeJSON(
      path.join(this.configPath, 'playground-config.json'),
      configData,
      { spaces: 2 }
    );

    // Write individual example files
    for (const example of examples) {
      await fs.writeFile(
        path.join(this.examplesPath, `${example.id}.ts`),
        example.code
      );
    }
  }

  private async generatePlaygroundConfig(): Promise<void> {
    const config = {
      monaco: {
        theme: 'vs-dark',
        fontSize: 14,
        wordWrap: 'on',
        minimap: { enabled: false },
        lineNumbers: 'on',
        automaticLayout: true
      },
      analysis: {
        debounceMs: 1000,
        maxLines: 2000,
        enableAI: true
      },
      ui: {
        defaultSplit: '50/50',
        collapsiblePanels: true,
        exportFormats: ['json', 'markdown', 'html']
      }
    };

    await fs.writeJSON(
      path.join(this.configPath, 'playground-ui-config.json'),
      config,
      { spaces: 2 }
    );
  }

  private async generatePlaygroundPage(): Promise<void> {
    const pageContent = `import React from 'react';
import Layout from '@theme/Layout';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Playground from '../components/Playground';

export default function PlaygroundPage(): JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  
  return (
    <Layout
      title="Interactive Playground"
      description="Try Wundr's analysis capabilities with your own code or explore our examples"
    >
      <div className="container margin-vert--lg">
        <Playground />
      </div>
    </Layout>
  );
}`;

    await fs.writeFile(this.outputPath, pageContent);
  }
}

// Multi-language content generator
class I18nGenerator {
  private localesPath: string;
  private supportedLocales = ['en', 'es', 'fr', 'de'];

  constructor() {
    this.localesPath = path.resolve(__dirname, '../i18n');
  }

  async generate(): Promise<void> {
    console.log('🌍 Generating i18n content...');
    
    for (const locale of this.supportedLocales) {
      await this.generateLocaleContent(locale);
    }
    
    console.log('✅ I18n content generated successfully!');
  }

  private async generateLocaleContent(locale: string): Promise<void> {
    const localeDir = path.join(this.localesPath, locale);
    await fs.ensureDir(localeDir);
    
    // Generate translation files
    const translations = this.getTranslations(locale);
    
    await fs.writeJSON(
      path.join(localeDir, 'docusaurus-plugin-content-docs', 'current.json'),
      translations.docs,
      { spaces: 2 }
    );
    
    await fs.writeJSON(
      path.join(localeDir, 'docusaurus-plugin-content-pages', 'current.json'),
      translations.pages,
      { spaces: 2 }
    );
    
    await fs.writeJSON(
      path.join(localeDir, 'docusaurus-theme-classic', 'navbar.json'),
      translations.navbar,
      { spaces: 2 }
    );
  }

  private getTranslations(locale: string) {
    const translations = {
      en: {
        docs: {
          'sidebar.tutorialSidebar.category.Getting Started': 'Getting Started',
          'sidebar.tutorialSidebar.category.Core Concepts': 'Core Concepts',
          'sidebar.tutorialSidebar.category.CLI Commands': 'CLI Commands',
          'sidebar.tutorialSidebar.category.Web Dashboard': 'Web Dashboard'
        },
        pages: {
          'playground.title': 'Interactive Playground',
          'playground.description': 'Try Wundr analysis with your code',
          'playground.analyzeButton': 'Analyze Code',
          'playground.loadTemplate': 'Load Template'
        },
        navbar: {
          'navbar.title': 'Wundr',
          'navbar.item.label.Documentation': 'Documentation',
          'navbar.item.label.API Reference': 'API Reference',
          'navbar.item.label.Guides': 'Guides',
          'navbar.item.label.Playground': 'Playground'
        }
      },
      es: {
        docs: {
          'sidebar.tutorialSidebar.category.Getting Started': 'Primeros Pasos',
          'sidebar.tutorialSidebar.category.Core Concepts': 'Conceptos Básicos',
          'sidebar.tutorialSidebar.category.CLI Commands': 'Comandos CLI',
          'sidebar.tutorialSidebar.category.Web Dashboard': 'Panel Web'
        },
        pages: {
          'playground.title': 'Playground Interactivo',
          'playground.description': 'Prueba el análisis de Wundr con tu código',
          'playground.analyzeButton': 'Analizar Código',
          'playground.loadTemplate': 'Cargar Plantilla'
        },
        navbar: {
          'navbar.title': 'Wundr',
          'navbar.item.label.Documentation': 'Documentación',
          'navbar.item.label.API Reference': 'Referencia API',
          'navbar.item.label.Guides': 'Guías',
          'navbar.item.label.Playground': 'Playground'
        }
      },
      fr: {
        docs: {
          'sidebar.tutorialSidebar.category.Getting Started': 'Commencer',
          'sidebar.tutorialSidebar.category.Core Concepts': 'Concepts de Base',
          'sidebar.tutorialSidebar.category.CLI Commands': 'Commandes CLI',
          'sidebar.tutorialSidebar.category.Web Dashboard': 'Tableau de Bord'
        },
        pages: {
          'playground.title': 'Terrain de Jeu Interactif',
          'playground.description': 'Essayez l\'analyse Wundr avec votre code',
          'playground.analyzeButton': 'Analyser le Code',
          'playground.loadTemplate': 'Charger un Modèle'
        },
        navbar: {
          'navbar.title': 'Wundr',
          'navbar.item.label.Documentation': 'Documentation',
          'navbar.item.label.API Reference': 'Référence API',
          'navbar.item.label.Guides': 'Guides',
          'navbar.item.label.Playground': 'Terrain de Jeu'
        }
      },
      de: {
        docs: {
          'sidebar.tutorialSidebar.category.Getting Started': 'Erste Schritte',
          'sidebar.tutorialSidebar.category.Core Concepts': 'Grundkonzepte',
          'sidebar.tutorialSidebar.category.CLI Commands': 'CLI-Befehle',
          'sidebar.tutorialSidebar.category.Web Dashboard': 'Web-Dashboard'
        },
        pages: {
          'playground.title': 'Interaktiver Spielplatz',
          'playground.description': 'Testen Sie die Wundr-Analyse mit Ihrem Code',
          'playground.analyzeButton': 'Code Analysieren',
          'playground.loadTemplate': 'Vorlage Laden'
        },
        navbar: {
          'navbar.title': 'Wundr',
          'navbar.item.label.Documentation': 'Dokumentation',
          'navbar.item.label.API Reference': 'API-Referenz',
          'navbar.item.label.Guides': 'Anleitungen',
          'navbar.item.label.Playground': 'Spielplatz'
        }
      }
    };

    return translations[locale as keyof typeof translations] || translations.en;
  }
}

// Pipeline automation setup
class PipelineGenerator {
  private workflowsPath: string;

  constructor() {
    this.workflowsPath = path.resolve(__dirname, '../../../.github/workflows');
  }

  async generate(): Promise<void> {
    console.log('⚙️ Generating documentation pipeline...');
    
    await fs.ensureDir(this.workflowsPath);
    await this.generateDocsBuildWorkflow();
    await this.generateAPIDocsWorkflow();
    
    console.log('✅ Documentation pipeline generated!');
  }

  private async generateDocsBuildWorkflow(): Promise<void> {
    const workflow = `name: Documentation Build and Deploy

on:
  push:
    branches: [ main, master ]
    paths: 
      - 'packages/@wundr/docs/**'
      - 'tools/web-client/app/api/**'
      - 'docs/**'
  pull_request:
    branches: [ main, master ]
    paths:
      - 'packages/@wundr/docs/**'
      - 'tools/web-client/app/api/**'
      - 'docs/**'

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout
      uses: actions/checkout@v4
      
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'pnpm'
        
    - name: Install dependencies
      run: pnpm install
      
    - name: Generate API documentation
      run: |
        cd packages/@wundr/docs
        pnpm run generate-api-docs
        
    - name: Generate playground examples
      run: |
        cd packages/@wundr/docs
        pnpm run generate-playground
        
    - name: Build documentation
      run: |
        cd packages/@wundr/docs
        pnpm run build
        
    - name: Test documentation build
      run: |
        cd packages/@wundr/docs
        pnpm run serve &
        sleep 5
        curl -f http://localhost:3000 || exit 1
        
  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    
    steps:
    - name: Checkout
      uses: actions/checkout@v4
      
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'pnpm'
        
    - name: Install dependencies
      run: pnpm install
      
    - name: Build and Deploy
      run: |
        cd packages/@wundr/docs
        pnpm run generate-api-docs
        pnpm run generate-playground
        pnpm run build
        
    - name: Deploy to GitHub Pages
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: \${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./packages/@wundr/docs/build
        
  accessibility:
    runs-on: ubuntu-latest
    needs: build
    
    steps:
    - name: Checkout
      uses: actions/checkout@v4
      
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'pnpm'
        
    - name: Install dependencies
      run: pnpm install
      
    - name: Build documentation
      run: |
        cd packages/@wundr/docs
        pnpm run build
        
    - name: Run accessibility tests
      run: |
        npx @axe-core/cli ./packages/@wundr/docs/build
`;

    await fs.writeFile(
      path.join(this.workflowsPath, 'docs-build.yml'),
      workflow
    );
  }

  private async generateAPIDocsWorkflow(): Promise<void> {
    const workflow = `name: API Documentation Update

on:
  push:
    branches: [ main, master ]
    paths:
      - 'tools/web-client/app/api/**/*.ts'
  schedule:
    # Update API docs daily at 2 AM UTC
    - cron: '0 2 * * *'

jobs:
  update-api-docs:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout
      uses: actions/checkout@v4
      with:
        token: \${{ secrets.GITHUB_TOKEN }}
        
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'pnpm'
        
    - name: Install dependencies
      run: pnpm install
      
    - name: Generate API documentation
      run: |
        cd packages/@wundr/docs
        pnpm run generate-api-docs
        
    - name: Check for changes
      id: verify-changed-files
      run: |
        if [ -n "$(git status --porcelain)" ]; then
          echo "changed=true" >> $GITHUB_OUTPUT
        else
          echo "changed=false" >> $GITHUB_OUTPUT
        fi
        
    - name: Commit changes
      if: steps.verify-changed-files.outputs.changed == 'true'
      run: |
        git config --local user.email "action@github.com"
        git config --local user.name "GitHub Action"
        git add packages/@wundr/docs/api/
        git commit -m "docs: update API documentation

        🤖 Generated with GitHub Actions
        
        Co-Authored-By: Documentation Bot <noreply@wundr.io>"
        git push
        
    - name: Create PR for major changes
      if: steps.verify-changed-files.outputs.changed == 'true'
      uses: peter-evans/create-pull-request@v5
      with:
        token: \${{ secrets.GITHUB_TOKEN }}
        title: "📚 Update API Documentation"
        body: |
          ## API Documentation Update
          
          This PR contains automatically generated updates to the API documentation based on changes to the web client API routes.
          
          ### Changes Detected:
          - Updated API endpoint documentation
          - Refreshed OpenAPI specification
          - Synchronized examples and schemas
          
          ### Review Checklist:
          - [ ] Verify new endpoints are documented correctly
          - [ ] Check that examples are accurate
          - [ ] Ensure breaking changes are highlighted
          - [ ] Validate OpenAPI spec syntax
          
          🤖 Auto-generated by GitHub Actions
        branch: docs/api-update
        delete-branch: true
`;

    await fs.writeFile(
      path.join(this.workflowsPath, 'api-docs-update.yml'),
      workflow
    );
  }
}

// Main execution
async function main() {
  try {
    const playgroundGenerator = new PlaygroundGenerator();
    await playgroundGenerator.generate();
    
    const i18nGenerator = new I18nGenerator();
    await i18nGenerator.generate();
    
    const pipelineGenerator = new PipelineGenerator();
    await pipelineGenerator.generate();
    
    console.log('🎉 All documentation components generated successfully!');
  } catch (error) {
    console.error('❌ Error generating documentation:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { PlaygroundGenerator, I18nGenerator, PipelineGenerator };