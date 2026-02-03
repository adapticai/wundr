export interface Report {
  id: string;
  title: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'draft' | 'published' | 'archived';
  data: any;
  type: 'analysis' | 'quality' | 'dependency' | 'performance';
}

export interface NormalizedAnalysisData {
  summary: {
    totalItems: number;
    successCount: number;
    errorCount: number;
    warningCount: number;
  };
  metrics: {
    performance: Record<string, number>;
    quality: Record<string, number>;
    coverage: Record<string, number>;
  };
  issues: Array<{
    id: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    category: string;
    message: string;
    file?: string;
    line?: number;
  }>;
  recommendations: Array<{
    id: string;
    priority: number;
    title: string;
    description: string;
    actionItems: string[];
  }>;
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'pdf' | 'markdown';
  includeCharts?: boolean;
  includeDetails?: boolean;
  sections?: string[];
}

export class ReportService {
  private baseUrl: string;

  constructor(baseUrl = '/api/reports') {
    this.baseUrl = baseUrl;
  }

  async getReports(): Promise<Report[]> {
    const response = await fetch(this.baseUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch reports');
    }
    return response.json();
  }

  async getReport(id: string): Promise<Report> {
    const response = await fetch(`${this.baseUrl}/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch report');
    }
    return response.json();
  }

  async createReport(report: Partial<Report>): Promise<Report> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    });
    if (!response.ok) {
      throw new Error('Failed to create report');
    }
    return response.json();
  }

  async updateReport(id: string, updates: Partial<Report>): Promise<Report> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      throw new Error('Failed to update report');
    }
    return response.json();
  }

  async deleteReport(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete report');
    }
  }

  async generateReport(type: Report['type'], data: any): Promise<Report> {
    const response = await fetch(`${this.baseUrl}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, data }),
    });
    if (!response.ok) {
      throw new Error('Failed to generate report');
    }
    return response.json();
  }

  /**
   * Normalizes raw analysis data into a standardized format
   * @param rawData Raw analysis data from various sources
   * @param type Type of analysis being normalized
   * @returns Normalized analysis data structure
   */
  normalizeAnalysisData(
    rawData: any,
    type: Report['type']
  ): NormalizedAnalysisData {
    const normalized: NormalizedAnalysisData = {
      summary: {
        totalItems: 0,
        successCount: 0,
        errorCount: 0,
        warningCount: 0,
      },
      metrics: {
        performance: {},
        quality: {},
        coverage: {},
      },
      issues: [],
      recommendations: [],
    };

    if (!rawData) {
      return normalized;
    }

    try {
      switch (type) {
        case 'analysis':
          this.normalizeAnalysisType(rawData, normalized);
          break;
        case 'quality':
          this.normalizeQualityType(rawData, normalized);
          break;
        case 'dependency':
          this.normalizeDependencyType(rawData, normalized);
          break;
        case 'performance':
          this.normalizePerformanceType(rawData, normalized);
          break;
        default:
          this.normalizeGenericType(rawData, normalized);
      }
    } catch (error) {
      console.error('Error normalizing analysis data:', error);
      // Return safe fallback data
      normalized.issues.push({
        id: 'normalization-error',
        severity: 'medium',
        category: 'system',
        message: 'Failed to normalize analysis data',
      });
    }

    return normalized;
  }

  /**
   * Exports a report in the specified format
   * @param reportId Report ID to export
   * @param options Export configuration options
   * @returns Export result with download URL or data
   */
  async exportReport(
    reportId: string,
    options: ExportOptions
  ): Promise<{
    success: boolean;
    downloadUrl?: string;
    data?: any;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/${reportId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        throw new Error(`Export failed with status: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        downloadUrl: result.downloadUrl,
        data: result.data,
      };
    } catch (error) {
      console.error('Export error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Export failed',
      };
    }
  }

  /**
   * Static method to generate a report without instantiating the service
   * @param type Report type
   * @param data Report data
   * @param options Generation options
   * @returns Generated report
   */
  static async generateReport(
    type: Report['type'],
    data: any,
    options: { baseUrl?: string; template?: string } = {}
  ): Promise<Report> {
    const { baseUrl = '/api/reports', template } = options;

    const payload = {
      type,
      data,
      ...(template && { template }),
    };

    const response = await fetch(`${baseUrl}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate report: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Parse analysis file content into normalized format
   * @param fileContent Raw file content (JSON string, CSV, or structured data)
   * @param fileType Type of file being parsed ('json', 'csv', 'text', 'auto')
   * @param analysisType Type of analysis to apply
   * @returns Parsed and normalized analysis data
   */
  static parseAnalysisFile(
    fileContent: string | ArrayBuffer | File,
    fileType: 'json' | 'csv' | 'text' | 'auto' = 'auto',
    analysisType: Report['type'] = 'analysis'
  ): Promise<NormalizedAnalysisData> {
    return new Promise((resolve, reject) => {
      try {
        let content: string;

        // Handle different input types
        if (fileContent instanceof File) {
          const reader = new FileReader();
          reader.onload = () => {
            if (reader.result) {
              const result = ReportService.parseAnalysisFile(
                reader.result,
                fileType,
                analysisType
              );
              resolve(result);
            } else {
              reject(new Error('Failed to read file'));
            }
          };
          reader.onerror = () => reject(new Error('File reading failed'));
          reader.readAsText(fileContent);
          return;
        } else if (fileContent instanceof ArrayBuffer) {
          content = new TextDecoder().decode(fileContent);
        } else {
          content = fileContent;
        }

        // Auto-detect file type if needed
        if (fileType === 'auto') {
          fileType = ReportService.detectFileType(content);
        }

        // Parse content based on type
        let rawData: any;

        switch (fileType) {
          case 'json':
            rawData = ReportService.parseJSONContent(content);
            break;
          case 'csv':
            rawData = ReportService.parseCSVContent(content);
            break;
          case 'text':
            rawData = ReportService.parseTextContent(content);
            break;
          default:
            throw new Error(`Unsupported file type: ${fileType}`);
        }

        // Normalize the parsed data
        const service = new ReportService();
        const normalizedData = service.normalizeAnalysisData(
          rawData,
          analysisType
        );

        // Add parsing metadata
        const result = {
          ...normalizedData,
          metadata: {
            originalFileType: fileType,
            parsedAt: new Date().toISOString(),
            contentSize: content.length,
            analysisType,
          },
        };

        resolve(result);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown parsing error';

        // Return safe fallback data with error information
        resolve({
          summary: {
            totalItems: 0,
            successCount: 0,
            errorCount: 1,
            warningCount: 0,
          },
          metrics: {
            performance: {},
            quality: {},
            coverage: {},
          },
          issues: [
            {
              id: 'parse-error',
              severity: 'critical',
              category: 'parsing',
              message: `Failed to parse analysis file: ${errorMessage}`,
            },
          ],
          recommendations: [
            {
              id: 'parse-fix',
              priority: 1,
              title: 'Fix File Format',
              description:
                'The uploaded file could not be parsed. Please verify the file format and content.',
              actionItems: [
                'Check if the file is valid JSON, CSV, or text format',
                'Verify the file is not corrupted',
                'Ensure the file contains the expected data structure',
              ],
            },
          ],
          metadata: {
            originalFileType: fileType,
            parsedAt: new Date().toISOString(),
            contentSize: 0,
            analysisType,
            parseError: errorMessage,
          },
        } as NormalizedAnalysisData);
      }
    });
  }

  // Private static helper methods for file parsing
  private static detectFileType(content: string): 'json' | 'csv' | 'text' {
    const trimmed = content.trim();

    // Check for JSON
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        JSON.parse(trimmed);
        return 'json';
      } catch {
        // Not valid JSON, continue checking
      }
    }

    // Check for CSV (look for commas and consistent structure)
    const lines = trimmed.split('\n').filter(line => line.trim());
    if (lines.length > 1) {
      const firstLineCommas = (lines[0].match(/,/g) || []).length;
      const hasConsistentCommas = lines
        .slice(1, Math.min(lines.length, 5))
        .every(line => (line.match(/,/g) || []).length === firstLineCommas);

      if (firstLineCommas > 0 && hasConsistentCommas) {
        return 'csv';
      }
    }

    return 'text';
  }

  private static parseJSONContent(content: string): any {
    try {
      return JSON.parse(content);
    } catch (error) {
      throw new Error(
        `Invalid JSON content: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private static parseCSVContent(content: string): any {
    try {
      const lines = content
        .trim()
        .split('\n')
        .filter(line => line.trim());

      if (lines.length === 0) {
        throw new Error('Empty CSV content');
      }

      // Parse header row
      const headers = lines[0]
        .split(',')
        .map(h => h.trim().replace(/^"|"$/g, ''));

      // Parse data rows
      const data = lines.slice(1).map((line, index) => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));

        if (values.length !== headers.length) {
          console.warn(
            `Row ${index + 2} has ${values.length} columns, expected ${headers.length}`
          );
        }

        const row: Record<string, string> = {};
        headers.forEach((header, i) => {
          row[header] = values[i] || '';
        });

        return row;
      });

      return {
        headers,
        data,
        rowCount: data.length,
        columnCount: headers.length,
        format: 'csv',
      };
    } catch (error) {
      throw new Error(
        `Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private static parseTextContent(content: string): any {
    try {
      const lines = content.split('\n');
      const nonEmptyLines = lines.filter(line => line.trim());

      // Try to extract structured information from text
      const data = {
        totalLines: lines.length,
        nonEmptyLines: nonEmptyLines.length,
        averageLineLength:
          nonEmptyLines.reduce((sum, line) => sum + line.length, 0) /
            nonEmptyLines.length || 0,
        format: 'text',
        content: content,

        // Look for common patterns
        patterns: {
          hasNumbers: /\d/.test(content),
          hasEmails: /@\w+\.\w+/.test(content),
          hasUrls: /https?:\/\//.test(content),
          hasTimestamps: /\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/.test(content),
          hasErrorKeywords: /error|fail|exception|warning/i.test(content),
          hasSuccessKeywords: /success|pass|complete|ok/i.test(content),
        },
      };

      return data;
    } catch (error) {
      throw new Error(
        `Failed to parse text content: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Private helper methods for normalization
  private normalizeAnalysisType(
    rawData: any,
    normalized: NormalizedAnalysisData
  ): void {
    if (rawData.results) {
      normalized.summary.totalItems = rawData.results.length;
      normalized.summary.successCount = rawData.results.filter(
        (r: any) => r.status === 'success'
      ).length;
      normalized.summary.errorCount = rawData.results.filter(
        (r: any) => r.status === 'error'
      ).length;
      normalized.summary.warningCount = rawData.results.filter(
        (r: any) => r.status === 'warning'
      ).length;
    }

    if (rawData.metrics) {
      normalized.metrics = { ...normalized.metrics, ...rawData.metrics };
    }

    if (rawData.issues) {
      normalized.issues = rawData.issues.map((issue: any, index: number) => ({
        id: issue.id || `issue-${index}`,
        severity: issue.severity || 'medium',
        category: issue.category || 'general',
        message: issue.message || 'No message provided',
        file: issue.file,
        line: issue.line,
      }));
    }
  }

  private normalizeQualityType(
    rawData: any,
    normalized: NormalizedAnalysisData
  ): void {
    if (rawData.quality) {
      normalized.metrics.quality = rawData.quality;
    }

    if (rawData.violations) {
      normalized.issues = rawData.violations.map(
        (violation: any, index: number) => ({
          id: violation.id || `quality-${index}`,
          severity: this.mapSeverity(violation.level),
          category: 'quality',
          message: violation.message,
          file: violation.file,
          line: violation.line,
        })
      );
    }
  }

  private normalizeDependencyType(
    rawData: any,
    normalized: NormalizedAnalysisData
  ): void {
    if (rawData.dependencies) {
      normalized.summary.totalItems = Object.keys(rawData.dependencies).length;
    }

    if (rawData.vulnerabilities) {
      normalized.issues = rawData.vulnerabilities.map(
        (vuln: any, index: number) => ({
          id: vuln.id || `vuln-${index}`,
          severity: vuln.severity || 'medium',
          category: 'security',
          message: vuln.title || vuln.message,
          file: vuln.module,
        })
      );
    }
  }

  private normalizePerformanceType(
    rawData: any,
    normalized: NormalizedAnalysisData
  ): void {
    if (rawData.metrics) {
      normalized.metrics.performance = rawData.metrics;
    }

    if (rawData.bottlenecks) {
      normalized.issues = rawData.bottlenecks.map(
        (bottleneck: any, index: number) => ({
          id: `perf-${index}`,
          severity: bottleneck.impact === 'high' ? 'high' : 'medium',
          category: 'performance',
          message: bottleneck.description,
          file: bottleneck.file,
          line: bottleneck.line,
        })
      );
    }
  }

  private normalizeGenericType(
    rawData: any,
    normalized: NormalizedAnalysisData
  ): void {
    // Generic normalization for unknown data types
    if (Array.isArray(rawData)) {
      normalized.summary.totalItems = rawData.length;
    } else if (typeof rawData === 'object') {
      normalized.summary.totalItems = Object.keys(rawData).length;
    }

    // Try to extract common patterns
    if (rawData.errors) {
      normalized.summary.errorCount = Array.isArray(rawData.errors)
        ? rawData.errors.length
        : 1;
    }

    if (rawData.warnings) {
      normalized.summary.warningCount = Array.isArray(rawData.warnings)
        ? rawData.warnings.length
        : 1;
    }
  }

  private mapSeverity(level: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (level?.toLowerCase()) {
      case 'error':
      case 'critical':
        return 'critical';
      case 'warning':
      case 'high':
        return 'high';
      case 'info':
      case 'medium':
        return 'medium';
      default:
        return 'low';
    }
  }
}

export const reportService = new ReportService();
