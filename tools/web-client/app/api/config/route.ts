import { NextRequest, NextResponse } from 'next/server'
import { ApiResponse } from '@/types/data'

// Force dynamic rendering to allow fs access
export const dynamic = 'force-dynamic'
// Ensure this runs only on Node.js runtime
export const runtime = 'nodejs'

// Types for configuration operations
interface ConfigFile {
  name: string
  path: string
  type: 'json' | 'yaml' | 'yml' | 'js' | 'ts' | 'env' | 'toml'
  size: number
  lastModified: string
  content?: Record<string, unknown>
  schema?: ConfigSchema
}

interface ConfigSchema {
  properties: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object'
    description?: string
    default?: unknown
    required?: boolean
    enum?: unknown[]
  }>
  required?: string[]
  additionalProperties?: boolean
}

interface ConfigValidationResult {
  valid: boolean
  errors: Array<{
    path: string
    message: string
    severity: 'error' | 'warning'
  }>
  warnings: Array<{
    path: string
    message: string
    suggestion?: string
  }>
}

interface ConfigTemplate {
  name: string
  description: string
  type: string
  content: Record<string, unknown>
  schema?: ConfigSchema
  tags?: string[]
}

interface ConfigRequest {
  action: 'list' | 'read' | 'write' | 'validate' | 'template' | 'merge' | 'backup'
  configName?: string
  content?: Record<string, unknown>
  templateName?: string
  options?: {
    format?: 'json' | 'yaml' | 'env'
    validate?: boolean
    backup?: boolean
    merge?: boolean
  }
}

// Rate limiting
const requestTracker = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 100 // requests per hour
const RATE_WINDOW = 60 * 60 * 1000 // 1 hour in ms

function checkRateLimit(clientId: string): boolean {
  const now = Date.now()
  const record = requestTracker.get(clientId) || { count: 0, resetTime: now + RATE_WINDOW }
  
  if (now > record.resetTime) {
    record.count = 1
    record.resetTime = now + RATE_WINDOW
  } else {
    record.count++
  }
  
  requestTracker.set(clientId, record)
  return record.count <= RATE_LIMIT
}

// Get project root directory
async function getProjectRoot(): Promise<string> {
  const { promises: fs } = await import('fs')
  const path = await import('path')
  
  let dir = process.cwd()
  while (dir !== path.dirname(dir)) {
    try {
      const packagePath = path.join(dir, 'package.json')
      try {
        await fs.access(packagePath)
        return dir
      } catch {
        // File doesn't exist, continue searching
      }
    } catch (e) {
      // Continue searching
    }
    dir = path.dirname(dir)
  }
  return process.cwd()
}

// Common configuration file patterns
const CONFIG_PATTERNS = [
  // Package managers
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  
  // TypeScript
  'tsconfig.json',
  'tsconfig.*.json',
  
  // Bundlers
  'webpack.config.js',
  'webpack.config.ts',
  'vite.config.js',
  'vite.config.ts',
  'rollup.config.js',
  'rollup.config.ts',
  
  // Testing
  'jest.config.js',
  'jest.config.ts',
  'vitest.config.js',
  'vitest.config.ts',
  
  // Linting/Formatting
  '.eslintrc.json',
  '.eslintrc.js',
  'eslint.config.js',
  '.prettierrc',
  '.prettierrc.json',
  
  // Environment
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  
  // CI/CD
  '.github/workflows/*.yml',
  '.github/workflows/*.yaml',
  'docker-compose.yml',
  'docker-compose.yaml',
  'Dockerfile',
  
  // Wundr specific
  'wundr.config.json',
  'wundr.config.js',
  'CLAUDE.md'
]

// Validate configuration file access
async function validateConfigAccess(configName: string, projectRoot: string): Promise<{ isValid: boolean; resolvedPath: string; error?: string }> {
  try {
    const path = await import('path')
    
    // Prevent path traversal
    if (configName.includes('..') || configName.includes('~') || path.isAbsolute(configName)) {
      return {
        isValid: false,
        resolvedPath: '',
        error: 'Invalid configuration name. Use relative names only.'
      }
    }
    
    const resolvedPath = path.resolve(projectRoot, configName)
    
    // Ensure path is within project root
    if (!resolvedPath.startsWith(projectRoot)) {
      return {
        isValid: false,
        resolvedPath: '',
        error: 'Configuration file outside project root.'
      }
    }
    
    // Check if file matches allowed configuration patterns
    const relativePath = path.relative(projectRoot, resolvedPath)
    const isAllowedConfig = CONFIG_PATTERNS.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace('*', '.*'))
        return regex.test(relativePath)
      }
      return relativePath === pattern || relativePath.endsWith('/' + pattern)
    })
    
    if (!isAllowedConfig) {
      return {
        isValid: false,
        resolvedPath: '',
        error: 'Access restricted to known configuration files.'
      }
    }
    
    return { isValid: true, resolvedPath }
  } catch (error) {
    return {
      isValid: false,
      resolvedPath: '',
      error: 'Failed to resolve configuration path.'
    }
  }
}

// Detect configuration file type
function getConfigType(filePath: string): ConfigFile['type'] {
  // Use basic path operations without importing path module
  const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase()
  const basename = filePath.substring(filePath.lastIndexOf('/') + 1)
  
  if (basename.startsWith('.env')) return 'env'
  
  switch (ext) {
    case '.json':
      return 'json'
    case '.yaml':
    case '.yml':
      return 'yaml'
    case '.js':
      return 'js'
    case '.ts':
      return 'ts'
    case '.toml':
      return 'toml'
    default:
      return 'json' // Default fallback
  }
}

// Parse configuration file content
async function parseConfigContent(filePath: string, type: ConfigFile['type']): Promise<any> {
  try {
    const { promises: fs } = await import('fs')
    const content = await fs.readFile(filePath, 'utf8')
    
    switch (type) {
      case 'json':
        return JSON.parse(content)
        
      case 'yaml':
      case 'yml': {
        // Basic YAML parsing (simplified - in production use a proper YAML parser)
        const yamlLines = content.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'))
        const yamlObj: Record<string, unknown> = {}
        
        for (const line of yamlLines) {
          const [key, ...valueParts] = line.split(':')
          if (key && valueParts.length > 0) {
            const value = valueParts.join(':').trim()
            const cleanKey = key.trim()
            
            // Try to parse as JSON value
            try {
              yamlObj[cleanKey] = JSON.parse(value)
            } catch {
              // Keep as string
              yamlObj[cleanKey] = value.replace(/^["']|["']$/g, '')
            }
          }
        }
        return yamlObj
      }
        
      case 'env': {
        const envObj: Record<string, string> = {}
        const envLines = content.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'))
        
        for (const line of envLines) {
          const [key, ...valueParts] = line.split('=')
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim()
            envObj[key.trim()] = value.replace(/^["']|["']$/g, '')
          }
        }
        return envObj
      }
        
      case 'js':
      case 'ts':
        // Return raw content for JS/TS files (can't safely execute)
        return { _raw: content, _note: 'JavaScript/TypeScript files cannot be parsed safely' }
        
      default:
        return { _raw: content }
    }
  } catch (error) {
    throw new Error(`Failed to parse ${type} configuration: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Serialize configuration content
function serializeConfigContent(data: any, type: ConfigFile['type']): string {
  try {
    switch (type) {
      case 'json': {
        return JSON.stringify(data, null, 2)
      }

      case 'yaml':
      case 'yml': {
        // Basic YAML serialization
        let yamlContent = ''
        for (const [key, value] of Object.entries(data)) {
          if (typeof value === 'string') {
            yamlContent += `${key}: "${value}"\n`
          } else {
            yamlContent += `${key}: ${JSON.stringify(value)}\n`
          }
        }
        return yamlContent
      }

      case 'env': {
        let envContent = ''
        for (const [key, value] of Object.entries(data)) {
          envContent += `${key}=${value}\n`
        }
        return envContent
      }

      default:
        return JSON.stringify(data, null, 2)
    }
  } catch (error) {
    throw new Error(`Failed to serialize ${type} configuration: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// List configuration files
async function listConfigurationFiles(projectRoot: string): Promise<ConfigFile[]> {
  const configFiles: ConfigFile[] = []
  
  try {
    const { promises: fs } = await import('fs')
    const path = await import('path')
    
    // Scan for configuration files based on patterns
    for (const pattern of CONFIG_PATTERNS) {
      if (pattern.includes('*')) {
        // Handle wildcard patterns
        const dirPath = path.dirname(path.resolve(projectRoot, pattern))
        const fileName = path.basename(pattern)
        
        try {
          await fs.access(dirPath)
          const entries = await fs.readdir(dirPath)
          const regex = new RegExp(fileName.replace('*', '.*'))
          
          for (const entry of entries) {
            if (regex.test(entry)) {
              const fullPath = path.join(dirPath, entry)
              const stats = await fs.stat(fullPath)
              
              if (stats.isFile()) {
                const type = getConfigType(fullPath)
                configFiles.push({
                  name: entry,
                  path: fullPath,
                  type,
                  size: stats.size,
                  lastModified: stats.mtime.toISOString()
                })
              }
            }
          }
        } catch {
          // Directory doesn't exist, skip
        }
      } else {
        // Handle specific file patterns
        const fullPath = path.resolve(projectRoot, pattern)
        
        try {
          const stats = await fs.stat(fullPath)
          
          if (stats.isFile()) {
            const type = getConfigType(fullPath)
            configFiles.push({
              name: path.basename(fullPath),
              path: fullPath,
              type,
              size: stats.size,
              lastModified: stats.mtime.toISOString()
            })
          }
        } catch {
          // File doesn't exist, skip
        }
      }
    }
    
    // Sort by name
    configFiles.sort((a, b) => a.name.localeCompare(b.name))
    
    return configFiles
  } catch (error) {
    throw new Error(`Failed to list configuration files: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Read configuration file
async function readConfigurationFile(filePath: string): Promise<ConfigFile> {
  try {
    const { promises: fs } = await import('fs')
    // const path = await import('path') // Unused
    
    const stats = await fs.stat(filePath)
    const type = getConfigType(filePath)
    const content = await parseConfigContent(filePath, type)
    
    return {
      name: filePath.substring(filePath.lastIndexOf('/') + 1),
      path: filePath,
      type,
      size: stats.size,
      lastModified: stats.mtime.toISOString(),
      content
    }
  } catch (error) {
    throw new Error(`Failed to read configuration file: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Write configuration file
async function writeConfigurationFile(
  filePath: string,
  content: any,
  type: ConfigFile['type'],
  backup: boolean = true
): Promise<{ success: boolean; size: number; backupPath?: string }> {
  try {
    const { promises: fs } = await import('fs')
    const path = await import('path')
    
    let backupPath: string | undefined
    
    // Create backup if requested and file exists
    if (backup) {
      try {
        await fs.access(filePath)
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        backupPath = `${filePath}.backup.${timestamp}`
        await fs.copyFile(filePath, backupPath)
      } catch {
        // File doesn't exist, no backup needed
      }
    }
    
    // Serialize content
    const serializedContent = serializeConfigContent(content, type)
    
    // Ensure directory exists
    const dir = path.dirname(filePath)
    await fs.mkdir(dir, { recursive: true })
    
    // Write file
    await fs.writeFile(filePath, serializedContent, 'utf8')
    
    const stats = await fs.stat(filePath)
    return { success: true, size: stats.size, backupPath }
  } catch (error) {
    throw new Error(`Failed to write configuration file: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Validate configuration
function validateConfiguration(content: any, schema?: ConfigSchema): ConfigValidationResult {
  const result: ConfigValidationResult = {
    valid: true,
    errors: [],
    warnings: []
  }
  
  if (!schema) {
    return result // No schema to validate against
  }
  
  // Check required properties
  if (schema.required) {
    for (const requiredProp of schema.required) {
      if (!(requiredProp in content)) {
        result.valid = false
        result.errors.push({
          path: requiredProp,
          message: `Required property '${requiredProp}' is missing`,
          severity: 'error'
        })
      }
    }
  }
  
  // Validate property types
  for (const [propName, propSchema] of Object.entries(schema.properties)) {
    if (propName in content) {
      const value = content[propName]
      const expectedType = propSchema.type
      const actualType = Array.isArray(value) ? 'array' : typeof value
      
      if (actualType !== expectedType) {
        result.valid = false
        result.errors.push({
          path: propName,
          message: `Property '${propName}' should be ${expectedType} but got ${actualType}`,
          severity: 'error'
        })
      }
      
      // Check enum values
      if (propSchema.enum && !propSchema.enum.includes(value)) {
        result.valid = false
        result.errors.push({
          path: propName,
          message: `Property '${propName}' value '${value}' is not in allowed values: ${propSchema.enum.join(', ')}`,
          severity: 'error'
        })
      }
    } else if (propSchema.default !== undefined) {
      // Warn about missing optional properties with defaults
      result.warnings.push({
        path: propName,
        message: `Optional property '${propName}' is missing`,
        suggestion: `Consider adding with default value: ${JSON.stringify(propSchema.default)}`
      })
    }
  }
  
  return result
}

// Get configuration templates
function getConfigurationTemplates(): ConfigTemplate[] {
  return [
    {
      name: 'wundr-config',
      description: 'Wundr configuration file',
      type: 'json',
      content: {
        name: 'My Project',
        version: '1.0.0',
        analysis: {
          excludePaths: ['node_modules', 'dist', 'build'],
          includeFileTypes: ['.ts', '.tsx', '.js', '.jsx'],
          complexity: {
            maxComplexity: 15,
            warningThreshold: 10
          }
        },
        quality: {
          maintainabilityThreshold: 70,
          testCoverageThreshold: 80
        },
        dashboard: {
          refreshInterval: 30000,
          enableRealtime: true
        }
      },
      schema: {
        properties: {
          name: { type: 'string', required: true },
          version: { type: 'string', required: true },
          analysis: { type: 'object' },
          quality: { type: 'object' },
          dashboard: { type: 'object' }
        },
        required: ['name', 'version']
      }
    },
    {
      name: 'typescript-config',
      description: 'TypeScript configuration',
      type: 'json',
      content: {
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          moduleResolution: 'node',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          declaration: true,
          outDir: './dist'
        },
        include: ['src/**/*'],
        exclude: ['node_modules', 'dist']
      }
    }
  ]
}

// GET: List or read configuration files
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const clientId = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'anonymous'
  
  try {
    // Rate limiting
    if (!checkRateLimit(clientId)) {
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        error: 'Rate limit exceeded. Please try again later.',
        timestamp: new Date().toISOString()
      }
      return NextResponse.json(response, { status: 429 })
    }
    
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'list'
    const configName = searchParams.get('config') || ''
    const templateName = searchParams.get('template') || ''
    
    const projectRoot = await getProjectRoot()
    
    let data: any
    
    switch (action) {
      case 'read':
        if (!configName) {
          throw new Error('Configuration name is required')
        }
        
        const pathValidation = await validateConfigAccess(configName, projectRoot)
        if (!pathValidation.isValid) {
          throw new Error(pathValidation.error || 'Invalid configuration file')
        }
        
        try {
          const { promises: fs } = await import('fs')
          await fs.access(pathValidation.resolvedPath)
        } catch {
          throw new Error('Configuration file not found')
        }
        
        data = await readConfigurationFile(pathValidation.resolvedPath)
        break
        
      case 'template':
        const templates = getConfigurationTemplates()
        if (templateName) {
          data = templates.find(t => t.name === templateName)
          if (!data) {
            throw new Error('Template not found')
          }
        } else {
          data = templates
        }
        break
        
      case 'list':
      default:
        data = await listConfigurationFiles(projectRoot)
        break
    }
    
    const processingTime = Date.now() - startTime
    
    const response: ApiResponse<typeof data> = {
      success: true,
      data,
      timestamp: new Date().toISOString()
    }
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=180, stale-while-revalidate=300',
        'Content-Type': 'application/json',
        'X-Processing-Time': `${processingTime}ms`
      }
    })
  } catch (error) {
    console.error('Error in config GET:', error)
    
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }
    
    return NextResponse.json(response, { status: 500 })
  }
}

// POST: Write, validate, or backup configuration files
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const clientId = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'anonymous'
  
  try {
    // Rate limiting
    if (!checkRateLimit(clientId)) {
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        error: 'Rate limit exceeded. Please try again later.',
        timestamp: new Date().toISOString()
      }
      return NextResponse.json(response, { status: 429 })
    }
    
    const body: ConfigRequest = await request.json()
    const { action, configName, content, templateName, options = {} } = body
    
    if (!action) {
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        error: 'Missing required parameter: action',
        timestamp: new Date().toISOString()
      }
      return NextResponse.json(response, { status: 400 })
    }
    
    const projectRoot = await getProjectRoot()
    
    let data: any
    
    switch (action) {
      case 'write':
        if (!configName || content === undefined) {
          throw new Error('Configuration name and content are required')
        }
        
        const pathValidation = await validateConfigAccess(configName, projectRoot)
        if (!pathValidation.isValid) {
          throw new Error(pathValidation.error || 'Invalid configuration file')
        }
        
        const type = getConfigType(pathValidation.resolvedPath)
        
        // Validate content if schema provided
        if (options.validate) {
          const templates = getConfigurationTemplates()
          const template = templates.find(t => t.name === templateName)
          
          if (template?.schema) {
            const validation = validateConfiguration(content, template.schema)
            if (!validation.valid) {
              throw new Error(`Configuration validation failed: ${validation.errors.map(e => e.message).join(', ')}`)
            }
          }
        }
        
        data = await writeConfigurationFile(
          pathValidation.resolvedPath,
          content,
          type,
          options.backup !== false
        )
        break
        
      case 'validate':
        if (!configName) {
          throw new Error('Configuration name is required')
        }
        
        const validatePathValidation = await validateConfigAccess(configName, projectRoot)
        if (!validatePathValidation.isValid) {
          throw new Error(validatePathValidation.error || 'Invalid configuration file')
        }
        
        const configFile = await readConfigurationFile(validatePathValidation.resolvedPath)
        const templates = getConfigurationTemplates()
        const template = templates.find(t => t.name === templateName)
        
        data = validateConfiguration(configFile.content, template?.schema)
        break
        
      case 'backup':
        if (!configName) {
          throw new Error('Configuration name is required')
        }
        
        const backupPathValidation = await validateConfigAccess(configName, projectRoot)
        if (!backupPathValidation.isValid) {
          throw new Error(backupPathValidation.error || 'Invalid configuration file')
        }
        
        try {
          const { promises: fs } = await import('fs')
          await fs.access(backupPathValidation.resolvedPath)
          
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
          const backupPath = `${backupPathValidation.resolvedPath}.backup.${timestamp}`
          await fs.copyFile(backupPathValidation.resolvedPath, backupPath)
          
          data = { success: true, backupPath }
        } catch {
          throw new Error('Configuration file not found')
        }
        break
        
      default:
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          error: `Unsupported configuration action: ${action}`,
          timestamp: new Date().toISOString()
        }
        return NextResponse.json(response, { status: 400 })
    }
    
    const processingTime = Date.now() - startTime
    
    const response: ApiResponse<typeof data> = {
      success: true,
      data,
      timestamp: new Date().toISOString()
    }
    
    return NextResponse.json(response, {
      headers: {
        'Content-Type': 'application/json',
        'X-Processing-Time': `${processingTime}ms`
      }
    })
  } catch (error) {
    console.error('Error in config POST:', error)
    
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }
    
    return NextResponse.json(response, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}