import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { ApiResponse } from '@/types/data'

// Types for documentation operations
interface DocumentationFile {
  path: string
  name: string
  type: 'markdown' | 'text' | 'json' | 'yaml'
  size: number
  lastModified: string
  content?: string
  metadata?: {
    title?: string
    description?: string
    tags?: string[]
    author?: string
    version?: string
    toc?: TableOfContentsItem[]
  }
}

interface TableOfContentsItem {
  level: number
  title: string
  anchor: string
  children?: TableOfContentsItem[]
}

interface DocumentationStructure {
  directories: Array<{
    name: string
    path: string
    files: DocumentationFile[]
    subdirectories?: DocumentationStructure['directories']
  }>
  totalFiles: number
  lastUpdated: string
}

interface DocumentationSearchResult {
  file: string
  title: string
  matches: Array<{
    line: number
    content: string
    context: string
  }>
  score: number
}

interface DocumentationRequest {
  action: 'list' | 'read' | 'write' | 'search' | 'generate' | 'validate'
  path?: string
  content?: string
  searchTerm?: string
  options?: {
    includeContent?: boolean
    recursive?: boolean
    fileTypes?: string[]
    generateToc?: boolean
    format?: 'markdown' | 'html' | 'json'
    template?: string
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
function getProjectRoot(): string {
  let dir = process.cwd()
  while (dir !== path.dirname(dir)) {
    try {
      const packagePath = path.join(dir, 'package.json')
      if (require('fs').existsSync(packagePath)) {
        return dir
      }
    } catch (e) {
      // Continue searching
    }
    dir = path.dirname(dir)
  }
  return process.cwd()
}

// Validate and sanitize documentation path
function validateDocPath(inputPath: string, projectRoot: string): { isValid: boolean; resolvedPath: string; error?: string } {
  try {
    // Default to docs directory if no path provided
    const cleanPath = inputPath ? 
      inputPath.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/') : 
      'docs'
    
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
    
    // Allow common documentation directories
    const allowedPaths = ['docs', 'documentation', 'README.md', 'CHANGELOG.md', 'CONTRIBUTING.md']
    const relativePath = path.relative(projectRoot, resolvedPath)
    
    // Check if path is in allowed documentation areas
    const isAllowedPath = allowedPaths.some(allowed => 
      relativePath.startsWith(allowed) || 
      relativePath.includes(`/${allowed}`) ||
      relativePath.endsWith('.md') ||
      relativePath.endsWith('.txt')
    )
    
    if (!isAllowedPath) {
      return { 
        isValid: false, 
        resolvedPath: '',
        error: 'Access restricted to documentation directories and markdown files.' 
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

// Detect file type based on extension
function getDocumentationType(filePath: string): DocumentationFile['type'] {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.md':
    case '.markdown':
      return 'markdown'
    case '.json':
      return 'json'
    case '.yml':
    case '.yaml':
      return 'yaml'
    default:
      return 'text'
  }
}

// Parse markdown content for metadata
function parseMarkdownMetadata(content: string): DocumentationFile['metadata'] {
  const metadata: DocumentationFile['metadata'] = {}
  
  // Extract title from first heading
  const titleMatch = content.match(/^#\s+(.+)$/m)
  if (titleMatch) {
    metadata.title = titleMatch[1].trim()
  }
  
  // Extract description from first paragraph
  const lines = content.split('\n').filter(line => line.trim())
  for (const line of lines) {
    if (!line.startsWith('#') && line.trim().length > 0) {
      metadata.description = line.trim()
      break
    }
  }
  
  // Extract frontmatter if present
  if (content.startsWith('---')) {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
    if (frontmatterMatch) {
      try {
        // Basic YAML-like parsing (simplified)
        const frontmatter = frontmatterMatch[1]
        const lines = frontmatter.split('\n')
        
        for (const line of lines) {
          const [key, ...valueParts] = line.split(':')
          if (key && valueParts.length > 0) {
            const value = valueParts.join(':').trim()
            const cleanKey = key.trim()
            
            if (cleanKey === 'tags') {
              metadata.tags = value.split(',').map(tag => tag.trim())
            } else if (cleanKey === 'author') {
              metadata.author = value
            } else if (cleanKey === 'version') {
              metadata.version = value
            } else if (cleanKey === 'title' && !metadata.title) {
              metadata.title = value
            } else if (cleanKey === 'description' && !metadata.description) {
              metadata.description = value
            }
          }
        }
      } catch (error) {
        console.warn('Failed to parse frontmatter:', error)
      }
    }
  }
  
  // Generate table of contents
  metadata.toc = generateTableOfContents(content)
  
  return metadata
}

// Generate table of contents from markdown content
function generateTableOfContents(content: string): TableOfContentsItem[] {
  const toc: TableOfContentsItem[] = []
  const lines = content.split('\n')
  
  for (const line of lines) {
    const headingMatch = line.match(/^(#+)\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const title = headingMatch[2].trim()
      const anchor = title.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
      
      toc.push({
        level,
        title,
        anchor,
        children: []
      })
    }
  }
  
  return toc
}

// Read documentation file
async function readDocumentationFile(filePath: string, includeContent: boolean = true): Promise<DocumentationFile> {
  try {
    const stats = await fs.stat(filePath)
    const name = path.basename(filePath)
    const type = getDocumentationType(filePath)
    
    let content: string | undefined
    let metadata: DocumentationFile['metadata'] | undefined
    
    if (includeContent) {
      content = await fs.readFile(filePath, 'utf8')
      
      if (type === 'markdown') {
        metadata = parseMarkdownMetadata(content)
      } else if (type === 'json') {
        try {
          const jsonData = JSON.parse(content)
          metadata = {
            title: jsonData.title || jsonData.name,
            description: jsonData.description,
            version: jsonData.version,
            author: jsonData.author
          }
        } catch (error) {
          // Invalid JSON, treat as text
        }
      }
    }
    
    return {
      path: filePath,
      name,
      type,
      size: stats.size,
      lastModified: stats.mtime.toISOString(),
      content,
      metadata
    }
  } catch (error) {
    throw new Error(`Failed to read documentation file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// List documentation files recursively
async function listDocumentationFiles(
  dirPath: string,
  options: { recursive?: boolean; fileTypes?: string[]; includeContent?: boolean } = {}
): Promise<DocumentationStructure> {
  try {
    const structure: DocumentationStructure = {
      directories: [],
      totalFiles: 0,
      lastUpdated: new Date().toISOString()
    }
    
    const allowedTypes = options.fileTypes || ['.md', '.markdown', '.txt', '.json', '.yml', '.yaml']
    
    async function scanDirectory(currentPath: string, depth: number = 0): Promise<any> {
      if (depth > 5) return null // Prevent infinite recursion
      
      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true })
        const files: DocumentationFile[] = []
        const subdirectories: any[] = []
        
        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name)
          
          // Skip hidden files and common non-documentation directories
          if (entry.name.startsWith('.') || 
              entry.name === 'node_modules' || 
              entry.name === 'dist' || 
              entry.name === 'build') {
            continue
          }
          
          if (entry.isDirectory()) {
            if (options.recursive) {
              const subDir = await scanDirectory(fullPath, depth + 1)
              if (subDir) {
                subdirectories.push({
                  name: entry.name,
                  path: fullPath,
                  files: subDir.files,
                  subdirectories: subDir.subdirectories
                })
              }
            }
          } else {
            const ext = path.extname(entry.name).toLowerCase()
            if (allowedTypes.includes(ext)) {
              const docFile = await readDocumentationFile(fullPath, options.includeContent)
              files.push(docFile)
              structure.totalFiles++
            }
          }
        }
        
        return { files, subdirectories }
      } catch (error) {
        console.warn(`Failed to scan directory ${currentPath}:`, error)
        return null
      }
    }
    
    const result = await scanDirectory(dirPath)
    if (result) {
      structure.directories.push({
        name: path.basename(dirPath),
        path: dirPath,
        files: result.files,
        subdirectories: result.subdirectories
      })
    }
    
    return structure
  } catch (error) {
    throw new Error(`Failed to list documentation files: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Search in documentation files
async function searchDocumentation(
  searchPath: string,
  searchTerm: string,
  options: { fileTypes?: string[] } = {}
): Promise<DocumentationSearchResult[]> {
  try {
    const results: DocumentationSearchResult[] = []
    const allowedTypes = options.fileTypes || ['.md', '.markdown', '.txt']
    const searchRegex = new RegExp(searchTerm, 'gi')
    
    async function searchInDirectory(dirPath: string): Promise<void> {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true })
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name)
          
          if (entry.name.startsWith('.') || entry.name === 'node_modules') {
            continue
          }
          
          if (entry.isDirectory()) {
            await searchInDirectory(fullPath)
          } else {
            const ext = path.extname(entry.name).toLowerCase()
            if (allowedTypes.includes(ext)) {
              try {
                const content = await fs.readFile(fullPath, 'utf8')
                const lines = content.split('\n')
                const matches: DocumentationSearchResult['matches'] = []
                
                for (let i = 0; i < lines.length; i++) {
                  const line = lines[i]
                  if (searchRegex.test(line)) {
                    const context = [
                      lines[i - 1] || '',
                      line,
                      lines[i + 1] || ''
                    ].join('\n')
                    
                    matches.push({
                      line: i + 1,
                      content: line.trim(),
                      context: context.trim()
                    })
                  }
                }
                
                if (matches.length > 0) {
                  // Extract title for search result
                  const titleMatch = content.match(/^#\s+(.+)$/m)
                  const title = titleMatch ? titleMatch[1].trim() : path.basename(fullPath)
                  
                  results.push({
                    file: fullPath,
                    title,
                    matches,
                    score: matches.length
                  })
                }
              } catch (error) {
                console.warn(`Failed to search in ${fullPath}:`, error)
              }
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to search directory ${dirPath}:`, error)
      }
    }
    
    await searchInDirectory(searchPath)
    
    // Sort by score (number of matches)
    results.sort((a, b) => b.score - a.score)
    
    return results
  } catch (error) {
    throw new Error(`Failed to search documentation: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Write documentation file
async function writeDocumentationFile(filePath: string, content: string): Promise<{ success: boolean; size: number }> {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath)
    await fs.mkdir(dir, { recursive: true })
    
    // Write file
    await fs.writeFile(filePath, content, 'utf8')
    
    const stats = await fs.stat(filePath)
    return { success: true, size: stats.size }
  } catch (error) {
    throw new Error(`Failed to write documentation file: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// GET: List or read documentation files
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
    const docPath = searchParams.get('path') || ''
    const includeContent = searchParams.get('includeContent') === 'true'
    const recursive = searchParams.get('recursive') !== 'false' // Default true
    const fileTypes = searchParams.get('fileTypes')?.split(',') || []
    const searchTerm = searchParams.get('search') || ''
    
    const projectRoot = getProjectRoot()
    const pathValidation = validateDocPath(docPath, projectRoot)
    
    if (!pathValidation.isValid) {
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        error: pathValidation.error || 'Invalid documentation path',
        timestamp: new Date().toISOString()
      }
      return NextResponse.json(response, { status: 400 })
    }
    
    let data: any
    
    switch (action) {
      case 'read':
        // Read single file
        if (!require('fs').existsSync(pathValidation.resolvedPath)) {
          throw new Error('Documentation file not found')
        }
        
        const stats = await fs.stat(pathValidation.resolvedPath)
        if (!stats.isFile()) {
          throw new Error('Path is not a file')
        }
        
        data = await readDocumentationFile(pathValidation.resolvedPath, true)
        break
        
      case 'search':
        if (!searchTerm) {
          throw new Error('Search term is required')
        }
        
        data = await searchDocumentation(pathValidation.resolvedPath, searchTerm, { fileTypes })
        break
        
      case 'list':
      default:
        // List documentation structure
        const targetPath = require('fs').existsSync(pathValidation.resolvedPath) ? 
          pathValidation.resolvedPath : 
          path.join(projectRoot, 'docs')
        
        // Create docs directory if it doesn't exist
        if (!require('fs').existsSync(targetPath)) {
          await fs.mkdir(targetPath, { recursive: true })
        }
        
        data = await listDocumentationFiles(targetPath, {
          recursive,
          fileTypes: fileTypes.length > 0 ? fileTypes : undefined,
          includeContent
        })
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
        'Cache-Control': action === 'search' ? 'no-cache' : 'public, max-age=300, stale-while-revalidate=600',
        'Content-Type': 'application/json',
        'X-Processing-Time': `${processingTime}ms`
      }
    })
  } catch (error) {
    console.error('Error in docs GET:', error)
    
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }
    
    return NextResponse.json(response, { status: 500 })
  }
}

// POST: Write or generate documentation
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
    
    const body: DocumentationRequest = await request.json()
    const { action, path: docPath, content, options = {} } = body
    
    if (!action) {
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        error: 'Missing required parameter: action',
        timestamp: new Date().toISOString()
      }
      return NextResponse.json(response, { status: 400 })
    }
    
    const projectRoot = getProjectRoot()
    
    let data: any
    
    switch (action) {
      case 'write':
        if (!docPath || !content) {
          throw new Error('Path and content are required for write operations')
        }
        
        const pathValidation = validateDocPath(docPath, projectRoot)
        if (!pathValidation.isValid) {
          throw new Error(pathValidation.error || 'Invalid documentation path')
        }
        
        data = await writeDocumentationFile(pathValidation.resolvedPath, content)
        break
        
      case 'generate':
        // Generate documentation template
        const templatePath = docPath || 'docs/README.md'
        const resolvedTemplatePath = path.resolve(projectRoot, templatePath)
        
        if (!resolvedTemplatePath.startsWith(projectRoot)) {
          throw new Error('Invalid template path')
        }
        
        const template = `# Project Documentation

## Overview

This documentation provides comprehensive information about the project.

## Table of Contents

- [Getting Started](#getting-started)
- [Installation](#installation)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Contributing](#contributing)
- [License](#license)

## Getting Started

Add your getting started instructions here.

## Installation

\`\`\`bash
npm install
\`\`\`

## Usage

Add usage examples here.

## API Reference

Document your API endpoints and methods here.

## Contributing

Guidelines for contributing to this project.

## License

Add license information here.

---

*Generated on ${new Date().toISOString()}*
`
        
        data = await writeDocumentationFile(resolvedTemplatePath, template)
        break
        
      case 'validate':
        // Validate documentation structure
        const docsPath = path.resolve(projectRoot, 'docs')
        const structure = await listDocumentationFiles(docsPath, { recursive: true })
        
        const validationResults = {
          hasReadme: structure.directories.some(dir => 
            dir.files.some(file => file.name.toLowerCase().includes('readme'))
          ),
          hasContributing: structure.directories.some(dir => 
            dir.files.some(file => file.name.toLowerCase().includes('contributing'))
          ),
          hasChangelog: structure.directories.some(dir => 
            dir.files.some(file => file.name.toLowerCase().includes('changelog'))
          ),
          totalFiles: structure.totalFiles,
          issues: [] as string[]
        }
        
        if (!validationResults.hasReadme) {
          validationResults.issues.push('Missing README.md file')
        }
        if (!validationResults.hasContributing) {
          validationResults.issues.push('Missing CONTRIBUTING.md file')
        }
        if (validationResults.totalFiles === 0) {
          validationResults.issues.push('No documentation files found')
        }
        
        data = validationResults
        break
        
      default:
        const response: ApiResponse<null> = {
          success: false,
          data: null,
          error: `Unsupported documentation action: ${action}`,
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
    console.error('Error in docs POST:', error)
    
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