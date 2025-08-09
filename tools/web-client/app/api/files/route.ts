import { NextRequest, NextResponse } from 'next/server'
import { ApiResponse } from '@/types/data'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Types for file operations
interface FileInfo {
  name: string
  path: string
  type: 'file' | 'directory'
  size: number
  lastModified: string
  extension?: string
  permissions?: string
}

interface FileContent {
  path: string
  content: string
  encoding: string
  size: number
  lastModified: string
}

interface FileListResponse {
  files: FileInfo[]
  totalFiles: number
  totalDirectories: number
  currentPath: string
}

interface FileOperationRequest {
  action: 'read' | 'write' | 'list' | 'delete' | 'create' | 'move' | 'copy'
  path: string
  content?: string
  encoding?: 'utf8' | 'base64'
  recursive?: boolean
  filter?: {
    extensions?: string[]
    pattern?: string
    includeHidden?: boolean
  }
  newPath?: string // for move/copy operations
}

// Security: List of allowed file extensions for operations
const ALLOWED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt', '.yml', '.yaml',
  '.css', '.scss', '.sass', '.less', '.html', '.xml', '.svg', '.png', 
  '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.csv'
])

// Security: List of forbidden paths
const FORBIDDEN_PATHS = new Set([
  'node_modules',
  '.git',
  '.env',
  '.env.local',
  '.env.production',
  '.npmrc',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml'
])

// Rate limiting
const requestTracker = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 200 // requests per hour
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
  const path = await import('path')
  const { promises: fs } = await import('fs')
  
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

// Security: Validate and sanitize file path
async function validatePath(inputPath: string, projectRoot: string): Promise<{ isValid: boolean; resolvedPath: string; error?: string }> {
  try {
    const path = await import('path')
    
    // Remove leading/trailing slashes and normalize
    const cleanPath = inputPath.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/')
    
    // Resolve absolute path
    const resolvedPath = path.resolve(projectRoot, cleanPath)
    
    // Ensure path is within project root
    if (!resolvedPath.startsWith(projectRoot)) {
      return { 
        isValid: false, 
        resolvedPath: '',
        error: 'Path traversal detected. Access denied.' 
      }
    }
    
    // Check for forbidden paths
    const relativePath = path.relative(projectRoot, resolvedPath)
    const pathSegments = relativePath.split(path.sep)
    
    for (const segment of pathSegments) {
      if (FORBIDDEN_PATHS.has(segment) || segment.startsWith('.')) {
        return { 
          isValid: false, 
          resolvedPath: '',
          error: 'Access to this path is forbidden.' 
        }
      }
    }
    
    return { isValid: true, resolvedPath }
  } catch (error) {
    return { 
      isValid: false, 
      resolvedPath: '',
      error: 'Invalid path format.' 
    }
  }
}

// Security: Check if file extension is allowed
function isAllowedExtension(filePath: string): boolean {
  const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase()
  return ALLOWED_EXTENSIONS.has(ext)
}

// Get file/directory information
async function getFileInfo(fullPath: string): Promise<FileInfo> {
  try {
    const { promises: fs } = await import('fs')
    const path = await import('path')
    
    const stats = await fs.stat(fullPath)
    const name = path.basename(fullPath)
    const extension = path.extname(fullPath)
    
    return {
      name,
      path: fullPath,
      type: stats.isDirectory() ? 'directory' : 'file',
      size: stats.size,
      lastModified: stats.mtime.toISOString(),
      extension: extension || undefined,
      permissions: `${stats.mode.toString(8).slice(-3)}`
    }
  } catch (error) {
    throw new Error(`Failed to get file info: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// List files and directories
async function listFiles(
  dirPath: string, 
  recursive: boolean = false,
  filter?: FileOperationRequest['filter']
): Promise<FileListResponse> {
  try {
    const { promises: fs } = await import('fs')
    const path = await import('path')
    
    const files: FileInfo[] = []
    let totalFiles = 0
    let totalDirectories = 0
    
    async function scanDirectory(currentPath: string, depth: number = 0): Promise<void> {
      const entries = await fs.readdir(currentPath)
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry)
        const stats = await fs.stat(fullPath)
        
        // Skip hidden files unless explicitly included
        if (!filter?.includeHidden && entry.startsWith('.')) {
          continue
        }
        
        // Apply pattern filter
        if (filter?.pattern) {
          const pattern = new RegExp(filter.pattern, 'i')
          if (!pattern.test(entry)) {
            continue
          }
        }
        
        if (stats.isDirectory()) {
          totalDirectories++
          
          const fileInfo = await getFileInfo(fullPath)
          files.push(fileInfo)
          
          // Recursive scanning with depth limit
          if (recursive && depth < 5) {
            await scanDirectory(fullPath, depth + 1)
          }
        } else {
          const extension = path.extname(entry).toLowerCase()
          
          // Apply extension filter
          if (filter?.extensions && filter.extensions.length > 0) {
            if (!filter.extensions.includes(extension)) {
              continue
            }
          }
          
          // Check allowed extensions for security
          if (!isAllowedExtension(entry)) {
            continue
          }
          
          totalFiles++
          const fileInfo = await getFileInfo(fullPath)
          files.push(fileInfo)
        }
      }
    }
    
    await scanDirectory(dirPath)
    
    // Sort files: directories first, then files, alphabetically
    files.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
    
    return {
      files,
      totalFiles,
      totalDirectories,
      currentPath: dirPath
    }
  } catch (error) {
    throw new Error(`Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Read file content
async function readFileContent(filePath: string, encoding: 'utf8' | 'base64' = 'utf8'): Promise<FileContent> {
  try {
    const { promises: fs } = await import('fs')
    
    if (!isAllowedExtension(filePath)) {
      throw new Error('File type not allowed for reading')
    }
    
    const stats = await fs.stat(filePath)
    const content = await fs.readFile(filePath, encoding)
    
    return {
      path: filePath,
      content: content.toString(),
      encoding,
      size: stats.size,
      lastModified: stats.mtime.toISOString()
    }
  } catch (error) {
    throw new Error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Write file content
async function writeFileContent(
  filePath: string, 
  content: string, 
  encoding: 'utf8' | 'base64' = 'utf8'
): Promise<{ success: boolean; size: number }> {
  try {
    const { promises: fs } = await import('fs')
    const path = await import('path')
    
    if (!isAllowedExtension(filePath)) {
      throw new Error('File type not allowed for writing')
    }
    
    // Ensure directory exists
    const dir = path.dirname(filePath)
    await fs.mkdir(dir, { recursive: true })
    
    // Write file
    await fs.writeFile(filePath, content, encoding)
    
    const stats = await fs.stat(filePath)
    return { success: true, size: stats.size }
  } catch (error) {
    throw new Error(`Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Delete file or directory
async function deleteFileOrDirectory(filePath: string, recursive: boolean = false): Promise<{ success: boolean }> {
  try {
    const { promises: fs } = await import('fs')
    
    const stats = await fs.stat(filePath)
    
    if (stats.isDirectory()) {
      if (recursive) {
        await fs.rmdir(filePath, { recursive: true })
      } else {
        await fs.rmdir(filePath)
      }
    } else {
      await fs.unlink(filePath)
    }
    
    return { success: true }
  } catch (error) {
    throw new Error(`Failed to delete: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// GET: List files or read file content
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
    const filePath = searchParams.get('path') || ''
    const action = searchParams.get('action') || 'list'
    const recursive = searchParams.get('recursive') === 'true'
    const encoding = (searchParams.get('encoding') as 'utf8' | 'base64') || 'utf8'
    const extensions = searchParams.get('extensions')?.split(',') || []
    const pattern = searchParams.get('pattern') || undefined
    const includeHidden = searchParams.get('includeHidden') === 'true'
    
    const projectRoot = await getProjectRoot()
    const pathValidation = await validatePath(filePath, projectRoot)
    
    if (!pathValidation.isValid) {
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        error: pathValidation.error || 'Invalid path',
        timestamp: new Date().toISOString()
      }
      return NextResponse.json(response, { status: 400 })
    }
    
    let data: any
    
    if (action === 'read') {
      // Read file content
      data = await readFileContent(pathValidation.resolvedPath, encoding)
    } else {
      // List directory contents
      const targetPath = pathValidation.resolvedPath || projectRoot
      data = await listFiles(targetPath, recursive, {
        extensions: extensions.length > 0 ? extensions : undefined,
        pattern,
        includeHidden
      })
    }
    
    const processingTime = Date.now() - startTime
    
    const response: ApiResponse<typeof data> = {
      success: true,
      data,
      timestamp: new Date().toISOString()
    }
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
        'Content-Type': 'application/json',
        'X-Processing-Time': `${processingTime}ms`
      }
    })
  } catch (error) {
    console.error('Error in files GET:', error)
    
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }
    
    return NextResponse.json(response, { status: 500 })
  }
}

// POST: Create, write, move, copy, or delete files
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
    
    const body: FileOperationRequest = await request.json()
    const { action, path: filePath, content, encoding = 'utf8', recursive = false, newPath } = body
    
    if (!action || !filePath) {
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        error: 'Missing required parameters: action and path',
        timestamp: new Date().toISOString()
      }
      return NextResponse.json(response, { status: 400 })
    }
    
    const projectRoot = await getProjectRoot()
    const pathValidation = await validatePath(filePath, projectRoot)
    
    if (!pathValidation.isValid) {
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        error: pathValidation.error || 'Invalid path',
        timestamp: new Date().toISOString()
      }
      return NextResponse.json(response, { status: 400 })
    }
    
    let data: any
    
    switch (action) {
      case 'write':
      case 'create':
        if (!content) {
          throw new Error('Content is required for write/create operations')
        }
        data = await writeFileContent(pathValidation.resolvedPath, content, encoding)
        break
        
      case 'delete':
        data = await deleteFileOrDirectory(pathValidation.resolvedPath, recursive)
        break
        
      case 'move':
      case 'copy':
        if (!newPath) {
          throw new Error('newPath is required for move/copy operations')
        }
        
        const newPathValidation = await validatePath(newPath, projectRoot)
        if (!newPathValidation.isValid) {
          throw new Error(newPathValidation.error || 'Invalid destination path')
        }
        
        const { promises: fs } = await import('fs')
        
        if (action === 'copy') {
          await fs.copyFile(pathValidation.resolvedPath, newPathValidation.resolvedPath)
        } else {
          await fs.rename(pathValidation.resolvedPath, newPathValidation.resolvedPath)
        }
        
        data = { success: true, from: pathValidation.resolvedPath, to: newPathValidation.resolvedPath }
        break
        
      default:
        throw new Error(`Unsupported action: ${action}`)
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
    console.error('Error in files POST:', error)
    
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