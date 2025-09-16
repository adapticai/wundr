import { NextRequest, NextResponse } from 'next/server'
import { ApiResponse } from '@/types/data'

// Force dynamic rendering and Node.js runtime
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Types for code analysis operations
interface ScanOptions {
  paths: string[]
  excludePaths?: string[]
  fileTypes?: string[]
  includeTests?: boolean
  includeNodeModules?: boolean
  depth?: number
  parallel?: boolean
  outputFormat?: 'json' | 'text' | 'summary'
}

interface CodeMetric {
  file: string
  lines: number
  complexity: number
  functions: number
  classes: number
  imports: number
  exports: number
  issues: CodeIssue[]
}

interface CodeIssue {
  type: 'error' | 'warning' | 'info' | 'suggestion'
  severity: 'low' | 'medium' | 'high' | 'critical'
  rule: string
  message: string
  line: number
  column: number
  source?: string
  fixable?: boolean
}

interface DependencyAnalysis {
  internal: string[]
  external: string[]
  circular: Array<{
    path: string[]
    severity: 'low' | 'medium' | 'high'
  }>
  unused: string[]
  outdated: Array<{
    package: string
    current: string
    latest: string
    type: 'major' | 'minor' | 'patch'
  }>
}

interface CodeDuplication {
  type: 'exact' | 'structural' | 'semantic'
  similarity: number
  files: Array<{
    path: string
    startLine: number
    endLine: number
    lines: string[]
  }>
  suggestions?: string[]
}

interface ScanResult {
  id: string
  timestamp: string
  duration: number
  summary: {
    totalFiles: number
    totalLines: number
    totalIssues: number
    issuesByType: Record<string, number>
    issuesBySeverity: Record<string, number>
    complexity: {
      average: number
      max: number
      distribution: Record<string, number>
    }
  }
  metrics: CodeMetric[]
  dependencies: DependencyAnalysis
  duplications: CodeDuplication[]
  security: {
    vulnerabilities: number
    hotspots: number
    issues: CodeIssue[]
  }
}

interface AnalysisRequest {
  action: 'scan' | 'analyze' | 'lint' | 'security' | 'dependencies' | 'duplicates'
  options: ScanOptions
}

// Rate limiting
const requestTracker = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 50 // requests per hour (analysis is expensive)
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

// Validate and sanitize paths
async function validatePaths(inputPaths: string[], projectRoot: string): Promise<{ isValid: boolean; resolvedPaths: string[]; error?: string }> {
  try {
    const path = await import('path')
    const resolvedPaths: string[] = []
    
    for (const inputPath of inputPaths) {
      // Remove leading/trailing slashes and normalize
      const cleanPath = inputPath.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/')
      
      // Resolve absolute path
      const resolvedPath = path.resolve(projectRoot, cleanPath)
      
      // Ensure path is within project root
      if (!resolvedPath.startsWith(projectRoot)) {
        return { 
          isValid: false, 
          resolvedPaths: [],
          error: 'Path traversal detected. Access denied.' 
        }
      }
      
      // Check if path exists
      if (!require('fs').existsSync(resolvedPath)) {
        return {
          isValid: false,
          resolvedPaths: [],
          error: `Path does not exist: ${inputPath}`
        }
      }
      
      resolvedPaths.push(resolvedPath)
    }
    
    return { isValid: true, resolvedPaths }
  } catch (error) {
    return { 
      isValid: false, 
      resolvedPaths: [],
      error: 'Invalid path format.' 
    }
  }
}

// Execute command with timeout and error handling
async function execCommand(command: string, args: string[], cwd: string, timeout: number = 300000): Promise<string> {
  const { spawn } = await import('child_process')
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { 
      cwd, 
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    
    let stdout = ''
    let stderr = ''
    
    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })
    
    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout)
      } else {
        reject(new Error(stderr || `Command failed with code ${code}`))
      }
    })
    
    child.on('error', (error) => {
      reject(new Error(`Failed to execute command: ${error.message}`))
    })
    
    const timeoutId = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error('Command timeout'))
    }, timeout)
    
    child.on('close', () => {
      clearTimeout(timeoutId)
    })
  })
}

// Analyze file for basic metrics
async function analyzeFile(filePath: string): Promise<CodeMetric> {
  try {
    const { promises: fs } = await import('fs')
    const content = await fs.readFile(filePath, 'utf8')
    const lines = content.split('\n')
    
    // Basic metrics calculation
    const linesCount = lines.length
    const complexity = calculateComplexity(content)
    const functions = (content.match(/function\s+\w+|const\s+\w+\s*=\s*\(/g) || []).length
    const classes = (content.match(/class\s+\w+/g) || []).length
    const imports = (content.match(/import\s+.*from|require\s*\(/g) || []).length
    const exports = (content.match(/export\s+|module\.exports/g) || []).length
    
    // Basic issue detection
    const issues: CodeIssue[] = []
    
    // Check for common issues
    if (content.includes('console.log')) {
      issues.push({
        type: 'warning',
        severity: 'low',
        rule: 'no-console',
        message: 'Unexpected console statement',
        line: findLineNumber(content, 'console.log'),
        column: 1,
        fixable: true
      })
    }
    
    if (content.includes('debugger')) {
      issues.push({
        type: 'error',
        severity: 'medium',
        rule: 'no-debugger',
        message: 'Unexpected debugger statement',
        line: findLineNumber(content, 'debugger'),
        column: 1,
        fixable: true
      })
    }
    
    // Check for unused variables (basic pattern)
    const unusedVarMatches = content.match(/const\s+(\w+)\s*=/g)
    if (unusedVarMatches) {
      for (const match of unusedVarMatches) {
        const varName = match.match(/const\s+(\w+)/)?.[1]
        if (varName && !new RegExp(`\\b${varName}\\b`, 'g').test(content.replace(match, ''))) {
          issues.push({
            type: 'warning',
            severity: 'low',
            rule: 'no-unused-vars',
            message: `'${varName}' is defined but never used`,
            line: findLineNumber(content, match),
            column: 1,
            fixable: false
          })
        }
      }
    }
    
    return {
      file: filePath,
      lines: linesCount,
      complexity,
      functions,
      classes,
      imports,
      exports,
      issues
    }
  } catch (error) {
    throw new Error(`Failed to analyze file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Calculate cyclomatic complexity (basic implementation)
function calculateComplexity(content: string): number {
  let complexity = 1 // Base complexity
  
  // Count decision points
  const decisionPoints = [
    /if\s*\(/g,
    /else\s+if\s*\(/g,
    /while\s*\(/g,
    /for\s*\(/g,
    /switch\s*\(/g,
    /case\s+.*:/g,
    /catch\s*\(/g,
    /\?\s*.*\s*:/g, // ternary
    /&&/g,
    /\|\|/g
  ]
  
  for (const pattern of decisionPoints) {
    const matches = content.match(pattern)
    if (matches) {
      complexity += matches.length
    }
  }
  
  return complexity
}

// Find line number of a pattern in content
function findLineNumber(content: string, pattern: string): number {
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(pattern)) {
      return i + 1
    }
  }
  return 1
}

// Scan directory recursively for files
async function scanDirectory(
  dirPath: string,
  options: ScanOptions,
  visited: Set<string> = new Set()
): Promise<string[]> {
  const files: string[] = []
  
  // Prevent infinite loops
  if (visited.has(dirPath)) {
    return files
  }
  visited.add(dirPath)
  
  try {
    const { promises: fs } = await import('fs')
    const path = await import('path')
    
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      
      // Skip excluded paths
      if (options.excludePaths?.some(exclude => fullPath.includes(exclude))) {
        continue
      }
      
      // Skip node_modules unless explicitly included
      if (!options.includeNodeModules && entry.name === 'node_modules') {
        continue
      }
      
      // Skip test files unless explicitly included
      if (!options.includeTests && (
        entry.name.includes('.test.') ||
        entry.name.includes('.spec.') ||
        entry.name === '__tests__'
      )) {
        continue
      }
      
      if (entry.isDirectory()) {
        // Recursive directory scanning with depth limit
        const currentDepth = fullPath.split(path.sep).length - dirPath.split(path.sep).length
        if (currentDepth < (options.depth || 10)) {
          const subFiles = await scanDirectory(fullPath, options, visited)
          files.push(...subFiles)
        }
      } else {
        // Check file type
        const ext = path.extname(entry.name).toLowerCase()
        if (!options.fileTypes || options.fileTypes.includes(ext)) {
          files.push(fullPath)
        }
      }
    }
  } catch (error) {
    console.warn(`Failed to scan directory ${dirPath}:`, error)
  }
  
  return files
}

// Analyze dependencies
async function analyzeDependencies(projectRoot: string): Promise<DependencyAnalysis> {
  try {
    const { promises: fs } = await import('fs')
    const path = await import('path')
    
    const packageJsonPath = path.join(projectRoot, 'package.json')
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'))
    
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies
    }
    
    const internal: string[] = []
    const external: string[] = Object.keys(dependencies || {})
    const circular: DependencyAnalysis['circular'] = []
    const unused: string[] = []
    const outdated: DependencyAnalysis['outdated'] = []
    
    // Basic dependency analysis would require more complex implementation
    // For now, return basic structure
    
    return {
      internal,
      external,
      circular,
      unused,
      outdated
    }
  } catch (error) {
    console.warn('Failed to analyze dependencies:', error)
    return {
      internal: [],
      external: [],
      circular: [],
      unused: [],
      outdated: []
    }
  }
}

// Detect code duplications
async function detectDuplications(files: string[]): Promise<CodeDuplication[]> {
  const duplications: CodeDuplication[] = []
  
  // Simple duplication detection based on similar line patterns
  const fileContents = new Map<string, string[]>()
  
  for (const file of files.slice(0, 50)) { // Limit for performance
    try {
      const { promises: fs } = await import('fs')
      const content = await fs.readFile(file, 'utf8')
      fileContents.set(file, content.split('\n'))
    } catch (error) {
      continue
    }
  }
  
  // Compare files for duplications (basic implementation)
  const fileList = Array.from(fileContents.keys())
  
  for (let i = 0; i < fileList.length - 1; i++) {
    for (let j = i + 1; j < fileList.length; j++) {
      const file1 = fileList[i]
      const file2 = fileList[j]
      const lines1 = fileContents.get(file1) || []
      const lines2 = fileContents.get(file2) || []
      
      const similarity = calculateSimilarity(lines1, lines2)
      
      if (similarity > 0.7) {
        duplications.push({
          type: similarity > 0.95 ? 'exact' : 'structural',
          similarity,
          files: [
            {
              path: file1,
              startLine: 1,
              endLine: lines1.length,
              lines: lines1.slice(0, 10) // First 10 lines
            },
            {
              path: file2,
              startLine: 1,
              endLine: lines2.length,
              lines: lines2.slice(0, 10)
            }
          ],
          suggestions: ['Consider extracting common functionality into a shared module']
        })
      }
    }
  }
  
  return duplications
}

// Calculate similarity between two sets of lines
function calculateSimilarity(lines1: string[], lines2: string[]): number {
  if (lines1.length === 0 && lines2.length === 0) return 1
  if (lines1.length === 0 || lines2.length === 0) return 0
  
  const set1 = new Set(lines1.map(line => line.trim()).filter(Boolean))
  const set2 = new Set(lines2.map(line => line.trim()).filter(Boolean))
  
  const intersection = new Set([...set1].filter(line => set2.has(line)))
  const union = new Set([...set1, ...set2])
  
  return intersection.size / union.size
}

// Main scan function
async function performScan(options: ScanOptions, projectRoot: string): Promise<ScanResult> {
  const startTime = Date.now()
  const scanId = `scan-${startTime}`
  
  try {
    // Validate paths
    const pathValidation = await validatePaths(options.paths, projectRoot)
    if (!pathValidation.isValid) {
      throw new Error(pathValidation.error || 'Invalid paths')
    }
    
    // Collect all files to scan
    const { promises: fs } = await import('fs')
    
    let allFiles: string[] = []
    for (const scanPath of pathValidation.resolvedPaths) {
      const stats = await fs.stat(scanPath)
      if (stats.isDirectory()) {
        const files = await scanDirectory(scanPath, options)
        allFiles.push(...files)
      } else {
        allFiles.push(scanPath)
      }
    }
    
    // Remove duplicates
    allFiles = Array.from(new Set(allFiles))
    
    // Analyze files
    const metrics: CodeMetric[] = []
    const batchSize = options.parallel ? 10 : 1
    
    for (let i = 0; i < allFiles.length; i += batchSize) {
      const batch = allFiles.slice(i, i + batchSize)
      
      if (options.parallel) {
        const batchPromises = batch.map(file => analyzeFile(file))
        const batchResults = await Promise.allSettled(batchPromises)
        
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            metrics.push(result.value)
          }
        }
      } else {
        for (const file of batch) {
          try {
            const metric = await analyzeFile(file)
            metrics.push(metric)
          } catch (error) {
            console.warn(`Failed to analyze ${file}:`, error)
          }
        }
      }
    }
    
    // Calculate summary
    const totalIssues = metrics.reduce((sum, metric) => sum + metric.issues.length, 0)
    const issuesByType: Record<string, number> = {}
    const issuesBySeverity: Record<string, number> = {}
    const complexities = metrics.map(m => m.complexity)
    
    for (const metric of metrics) {
      for (const issue of metric.issues) {
        issuesByType[issue.type] = (issuesByType[issue.type] || 0) + 1
        issuesBySeverity[issue.severity] = (issuesBySeverity[issue.severity] || 0) + 1
      }
    }
    
    // Analyze dependencies and duplications
    const dependencies = await analyzeDependencies(projectRoot)
    const duplications = await detectDuplications(allFiles.slice(0, 20)) // Limit for performance
    
    // Security analysis (basic)
    const securityIssues = metrics.flatMap(m => 
      m.issues.filter(issue => 
        issue.rule.includes('security') || 
        issue.severity === 'critical'
      )
    )
    
    const duration = Date.now() - startTime
    
    const result: ScanResult = {
      id: scanId,
      timestamp: new Date().toISOString(),
      duration,
      summary: {
        totalFiles: allFiles.length,
        totalLines: metrics.reduce((sum, metric) => sum + metric.lines, 0),
        totalIssues,
        issuesByType,
        issuesBySeverity,
        complexity: {
          average: complexities.length > 0 ? complexities.reduce((a, b) => a + b, 0) / complexities.length : 0,
          max: complexities.length > 0 ? Math.max(...complexities) : 0,
          distribution: {
            'low (1-5)': complexities.filter(c => c <= 5).length,
            'medium (6-15)': complexities.filter(c => c > 5 && c <= 15).length,
            'high (16+)': complexities.filter(c => c > 15).length
          }
        }
      },
      metrics,
      dependencies,
      duplications,
      security: {
        vulnerabilities: securityIssues.filter(i => i.severity === 'critical').length,
        hotspots: securityIssues.filter(i => i.severity === 'high').length,
        issues: securityIssues
      }
    }
    
    return result
  } catch (error) {
    throw new Error(`Scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// POST: Perform code analysis scan
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const clientId = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'anonymous'
  
  try {
    // Rate limiting
    if (!checkRateLimit(clientId)) {
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        error: 'Rate limit exceeded. Analysis operations are resource-intensive. Please try again later.',
        timestamp: new Date().toISOString()
      }
      return NextResponse.json(response, { status: 429 })
    }
    
    const body: AnalysisRequest = await request.json()
    const { action, options } = body
    
    if (!action || !options || !options.paths || options.paths.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        error: 'Missing required parameters: action and options.paths',
        timestamp: new Date().toISOString()
      }
      return NextResponse.json(response, { status: 400 })
    }
    
    // Set defaults
    const scanOptions: ScanOptions = {
      paths: options.paths,
      excludePaths: options.excludePaths || ['node_modules', '.git', 'dist', 'build'],
      fileTypes: options.fileTypes || ['.ts', '.tsx', '.js', '.jsx'],
      includeTests: options.includeTests || false,
      includeNodeModules: options.includeNodeModules || false,
      depth: Math.min(options.depth || 10, 15), // Limit depth for performance
      parallel: options.parallel !== false,
      outputFormat: options.outputFormat || 'json'
    }
    
    const projectRoot = await getProjectRoot()
    
    let data: any
    
    switch (action) {
      case 'scan':
      case 'analyze':
        data = await performScan(scanOptions, projectRoot)
        break
        
      case 'dependencies':
        data = await analyzeDependencies(projectRoot)
        break
        
      case 'duplicates':
        // Collect files first
        const pathValidation = await validatePaths(scanOptions.paths, projectRoot)
        if (!pathValidation.isValid) {
          throw new Error(pathValidation.error || 'Invalid paths')
        }
        
        const { promises: fs } = await import('fs')
        
        const allFiles: string[] = []
        for (const scanPath of pathValidation.resolvedPaths) {
          const stats = await fs.stat(scanPath)
          if (stats.isDirectory()) {
            const files = await scanDirectory(scanPath, scanOptions)
            allFiles.push(...files)
          } else {
            allFiles.push(scanPath)
          }
        }
        
        data = await detectDuplications(allFiles)
        break
        
      default:
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          error: `Unsupported analysis action: ${action}`,
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
        'X-Processing-Time': `${processingTime}ms`,
        'X-Cache-Control': 'private, no-cache' // Analysis results shouldn't be cached
      }
    })
  } catch (error) {
    console.error('Error in analysis scan POST:', error)
    
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}