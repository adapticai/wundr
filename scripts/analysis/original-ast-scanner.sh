#!/usr/bin/env node
import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface CodeEntity {
  name: string;
  type: 'class' | 'interface' | 'type' | 'enum' | 'function' | 'const' | 'service';
  file: string;
  line: number;
  column: number;
  exportType: 'default' | 'named' | 'none';
  imports: string[];
  extends?: string[];
  implements?: string[];
  methods?: string[];
  properties?: string[];
  parameters?: string[];
  returnType?: string;
  value?: string;
  jsDoc?: string;
}

interface ImportInfo {
  source: string;
  specifiers: string[];
  file: string;
  line: number;
}

export class ASTScanner {
  private entities: CodeEntity[] = [];
  private imports: ImportInfo[] = [];

  async scanProject(rootDir: string, pattern = '**/*.ts') {
    const files = await glob(pattern, {
      cwd: rootDir,
      ignore: ['**/node_modules/**', '**/*.d.ts', '**/*.test.ts', '**/*.spec.ts']
    });

    for (const file of files) {
      const filePath = path.join(rootDir, file);
      await this.analyzeFile(filePath);
    }

    return {
      entities: this.entities,
      imports: this.imports,
      summary: this.generateSummary()
    };
  }

  private async analyzeFile(filePath: string) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    const visit = (node: ts.Node) => {
      // Extract imports
      if (ts.isImportDeclaration(node)) {
        this.extractImport(node, filePath);
      }

      // Extract classes
      if (ts.isClassDeclaration(node) && node.name) {
        this.extractClass(node, filePath);
      }

      // Extract interfaces
      if (ts.isInterfaceDeclaration(node)) {
        this.extractInterface(node, filePath);
      }

      // Extract type aliases
      if (ts.isTypeAliasDeclaration(node)) {
        this.extractTypeAlias(node, filePath);
      }

      // Extract enums
      if (ts.isEnumDeclaration(node)) {
        this.extractEnum(node, filePath);
      }

      // Extract functions
      if (ts.isFunctionDeclaration(node) && node.name) {
        this.extractFunction(node, filePath);
      }

      // Extract exported const variables
      if (ts.isVariableStatement(node)) {
        this.extractVariables(node, filePath);
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  private extractImport(node: ts.ImportDeclaration, filePath: string) {
    const moduleSpecifier = node.moduleSpecifier as ts.StringLiteral;
    const specifiers: string[] = [];

    if (node.importClause) {
      if (node.importClause.name) {
        specifiers.push(node.importClause.name.text);
      }
      if (node.importClause.namedBindings) {
        if (ts.isNamespaceImport(node.importClause.namedBindings)) {
          specifiers.push(`* as ${node.importClause.namedBindings.name.text}`);
        } else if (ts.isNamedImports(node.importClause.namedBindings)) {
          node.importClause.namedBindings.elements.forEach(element => {
            specifiers.push(element.name.text);
          });
        }
      }
    }

    this.imports.push({
      source: moduleSpecifier.text,
      specifiers,
      file: filePath,
      line: this.getLineNumber(node)
    });
  }

  private extractClass(node: ts.ClassDeclaration, filePath: string) {
    const className = node.name!.text;
    const methods: string[] = [];
    const properties: string[] = [];
    const jsDoc = this.extractJsDoc(node);

    // Check if it's a service
    const isService = className.toLowerCase().includes('service') ||
                     (jsDoc && jsDoc.toLowerCase().includes('service'));

    node.members.forEach(member => {
      if (ts.isMethodDeclaration(member) || ts.isMethodSignature(member)) {
        const name = member.name && ts.isIdentifier(member.name) ? member.name.text : '';
        if (name) methods.push(name);
      } else if (ts.isPropertyDeclaration(member) || ts.isPropertySignature(member)) {
        const name = member.name && ts.isIdentifier(member.name) ? member.name.text : '';
        if (name) properties.push(name);
      }
    });

    this.entities.push({
      name: className,
      type: isService ? 'service' : 'class',
      file: filePath,
      line: this.getLineNumber(node),
      column: this.getColumnNumber(node),
      exportType: this.getExportType(node),
      imports: this.getCurrentFileImports(filePath),
      extends: this.getExtends(node),
      implements: this.getImplements(node),
      methods,
      properties,
      jsDoc
    });
  }

  private extractInterface(node: ts.InterfaceDeclaration, filePath: string) {
    const properties: string[] = [];
    const methods: string[] = [];

    node.members.forEach(member => {
      if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
        properties.push(member.name.text);
      } else if (ts.isMethodSignature(member) && member.name && ts.isIdentifier(member.name)) {
        methods.push(member.name.text);
      }
    });

    this.entities.push({
      name: node.name.text,
      type: 'interface',
      file: filePath,
      line: this.getLineNumber(node),
      column: this.getColumnNumber(node),
      exportType: this.getExportType(node),
      imports: this.getCurrentFileImports(filePath),
      extends: this.getInterfaceExtends(node),
      properties,
      methods,
      jsDoc: this.extractJsDoc(node)
    });
  }

  private extractTypeAlias(node: ts.TypeAliasDeclaration, filePath: string) {
    this.entities.push({
      name: node.name.text,
      type: 'type',
      file: filePath,
      line: this.getLineNumber(node),
      column: this.getColumnNumber(node),
      exportType: this.getExportType(node),
      imports: this.getCurrentFileImports(filePath),
      jsDoc: this.extractJsDoc(node)
    });
  }

  private extractEnum(node: ts.EnumDeclaration, filePath: string) {
    const members = node.members.map(member =>
      member.name && ts.isIdentifier(member.name) ? member.name.text : ''
    ).filter(Boolean);

    this.entities.push({
      name: node.name.text,
      type: 'enum',
      file: filePath,
      line: this.getLineNumber(node),
      column: this.getColumnNumber(node),
      exportType: this.getExportType(node),
      imports: this.getCurrentFileImports(filePath),
      properties: members,
      jsDoc: this.extractJsDoc(node)
    });
  }

  private extractFunction(node: ts.FunctionDeclaration, filePath: string) {
    const parameters = node.parameters.map(param =>
      param.name && ts.isIdentifier(param.name) ? param.name.text : ''
    ).filter(Boolean);

    this.entities.push({
      name: node.name!.text,
      type: 'function',
      file: filePath,
      line: this.getLineNumber(node),
      column: this.getColumnNumber(node),
      exportType: this.getExportType(node),
      imports: this.getCurrentFileImports(filePath),
      parameters,
      returnType: node.type ? node.type.getText() : 'any',
      jsDoc: this.extractJsDoc(node)
    });
  }

  private extractVariables(node: ts.VariableStatement, filePath: string) {
    const isExported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);

    node.declarationList.declarations.forEach(decl => {
      if (ts.isIdentifier(decl.name) && node.declarationList.flags & ts.NodeFlags.Const) {
        this.entities.push({
          name: decl.name.text,
          type: 'const',
          file: filePath,
          line: this.getLineNumber(decl),
          column: this.getColumnNumber(decl),
          exportType: isExported ? 'named' : 'none',
          imports: this.getCurrentFileImports(filePath),
          value: decl.initializer ? decl.initializer.getText().substring(0, 100) : undefined,
          jsDoc: this.extractJsDoc(node)
        });
      }
    });
  }

  private getLineNumber(node: ts.Node): number {
    const sourceFile = node.getSourceFile();
    return sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  }

  private getColumnNumber(node: ts.Node): number {
    const sourceFile = node.getSourceFile();
    return sourceFile.getLineAndCharacterOfPosition(node.getStart()).character + 1;
  }

  private getExportType(node: ts.Node): 'default' | 'named' | 'none' {
    if (!node.modifiers) return 'none';

    const hasExport = node.modifiers.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
    const hasDefault = node.modifiers.some(m => m.kind === ts.SyntaxKind.DefaultKeyword);

    if (hasExport && hasDefault) return 'default';
    if (hasExport) return 'named';
    return 'none';
  }

  private getCurrentFileImports(filePath: string): string[] {
    return this.imports
      .filter(imp => imp.file === filePath)
      .map(imp => imp.source);
  }

  private getExtends(node: ts.ClassDeclaration): string[] {
    if (!node.heritageClauses) return [];

    const extendsClause = node.heritageClauses.find(
      clause => clause.token === ts.SyntaxKind.ExtendsKeyword
    );

    if (!extendsClause) return [];

    return extendsClause.types.map(type => type.expression.getText());
  }

  private getImplements(node: ts.ClassDeclaration): string[] {
    if (!node.heritageClauses) return [];

    const implementsClause = node.heritageClauses.find(
      clause => clause.token === ts.SyntaxKind.ImplementsKeyword
    );

    if (!implementsClause) return [];

    return implementsClause.types.map(type => type.expression.getText());
  }

  private getInterfaceExtends(node: ts.InterfaceDeclaration): string[] {
    if (!node.heritageClauses) return [];

    return node.heritageClauses[0].types.map(type => type.expression.getText());
  }

  private extractJsDoc(node: ts.Node): string | undefined {
    const jsDocComments = ts.getJSDocCommentsAndTags(node);
    if (jsDocComments.length > 0) {
      return jsDocComments[0].getText();
    }
    return undefined;
  }

  private generateSummary() {
    const typeCount = new Map<string, number>();
    this.entities.forEach(entity => {
      typeCount.set(entity.type, (typeCount.get(entity.type) || 0) + 1);
    });

    return {
      totalEntities: this.entities.length,
      byType: Object.fromEntries(typeCount),
      totalImports: this.imports.length,
      uniqueImportSources: new Set(this.imports.map(i => i.source)).size
    };
  }
}

// CLI usage
if (require.main === module) {
  const scanner = new ASTScanner();
  const rootDir = process.argv[2] || '.';

  scanner.scanProject(rootDir).then(results => {
    // Save entities to CSV
    const csv = [
      'name,type,file,line,exportType,extends,implements,methods,properties',
      ...results.entities.map(e =>
        `"${e.name}","${e.type}","${e.file}",${e.line},"${e.exportType}","${(e.extends || []).join(';')}","${(e.implements || []).join(';')}","${(e.methods || []).join(';')}","${(e.properties || []).join(';')}"`
      )
    ].join('\n');
    
    fs.writeFileSync('code-inventory.csv', csv);

    // Save detailed JSON
    fs.writeFileSync('code-inventory.json', JSON.stringify(results, null, 2));

    console.log('Analysis complete!');
    console.log(results.summary);
  });
}
