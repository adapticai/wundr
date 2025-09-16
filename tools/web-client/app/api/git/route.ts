import { NextRequest, NextResponse } from 'next/server'
import { ApiResponse } from '@/types/data'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Types for git operations
interface GitStatus {
  branch: string
  ahead: number
  behind: number
  staged: string[]
  modified: string[]
  untracked: string[]
  deleted: string[]
  renamed: string[]
  conflicted: string[]
  clean: boolean
}

interface GitCommit {
  hash: string
  shortHash: string
  author: string
  email: string
  date: string
  message: string
  subject: string
  body?: string
  additions: number
  deletions: number
  files: string[]
  refs?: string[]
}

interface GitBranch {
  name: string
  current: boolean
  remote?: string
  lastCommit?: string
  lastCommitDate?: string
  ahead?: number
  behind?: number
}

interface GitRemote {
  name: string
  url: string
  type: 'fetch' | 'push'
}

interface GitTag {
  name: string
  hash: string
  date: string
  message?: string
  author?: string
}

interface GitStash {
  index: number
  branch: string
  message: string
  date: string
}

interface GitOperationRequest {
  action: 'status' | 'log' | 'branches' | 'remotes' | 'tags' | 'stash' | 'diff' | 'blame' | 'show'
  repository?: string
  options?: {
    limit?: number
    since?: string
    until?: string
    author?: string
    grep?: string
    file?: string
    branch?: string
    format?: string
    stat?: boolean
    oneline?: boolean
  }
}

// Rate limiting
const requestTracker = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 150 // requests per hour
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

// Execute git command safely
function execGitCommand(args: string[], cwd: string, timeout: number = 30000): Promise<string> {
  return new Promise((resolve, reject) => {
    // Sanitize arguments to prevent command injection
    const sanitizedArgs = args.map(arg => {
      if (typeof arg !== 'string') {
        throw new Error('Invalid argument type')
      }
      // Remove dangerous characters
      return arg.replace(/[;&|`$(){}[\]<>]/g, '')
    })
    
    const { spawn } = require('child_process')
    const child = spawn('git', sanitizedArgs, { 
      cwd, 
      shell: false, // Disable shell for security
      stdio: ['pipe', 'pipe', 'pipe']
    })
    
    let stdout = ''
    let stderr = ''
    
    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
    })
    
    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })
    
    child.on('close', (code: number | null) => {
      if (code === 0) {
        resolve(stdout)
      } else {
        reject(new Error(stderr || `Git command failed with code ${code}`))
      }
    })
    
    child.on('error', (error: Error) => {
      reject(new Error(`Failed to execute git command: ${error.message}`))
    })
    
    // Timeout handling
    const timeoutId = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error('Git command timeout'))
    }, timeout)
    
    child.on('close', () => {
      clearTimeout(timeoutId)
    })
  })
}

// Get project root directory
async function getProjectRoot(): Promise<string> {
  const path = await import('path')
  const { promises: fs } = await import('fs')
  
  let dir = process.cwd()
  while (dir !== path.dirname(dir)) {
    try {
      const gitPath = path.join(dir, '.git')
      try {
        await fs.access(gitPath)
        return dir
      } catch {
        // Continue searching
      }
    } catch (e) {
      // Continue searching
    }
    dir = path.dirname(dir)
  }
  return process.cwd()
}

// Validate repository path
async function validateRepositoryPath(repoPath?: string): Promise<{ isValid: boolean; resolvedPath: string; error?: string }> {
  try {
    const path = await import('path')
    const projectRoot = await getProjectRoot()
    let resolvedPath = projectRoot
    
    if (repoPath) {
      // Prevent path traversal
      if (repoPath.includes('..') || repoPath.includes('~') || path.isAbsolute(repoPath)) {
        return {
          isValid: false,
          resolvedPath: '',
          error: 'Invalid repository path. Relative paths only.'
        }
      }
      
      resolvedPath = path.resolve(projectRoot, repoPath)
      
      // Ensure path is within project root
      if (!resolvedPath.startsWith(projectRoot)) {
        return {
          isValid: false,
          resolvedPath: '',
          error: 'Repository path outside project root.'
        }
      }
    }
    
    return { isValid: true, resolvedPath }
  } catch (error) {
    return {
      isValid: false,
      resolvedPath: '',
      error: 'Failed to resolve repository path.'
    }
  }
}

// Parse git status output
function parseGitStatus(output: string): GitStatus {
  const lines = output.split('\n').filter(Boolean)
  const status: GitStatus = {
    branch: 'unknown',
    ahead: 0,
    behind: 0,
    staged: [],
    modified: [],
    untracked: [],
    deleted: [],
    renamed: [],
    conflicted: [],
    clean: false
  }
  
  for (const line of lines) {
    if (line.startsWith('## ')) {
      // Branch information
      const branchMatch = line.match(/## ([^.]+)/)
      if (branchMatch) {
        status.branch = branchMatch[1]
      }
      
      const aheadMatch = line.match(/ahead (\d+)/)
      const behindMatch = line.match(/behind (\d+)/)
      if (aheadMatch) status.ahead = parseInt(aheadMatch[1], 10)
      if (behindMatch) status.behind = parseInt(behindMatch[1], 10)
    } else if (line.length >= 3) {
      const statusCode = line.substring(0, 2)
      const filePath = line.substring(3)
      
      switch (statusCode) {
        case 'A ':
        case 'M ':
        case 'D ':
        case 'R ':
        case 'C ':
          status.staged.push(filePath)
          break
        case ' M':
        case 'AM':
        case 'MM':
          status.modified.push(filePath)
          break
        case ' D':
          status.deleted.push(filePath)
          break
        case '??':
          status.untracked.push(filePath)
          break
        case 'UU':
        case 'AA':
        case 'DD':
          status.conflicted.push(filePath)
          break
        case 'R ':
          status.renamed.push(filePath)
          break
      }
    }
  }
  
  status.clean = status.staged.length === 0 && 
                status.modified.length === 0 && 
                status.untracked.length === 0 && 
                status.deleted.length === 0 && 
                status.conflicted.length === 0
  
  return status
}

// Parse git log output
function parseGitLog(output: string, withStats: boolean = false): GitCommit[] {
  const commits: GitCommit[] = []
  const commitBlocks = output.split('---COMMIT-SEPARATOR---').filter(Boolean)
  
  for (const block of commitBlocks) {
    const lines = block.trim().split('\n')
    if (lines.length < 4) continue
    
    const [hash, author, date, subject, ...rest] = lines
    
    const commit: GitCommit = {
      hash: hash.trim(),
      shortHash: hash.trim().substring(0, 8),
      author: author.trim(),
      email: '',
      date: date.trim(),
      message: subject.trim(),
      subject: subject.trim(),
      additions: 0,
      deletions: 0,
      files: []
    }
    
    // Parse email from author if present
    const emailMatch = author.match(/<(.+)>/)
    if (emailMatch) {
      commit.email = emailMatch[1]
      commit.author = author.replace(/<.+>/, '').trim()
    }
    
    // Parse additional message body and stats
    const bodyLines: string[] = []
    let inStats = false
    
    for (const line of rest) {
      if (withStats && line.match(/^\s*\d+\s+\d+\s+/)) {
        inStats = true
        const statMatch = line.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/)
        if (statMatch) {
          commit.additions += parseInt(statMatch[1], 10)
          commit.deletions += parseInt(statMatch[2], 10)
          commit.files.push(statMatch[3])
        }
      } else if (!inStats && line.trim()) {
        bodyLines.push(line)
      }
    }
    
    if (bodyLines.length > 0) {
      commit.body = bodyLines.join('\n').trim()
    }
    
    commits.push(commit)
  }
  
  return commits
}

// Parse git branch output
function parseGitBranches(output: string): GitBranch[] {
  const branches: GitBranch[] = []
  const lines = output.split('\n').filter(Boolean)
  
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    
    const current = trimmed.startsWith('*')
    const branchName = trimmed.replace(/^\*\s*/, '').trim()
    
    // Skip remote tracking info for now
    if (branchName.includes('->')) continue
    
    const branch: GitBranch = {
      name: branchName,
      current
    }
    
    // Parse remote info
    if (branchName.includes('/')) {
      const parts = branchName.split('/')
      if (parts.length >= 2 && parts[0] !== 'remotes') {
        branch.remote = parts[0]
        branch.name = parts.slice(1).join('/')
      }
    }
    
    branches.push(branch)
  }
  
  return branches
}

// Get git status
async function getGitStatus(repoPath: string): Promise<GitStatus> {
  try {
    const output = await execGitCommand(['status', '--porcelain', '-b'], repoPath)
    return parseGitStatus(output)
  } catch (error) {
    throw new Error(`Failed to get git status: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Get git log
async function getGitLog(repoPath: string, options: GitOperationRequest['options'] = {}): Promise<GitCommit[]> {
  try {
    const args = [
      'log',
      '--pretty=format:%H%n%an <%ae>%n%ai%n%s%n%b---COMMIT-SEPARATOR---'
    ]
    
    if (options.limit) {
      args.push(`-n`, options.limit.toString())
    }
    
    if (options.since) {
      args.push(`--since=${options.since}`)
    }
    
    if (options.until) {
      args.push(`--until=${options.until}`)
    }
    
    if (options.author) {
      args.push(`--author=${options.author}`)
    }
    
    if (options.grep) {
      args.push(`--grep=${options.grep}`)
    }
    
    if (options.file) {
      args.push('--', options.file)
    }
    
    if (options.stat) {
      args.push('--numstat')
    }
    
    const output = await execGitCommand(args, repoPath)
    return parseGitLog(output, options.stat)
  } catch (error) {
    throw new Error(`Failed to get git log: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Get git branches
async function getGitBranches(repoPath: string, includeRemotes: boolean = false): Promise<GitBranch[]> {
  try {
    const args = ['branch']
    if (includeRemotes) {
      args.push('-a')
    }
    
    const output = await execGitCommand(args, repoPath)
    return parseGitBranches(output)
  } catch (error) {
    throw new Error(`Failed to get git branches: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Get git remotes
async function getGitRemotes(repoPath: string): Promise<GitRemote[]> {
  try {
    const output = await execGitCommand(['remote', '-v'], repoPath)
    const remotes: GitRemote[] = []
    const lines = output.split('\n').filter(Boolean)
    
    for (const line of lines) {
      const match = line.match(/^(\S+)\s+(\S+)\s+\((\S+)\)$/)
      if (match) {
        remotes.push({
          name: match[1],
          url: match[2],
          type: match[3] as 'fetch' | 'push'
        })
      }
    }
    
    return remotes
  } catch (error) {
    throw new Error(`Failed to get git remotes: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Get git tags
async function getGitTags(repoPath: string, limit: number = 50): Promise<GitTag[]> {
  try {
    const output = await execGitCommand([
      'tag',
      '-l',
      '--sort=-version:refname',
      `--format=%(refname:short)|%(objectname)|%(creatordate:iso8601)|%(subject)|%(authorname)`,
      `-n`, limit.toString()
    ], repoPath)
    
    const tags: GitTag[] = []
    const lines = output.split('\n').filter(Boolean)
    
    for (const line of lines) {
      const parts = line.split('|')
      if (parts.length >= 3) {
        tags.push({
          name: parts[0],
          hash: parts[1],
          date: parts[2],
          message: parts[3] || undefined,
          author: parts[4] || undefined
        })
      }
    }
    
    return tags
  } catch (error) {
    throw new Error(`Failed to get git tags: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// GET: Retrieve git information
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
    const action = searchParams.get('action') || 'status'
    const repository = searchParams.get('repository') || undefined
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const since = searchParams.get('since') || undefined
    const until = searchParams.get('until') || undefined
    const author = searchParams.get('author') || undefined
    const grep = searchParams.get('grep') || undefined
    const file = searchParams.get('file') || undefined
    const stat = searchParams.get('stat') === 'true'
    const includeRemotes = searchParams.get('includeRemotes') === 'true'
    
    const pathValidation = await validateRepositoryPath(repository)
    if (!pathValidation.isValid) {
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        error: pathValidation.error || 'Invalid repository path',
        timestamp: new Date().toISOString()
      }
      return NextResponse.json(response, { status: 400 })
    }
    
    // Verify it's a git repository
    try {
      await execGitCommand(['rev-parse', '--git-dir'], pathValidation.resolvedPath)
    } catch (error) {
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        error: 'Not a git repository or git not available',
        timestamp: new Date().toISOString()
      }
      return NextResponse.json(response, { status: 422 })
    }
    
    let data: any
    
    switch (action) {
      case 'status':
        data = await getGitStatus(pathValidation.resolvedPath)
        break
        
      case 'log':
        data = await getGitLog(pathValidation.resolvedPath, {
          limit,
          since,
          until,
          author,
          grep,
          file,
          stat
        })
        break
        
      case 'branches':
        data = await getGitBranches(pathValidation.resolvedPath, includeRemotes)
        break
        
      case 'remotes':
        data = await getGitRemotes(pathValidation.resolvedPath)
        break
        
      case 'tags':
        data = await getGitTags(pathValidation.resolvedPath, limit)
        break
        
      default:
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          error: `Unsupported git action: ${action}`,
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
        'Cache-Control': action === 'status' ? 'no-cache' : 'public, max-age=300, stale-while-revalidate=600',
        'Content-Type': 'application/json',
        'X-Processing-Time': `${processingTime}ms`
      }
    })
  } catch (error) {
    console.error('Error in git GET:', error)
    
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}