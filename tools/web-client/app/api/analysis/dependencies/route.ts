import { NextRequest, NextResponse } from 'next/server'
import { ApiResponse } from '@/types/data'

export interface DependencyData {
  name: string
  version: string
  latestVersion: string
  type: 'dependency' | 'devDependency' | 'peerDependency'
  size: number
  vulnerabilities: number
  lastUpdated: string
  license: string
  description: string
  dependencies: string[]
  maintainers: number
  weeklyDownloads: number
  repositoryUrl?: string
  homepageUrl?: string
}

export interface SecurityVulnerability {
  id: string
  packageName: string
  severity: 'low' | 'moderate' | 'high' | 'critical'
  title: string
  description: string
  patchedVersions: string
  vulnerableVersions: string
  cwe: string[]
  cvss: number
  publishedAt: string
}

export interface DependencyStats {
  total: number
  outdated: number
  vulnerable: number
  totalSize: number
  directDependencies: number
  devDependencies: number
  peerDependencies: number
}

export interface DependencyAnalysisResponse {
  dependencies: DependencyData[]
  vulnerabilities: SecurityVulnerability[]
  stats: DependencyStats
}

// Simulate real dependency analysis from package.json and registry data
async function analyzeDependencies(): Promise<DependencyAnalysisResponse> {
  // In production, this would:
  // 1. Read package.json from the project
  // 2. Query npm registry for package info
  // 3. Check vulnerability databases
  // 4. Calculate bundle sizes
  // 5. Fetch package metadata

  // Mock data representing real analysis results
  const dependencies: DependencyData[] = [
    {
      name: "react",
      version: "19.1.0",
      latestVersion: "19.1.0",
      type: "dependency",
      size: 2580000,
      vulnerabilities: 0,
      lastUpdated: "2024-12-05",
      license: "MIT",
      description: "React is a JavaScript library for building user interfaces.",
      dependencies: ["loose-envify"],
      maintainers: 12,
      weeklyDownloads: 20000000,
      repositoryUrl: "https://github.com/facebook/react",
      homepageUrl: "https://reactjs.org/"
    },
    {
      name: "next",
      version: "15.4.5",
      latestVersion: "15.4.6", 
      type: "dependency",
      size: 45600000,
      vulnerabilities: 1,
      lastUpdated: "2024-12-10",
      license: "MIT",
      description: "The React Framework for Production",
      dependencies: ["react", "react-dom"],
      maintainers: 8,
      weeklyDownloads: 5000000,
      repositoryUrl: "https://github.com/vercel/next.js",
      homepageUrl: "https://nextjs.org"
    },
    {
      name: "lodash",
      version: "4.17.20",
      latestVersion: "4.17.21",
      type: "dependency",
      size: 1400000,
      vulnerabilities: 2,
      lastUpdated: "2021-02-20",
      license: "MIT",
      description: "Lodash modular utilities.",
      dependencies: [],
      maintainers: 3,
      weeklyDownloads: 35000000,
      repositoryUrl: "https://github.com/lodash/lodash",
      homepageUrl: "https://lodash.com/"
    },
    {
      name: "@types/node",
      version: "20.0.0",
      latestVersion: "22.7.4",
      type: "devDependency",
      size: 890000,
      vulnerabilities: 0,
      lastUpdated: "2024-11-15",
      license: "MIT",
      description: "TypeScript definitions for Node.js",
      dependencies: [],
      maintainers: 45,
      weeklyDownloads: 15000000,
      repositoryUrl: "https://github.com/DefinitelyTyped/DefinitelyTyped",
    },
    {
      name: "chart.js",
      version: "4.5.0",
      latestVersion: "4.5.0",
      type: "dependency", 
      size: 1200000,
      vulnerabilities: 0,
      lastUpdated: "2024-10-22",
      license: "MIT",
      description: "Simple HTML5 Charts using the canvas element",
      dependencies: [],
      maintainers: 6,
      weeklyDownloads: 2500000,
      repositoryUrl: "https://github.com/chartjs/Chart.js",
      homepageUrl: "https://www.chartjs.org"
    },
    {
      name: "axios",
      version: "1.7.0",
      latestVersion: "1.7.9",
      type: "dependency",
      size: 1100000,
      vulnerabilities: 0,
      lastUpdated: "2024-11-30",
      license: "MIT", 
      description: "Promise based HTTP client for the browser and node.js",
      dependencies: ["follow-redirects", "form-data"],
      maintainers: 4,
      weeklyDownloads: 45000000,
      repositoryUrl: "https://github.com/axios/axios"
    },
    {
      name: "typescript",
      version: "5.3.0",
      latestVersion: "5.7.2",
      type: "devDependency",
      size: 12000000,
      vulnerabilities: 0,
      lastUpdated: "2024-12-01",
      license: "Apache-2.0",
      description: "TypeScript is a language for application scale JavaScript development",
      dependencies: [],
      maintainers: 6,
      weeklyDownloads: 25000000,
      repositoryUrl: "https://github.com/Microsoft/TypeScript",
      homepageUrl: "https://www.typescriptlang.org/"
    }
  ]

  const vulnerabilities: SecurityVulnerability[] = [
    {
      id: "GHSA-67hx-6x53-jw92",
      packageName: "next",
      severity: "moderate",
      title: "Server-Side Request Forgery in Next.js",
      description: "Next.js applications using the Image Optimization API are vulnerable to SSRF attacks.",
      patchedVersions: ">=15.4.6",
      vulnerableVersions: "<15.4.6",
      cwe: ["CWE-918"],
      cvss: 5.3,
      publishedAt: "2024-12-08"
    },
    {
      id: "GHSA-jf85-cpcp-j695",
      packageName: "lodash",
      severity: "high",
      title: "Prototype pollution in lodash",
      description: "Lodash versions prior to 4.17.21 are vulnerable to prototype pollution.",
      patchedVersions: ">=4.17.21",
      vulnerableVersions: "<4.17.21",
      cwe: ["CWE-1321"],
      cvss: 7.5,
      publishedAt: "2021-02-15"
    },
    {
      id: "GHSA-35jh-r3h4-6jhm",
      packageName: "lodash",
      severity: "critical",
      title: "Command injection in lodash template",
      description: "Lodash template function is vulnerable to command injection.",
      patchedVersions: ">=4.17.21",
      vulnerableVersions: "<4.17.21", 
      cwe: ["CWE-94"],
      cvss: 9.8,
      publishedAt: "2021-02-15"
    }
  ]

  const stats: DependencyStats = {
    total: dependencies.length,
    outdated: dependencies.filter(d => d.version !== d.latestVersion).length,
    vulnerable: dependencies.filter(d => d.vulnerabilities > 0).length,
    totalSize: dependencies.reduce((sum, d) => sum + d.size, 0),
    directDependencies: dependencies.filter(d => d.type === 'dependency').length,
    devDependencies: dependencies.filter(d => d.type === 'devDependency').length,
    peerDependencies: dependencies.filter(d => d.type === 'peerDependency').length
  }

  return { dependencies, vulnerabilities, stats }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const refresh = searchParams.get('refresh') === 'true'

    // Add artificial delay to simulate analysis time
    if (refresh) {
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    const analysisResult = await analyzeDependencies()

    const response: ApiResponse<DependencyAnalysisResponse> = {
      success: true,
      data: analysisResult,
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
        'Content-Type': 'application/json'
      }
    })
  } catch (_error) {
    // Error logged - details available in network tab

    const response: ApiResponse<null> = {
      success: false,
      data: null,
      error: 'Failed to analyze dependencies',
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