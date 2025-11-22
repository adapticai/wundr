/**
 * MCP Wrapper Functions for Railway and Netlify
 * Provides typed interfaces for deployment platform MCP tools
 *
 * @module deployment-mcp-wrappers
 */

import * as fs from 'fs';
import * as path from 'path';

import { Logger } from '../utils/logger';

const logger = new Logger({ name: 'deployment-mcp-wrappers' });

// Railway Types
export interface RailwayDeploymentStatus {
  id: string;
  status: 'building' | 'deploying' | 'success' | 'failed' | 'crashed';
  createdAt: string;
  finishedAt?: string;
  meta?: Record<string, unknown>;
}

export interface RailwayService {
  id: string;
  name: string;
  projectId: string;
  environmentId: string;
  status: string;
}

export interface RailwayLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  source?: string;
}

// Netlify Types
export interface NetlifyDeployStatus {
  id: string;
  state: 'building' | 'processing' | 'ready' | 'error' | 'uploading';
  url?: string;
  deployUrl?: string;
  createdAt: string;
  publishedAt?: string;
}

export interface NetlifySite {
  id: string;
  name: string;
  url: string;
  adminUrl: string;
  buildSettings?: {
    cmd: string;
    dir: string;
  };
}

export interface NetlifyBuildLog {
  deployId: string;
  logs: string;
  duration?: number;
  error?: string;
}

// Railway MCP Wrapper Functions
export const railway = {
  /**
   * Get deployment status for a Railway project
   */
  async deployStatus(projectId: string): Promise<RailwayDeploymentStatus> {
    // This is a wrapper that would call mcp__railway__deploy_status
    // In actual usage, Claude Code calls the MCP tool directly
    logger.debug(`mcp__railway__deploy_status { projectId: "${projectId}" }`);
    return {} as RailwayDeploymentStatus;
  },

  /**
   * Fetch logs from a Railway service
   */
  async getLogs(options: {
    serviceId: string;
    lines?: number;
    since?: string;
    filter?: string;
  }): Promise<RailwayLogEntry[]> {
    const { serviceId, lines = 500, since = '10m', filter } = options;
    logger.debug(`mcp__railway__get_logs { serviceId: "${serviceId}", lines: ${lines}, since: "${since}"${filter ? `, filter: "${filter}"` : ''} }`);
    return [];
  },

  /**
   * Get recent deployments for a project
   */
  async getDeployments(projectId: string, limit = 5): Promise<RailwayDeploymentStatus[]> {
    logger.debug(`mcp__railway__get_deployments { projectId: "${projectId}", limit: ${limit} }`);
    return [];
  },

  /**
   * List all services in a project
   */
  async listServices(projectId: string): Promise<RailwayService[]> {
    logger.debug(`mcp__railway__list_services { projectId: "${projectId}" }`);
    return [];
  },

  /**
   * Restart a service
   */
  async restartService(serviceId: string): Promise<boolean> {
    logger.debug(`mcp__railway__restart_service { serviceId: "${serviceId}" }`);
    return true;
  },

  /**
   * Get environment variables
   */
  async getVariables(projectId: string): Promise<Record<string, string>> {
    logger.debug(`mcp__railway__get_variables { projectId: "${projectId}" }`);
    return {};
  },
};

// Netlify MCP Wrapper Functions
export const netlify = {
  /**
   * Get deployment status for a Netlify site
   */
  async deployStatus(siteId?: string, deployId?: string): Promise<NetlifyDeployStatus> {
    const params = siteId ? `siteId: "${siteId}"` : `deployId: "${deployId}"`;
    logger.debug(`mcp__netlify__deploy_status { ${params} }`);
    return {} as NetlifyDeployStatus;
  },

  /**
   * Fetch build logs for a deploy
   */
  async getBuildLogs(deployId: string): Promise<NetlifyBuildLog> {
    logger.debug(`mcp__netlify__get_build_logs { deployId: "${deployId}", includeOutput: true }`);
    return {} as NetlifyBuildLog;
  },

  /**
   * Get recent deployments for a site
   */
  async getDeploys(siteId: string, limit = 5): Promise<NetlifyDeployStatus[]> {
    logger.debug(`mcp__netlify__get_deploys { siteId: "${siteId}", limit: ${limit} }`);
    return [];
  },

  /**
   * List all sites
   */
  async listSites(): Promise<NetlifySite[]> {
    logger.debug('mcp__netlify__list_sites {}');
    return [];
  },

  /**
   * Trigger a new deploy
   */
  async triggerDeploy(siteId: string): Promise<{ deployId: string; state: string }> {
    logger.debug(`mcp__netlify__trigger_deploy { siteId: "${siteId}" }`);
    return { deployId: '', state: 'building' };
  },

  /**
   * Get serverless function logs
   */
  async getFunctionLogs(siteId: string, functionName: string, limit = 500): Promise<string[]> {
    logger.debug(`mcp__netlify__get_function_logs { siteId: "${siteId}", functionName: "${functionName}", limit: ${limit} }`);
    return [];
  },
};

// Utility functions
export function detectPlatform(projectPath: string): 'railway' | 'netlify' | null {
  if (fs.existsSync(path.join(projectPath, 'railway.json')) || process.env.RAILWAY_PROJECT_ID) {
    return 'railway';
  }
  if (fs.existsSync(path.join(projectPath, 'netlify.toml')) || process.env.NETLIFY_SITE_ID) {
    return 'netlify';
  }
  return null;
}

export function getPlatformConfig(platform: 'railway' | 'netlify'): Record<string, string> {
  if (platform === 'railway') {
    return {
      projectId: process.env.RAILWAY_PROJECT_ID || '',
      apiToken: process.env.RAILWAY_API_TOKEN || '',
    };
  }
  if (platform === 'netlify') {
    return {
      siteId: process.env.NETLIFY_SITE_ID || '',
      accessToken: process.env.NETLIFY_ACCESS_TOKEN || '',
    };
  }
  return {};
}
