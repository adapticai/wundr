/**
 * Module declarations for packages without TypeScript definitions
 * These provide basic type information for untyped dependencies
 */

// Common Node.js modules that might not have complete types
declare module 'shelljs' {
  export function exec(command: string, options?: any): any;
  export function mkdir(path: string, options?: any): void;
  export function cp(source: string, dest: string, options?: any): void;
  export function rm(path: string, options?: any): void;
  export function cd(path: string): void;
  export function pwd(): string;
  export function ls(path?: string): string[];
  export function find(path: string): string[];
  export function grep(pattern: string, files: string[]): string;
  export function sed(pattern: string, replacement: string, file: string): void;
  export function which(command: string): string | null;
  export function test(flag: string, path: string): boolean;
  export const config: {
    silent: boolean;
    fatal: boolean;
    verbose: boolean;
  };
}

declare module 'glob' {
  interface Options {
    cwd?: string;
    root?: string;
    dot?: boolean;
    nomount?: boolean;
    mark?: boolean;
    nosort?: boolean;
    stat?: boolean;
    silent?: boolean;
    strict?: boolean;
    cache?: any;
    statCache?: any;
    symlinks?: any;
    realpathCache?: any;
    noext?: boolean;
    nocase?: boolean;
    matchBase?: boolean;
    nodir?: boolean;
    ignore?: string | string[];
    follow?: boolean;
    realpath?: boolean;
    nonegate?: boolean;
    nocomment?: boolean;
    globstar?: boolean;
    debug?: boolean;
    nobrace?: boolean;
    noglobstar?: boolean;
    nocase?: boolean;
    nonull?: boolean;
    nounique?: boolean;
  }

  function glob(pattern: string, callback: (err: Error | null, matches: string[]) => void): void;
  function glob(pattern: string, options: Options, callback: (err: Error | null, matches: string[]) => void): void;
  
  namespace glob {
    function sync(pattern: string, options?: Options): string[];
    function hasMagic(pattern: string, options?: Options): boolean;
  }

  export = glob;
}

declare module 'ts-morph' {
  export class Project {
    constructor(options?: any);
    addSourceFilesAtPaths(patterns: string[]): void;
    getSourceFiles(): SourceFile[];
    getSourceFile(path: string): SourceFile | undefined;
    createSourceFile(path: string, content: string): SourceFile;
    save(): Promise<void>;
  }

  export class SourceFile {
    getFilePath(): string;
    getClasses(): ClassDeclaration[];
    getInterfaces(): InterfaceDeclaration[];
    getFunctions(): FunctionDeclaration[];
    getEnums(): EnumDeclaration[];
    getTypeAliases(): TypeAliasDeclaration[];
    getExportedDeclarations(): Map<string, ExportedDeclarations[]>;
    getImportDeclarations(): ImportDeclaration[];
    getText(): string;
    getFullText(): string;
  }

  export class Node {
    getKind(): number;
    getKindName(): string;
    getText(): string;
    getStart(): number;
    getEnd(): number;
    getStartLineNumber(): number;
    getEndLineNumber(): number;
  }

  export class ClassDeclaration extends Node {
    getName(): string | undefined;
    getMethods(): MethodDeclaration[];
    getProperties(): PropertyDeclaration[];
    getConstructors(): ConstructorDeclaration[];
  }

  export class InterfaceDeclaration extends Node {
    getName(): string;
    getProperties(): PropertySignature[];
    getMethods(): MethodSignature[];
  }

  export class FunctionDeclaration extends Node {
    getName(): string | undefined;
    getParameters(): ParameterDeclaration[];
    getReturnType(): Type;
  }

  export class EnumDeclaration extends Node {
    getName(): string;
    getMembers(): EnumMember[];
  }

  export class TypeAliasDeclaration extends Node {
    getName(): string;
    getTypeNode(): TypeNode;
  }

  export class Type {
    getText(): string;
    getSymbol(): Symbol | undefined;
  }

  export type ExportedDeclarations = 
    | ClassDeclaration 
    | InterfaceDeclaration 
    | FunctionDeclaration 
    | EnumDeclaration 
    | TypeAliasDeclaration;

  export type ImportDeclaration = any;
  export type MethodDeclaration = any;
  export type PropertyDeclaration = any;
  export type ConstructorDeclaration = any;
  export type PropertySignature = any;
  export type MethodSignature = any;
  export type ParameterDeclaration = any;
  export type EnumMember = any;
  export type TypeNode = any;
  export type Symbol = any;
}

declare module 'commander' {
  export interface Command {
    version(version: string): Command;
    description(description: string): Command;
    option(flags: string, description?: string, defaultValue?: any): Command;
    argument(name: string, description?: string): Command;
    action(fn: (...args: any[]) => void | Promise<void>): Command;
    command(nameAndArgs: string): Command;
    parse(argv?: string[]): Command;
    opts(): any;
    args: string[];
  }

  export function program(): Command;
  export { Command };
}

declare module 'chalk' {
  interface ChalkInstance {
    (text: string): string;
    reset: ChalkInstance;
    bold: ChalkInstance;
    dim: ChalkInstance;
    italic: ChalkInstance;
    underline: ChalkInstance;
    inverse: ChalkInstance;
    hidden: ChalkInstance;
    strikethrough: ChalkInstance;
    black: ChalkInstance;
    red: ChalkInstance;
    green: ChalkInstance;
    yellow: ChalkInstance;
    blue: ChalkInstance;
    magenta: ChalkInstance;
    cyan: ChalkInstance;
    white: ChalkInstance;
    gray: ChalkInstance;
    grey: ChalkInstance;
    bgBlack: ChalkInstance;
    bgRed: ChalkInstance;
    bgGreen: ChalkInstance;
    bgYellow: ChalkInstance;
    bgBlue: ChalkInstance;
    bgMagenta: ChalkInstance;
    bgCyan: ChalkInstance;
    bgWhite: ChalkInstance;
  }

  const chalk: ChalkInstance;
  export = chalk;
}

declare module 'ora' {
  interface Options {
    text?: string;
    spinner?: string | object;
    color?: string;
    hideCursor?: boolean;
    indent?: number;
    interval?: number;
    stream?: NodeJS.WriteStream;
    isEnabled?: boolean;
    isSilent?: boolean;
    discardStdin?: boolean;
  }

  interface Ora {
    start(text?: string): Ora;
    stop(): Ora;
    succeed(text?: string): Ora;
    fail(text?: string): Ora;
    warn(text?: string): Ora;
    info(text?: string): Ora;
    stopAndPersist(options?: { symbol?: string; text?: string }): Ora;
    clear(): Ora;
    render(): Ora;
    frame(): string;
    text: string;
    color: string;
    isSpinning: boolean;
  }

  function ora(options?: string | Options): Ora;
  export = ora;
}

declare module 'inquirer' {
  interface Question {
    type?: string;
    name: string;
    message: string | ((answers: any) => string);
    default?: any;
    choices?: any[];
    validate?: (input: any) => boolean | string;
    filter?: (input: any) => any;
    when?: (answers: any) => boolean;
  }

  function prompt(questions: Question[]): Promise<any>;
  export { prompt, Question };
}

declare module 'semver' {
  function valid(version: string): string | null;
  function clean(version: string): string | null;
  function inc(version: string, release: ReleaseType): string | null;
  function major(version: string): number;
  function minor(version: string): number;
  function patch(version: string): number;
  function compare(v1: string, v2: string): -1 | 0 | 1;
  function gt(v1: string, v2: string): boolean;
  function gte(v1: string, v2: string): boolean;
  function lt(v1: string, v2: string): boolean;
  function lte(v1: string, v2: string): boolean;
  function eq(v1: string, v2: string): boolean;
  function satisfies(version: string, range: string): boolean;

  type ReleaseType = 'major' | 'premajor' | 'minor' | 'preminor' | 'patch' | 'prepatch' | 'prerelease';

  export {
    valid,
    clean,
    inc,
    major,
    minor,
    patch,
    compare,
    gt,
    gte,
    lt,
    lte,
    eq,
    satisfies,
    ReleaseType
  };
}

// Custom modules for this toolkit
declare module '@scripts/*' {
  const module: any;
  export default module;
}

declare module '@config/*' {
  const module: any;
  export default module;
}

declare module '@templates/*' {
  const module: any;
  export default module;
}