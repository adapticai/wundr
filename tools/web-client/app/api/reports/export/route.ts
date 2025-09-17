import { NextRequest, NextResponse } from 'next/server';
// import { ReportService } from '@/lib/services/report-service';
import {
  ReportContent,
  ExportFormat,
} from '@/types/reports';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reportContent, format, reportName } = body;
    
    // Validate required fields
    if (!reportContent || !format || !reportName) {
      return NextResponse.json(
        { error: 'Report content, format, and report name are required' },
        { status: 400 }
      );
    }

    // Validate format
    const validFormats: ExportFormat[] = ['json', 'csv', 'html', 'pdf', 'excel', 'markdown'];
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { error: `Invalid format. Supported formats: ${validFormats.join(', ')}` },
        { status: 400 }
      );
    }

    let exportData: string;
    let mimeType: string;
    let fileExtension: string;

    switch (format) {
      case 'json':
        exportData = JSON.stringify(reportContent, null, 2);
        mimeType = 'application/json';
        fileExtension = 'json';
        break;

      case 'csv':
        exportData = await generateCSV(reportContent);
        mimeType = 'text/csv';
        fileExtension = 'csv';
        break;

      case 'html':
        exportData = generateHTMLReport(reportContent, reportName);
        mimeType = 'text/html';
        fileExtension = 'html';
        break;

      case 'markdown':
        exportData = generateMarkdownReport(reportContent, reportName);
        mimeType = 'text/markdown';
        fileExtension = 'md';
        break;

      case 'pdf':
      case 'excel':
        // For now, fallback to HTML for PDF and CSV for Excel
        if (format === 'pdf') {
          exportData = generateHTMLReport(reportContent, reportName, true);
          mimeType = 'text/html';
          fileExtension = 'html';
        } else {
          exportData = await generateCSV(reportContent);
          mimeType = 'text/csv';
          fileExtension = 'csv';
        }
        break;

      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    // Return the file data
    return new NextResponse(exportData, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${reportName}.${fileExtension}"`,
      },
    });

  } catch (_error) {
    // Error logged - details available in network tab;
    
    return NextResponse.json(
      { 
        error: 'Failed to export report',
        details: _error instanceof Error ? _error.message : 'Unknown error',
        success: false,
      },
      { status: 500 }
    );
  }
}

/**
 * Generate CSV from report content
 */
async function generateCSV(reportContent: ReportContent): Promise<string> {
  // Extract tabular data from tables in sections
  const tables = reportContent.sections.flatMap(section => section.tables || []);
  
  if (tables.length === 0) {
    throw new Error('No tabular data found in report for CSV export');
  }

  // Use the first table for CSV export
  const table = tables[0];
  const headers = table.columns.map(col => col.label).join(',');
  const rows = table.rows.map(row => 
    table.columns.map(col => {
      const value = row[col.key];
      return typeof value === 'string' && value.includes(',') 
        ? `"${value.replace(/"/g, '""')}"` 
        : value;
    }).join(',')
  );

  return [headers, ...rows].join('\n');
}

/**
 * Generate HTML report
 */
function generateHTMLReport(reportContent: ReportContent, title: string, printable = false): string {
  const styles = printable ? `
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; }
      .print-only { display: block; }
      .no-print { display: none; }
      @media print { 
        .print-only { display: block; } 
        .no-print { display: none; }
        body { margin: 0; }
        .container { box-shadow: none; }
      }
    </style>
  ` : `
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
      .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
      .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
      .metric { display: inline-block; margin: 10px 20px; text-align: center; }
      .metric-value { font-size: 2em; font-weight: bold; color: #0066cc; }
      .section { margin-bottom: 30px; }
      .section h2 { color: #333; border-bottom: 2px solid #0066cc; padding-bottom: 5px; }
      table { width: 100%; border-collapse: collapse; margin: 20px 0; }
      th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
      th { background-color: #f2f2f2; font-weight: bold; }
      .badge { padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; }
      .badge-critical { background: #dc2626; color: white; }
      .badge-high { background: #ea580c; color: white; }
      .badge-medium { background: #d97706; color: white; }
      .badge-low { background: #16a34a; color: white; }
      .risk-level { padding: 8px 16px; border-radius: 6px; font-weight: bold; text-transform: uppercase; }
      .risk-critical { background: #dc2626; color: white; }
      .risk-high { background: #ea580c; color: white; }
      .risk-medium { background: #d97706; color: white; }
      .risk-low { background: #16a34a; color: white; }
    </style>
  `;

  return `
<!DOCTYPE html>
<html>
<head>
    <title>${title} - Analysis Report</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    ${styles}
</head>
<body>
    <div class="container">
        <h1>${title} - Analysis Report</h1>
        <p><em>Generated on ${new Date().toLocaleDateString()}</em></p>

        <div class="summary">
            <h2>Executive Summary</h2>
            <p>${reportContent.summary.executiveSummary}</p>
            
            <h3>Key Metrics</h3>
            <div style="display: flex; flex-wrap: wrap; justify-content: center;">
                ${reportContent.summary.metrics.map(metric => `
                    <div class="metric">
                        <div class="metric-value">${metric.value}</div>
                        <div>${metric.label}</div>
                    </div>
                `).join('')}
            </div>

            <h3>Key Findings</h3>
            <ul>
                ${reportContent.summary.keyFindings.map(finding => `<li>${finding}</li>`).join('')}
            </ul>

            <h3>Risk Assessment</h3>
            <p><strong>Risk Level:</strong> <span class="risk-level risk-${reportContent.summary.riskAssessment.level}">${reportContent.summary.riskAssessment.level}</span></p>
            
            ${reportContent.summary.riskAssessment.factors.length > 0 ? `
                <h4>Risk Factors:</h4>
                <ul>
                    ${reportContent.summary.riskAssessment.factors.map(factor => `<li>${factor}</li>`).join('')}
                </ul>
            ` : ''}
            
            ${reportContent.summary.riskAssessment.mitigation.length > 0 ? `
                <h4>Mitigation Strategies:</h4>
                <ul>
                    ${reportContent.summary.riskAssessment.mitigation.map(mitigation => `<li>${mitigation}</li>`).join('')}
                </ul>
            ` : ''}
        </div>

        ${reportContent.sections.map(section => `
            <div class="section">
                <h2>${section.title}</h2>
                ${section.description ? `<p><em>${section.description}</em></p>` : ''}
                
                ${section.content.map(content => {
                  switch (content.type) {
                    case 'text':
                      return `<p>${content.content}</p>`;
                    case 'list':
                      return `<ul>${Array.isArray(content.content) ? content.content.map(item => `<li>${item}</li>`).join('') : ''}</ul>`;
                    case 'metrics-grid':
                      return `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0;">
                        ${Object.entries(content.content as Record<string, string | number>).map(([key, value]) => `
                          <div style="text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef;">
                            <div style="font-size: 1.5em; font-weight: bold; color: #0066cc;">${value}</div>
                            <div style="color: #666; margin-top: 5px;">${key}</div>
                          </div>
                        `).join('')}
                      </div>`;
                    case 'callout':
                      const level = content.level || 'info';
                      const emoji = {
                        info: 'ℹ️',
                        warning: '⚠️',
                        error: '❌',
                        success: '✅'
                      }[level];
                      return `<div style="padding: 15px; margin: 15px 0; border-left: 4px solid #0066cc; background: #f8f9fa;">
                        ${emoji} <strong>${level.toUpperCase()}:</strong> ${content.content}
                      </div>`;
                    default:
                      return `<div>${content.content}</div>`;
                  }
                }).join('')}

                ${section.tables?.map(table => `
                    <h3>${table.title}</h3>
                    <div style="overflow-x: auto;">
                        <table>
                            <thead>
                                <tr>
                                    ${table.columns.map(col => `<th>${col.label}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${table.rows.slice(0, 20).map(row => `
                                    <tr>
                                        ${table.columns.map(col => {
                                          const value = row[col.key];
                                          if (col.type === 'badge' && ['critical', 'high', 'medium', 'low'].includes(String(value).toLowerCase())) {
                                            return `<td><span class="badge badge-${String(value).toLowerCase()}">${value}</span></td>`;
                                          }
                                          if (col.type === 'progress') {
                                            return `<td>${value}%</td>`;
                                          }
                                          if (col.type === 'code') {
                                            return `<td><code>${value}</code></td>`;
                                          }
                                          return `<td>${value || ''}</td>`;
                                        }).join('')}
                                    </tr>
                                `).join('')}
                                ${table.rows.length > 20 ? `
                                    <tr>
                                        <td colspan="${table.columns.length}" style="text-align: center; font-style: italic; color: #666;">
                                            ... and ${table.rows.length - 20} more rows
                                        </td>
                                    </tr>
                                ` : ''}
                            </tbody>
                        </table>
                    </div>
                `).join('') || ''}
            </div>
        `).join('')}

        ${reportContent.appendices && reportContent.appendices.length > 0 ? `
            <div class="section">
                <h2>Appendices</h2>
                ${reportContent.appendices.map(appendix => `
                    <h3>${appendix.title}</h3>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; overflow-x: auto;">
                        ${appendix.type === 'raw-data' ? 
                          `<pre style="white-space: pre-wrap; font-family: 'Consolas', monospace; font-size: 0.9em;">${appendix.content}</pre>` : 
                          `<div>${appendix.content}</div>`}
                    </div>
                `).join('')}
            </div>
        ` : ''}

        <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 0.9em;">
            <p>Generated by Wundr Analysis Engine • ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
        </footer>
    </div>
</body>
</html>
  `.trim();
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(reportContent: ReportContent, title: string): string {
  const sections: string[] = [];

  // Header
  sections.push(`# ${title} - Analysis Report`);
  sections.push(`**Generated on:** ${new Date().toLocaleDateString()}`);
  sections.push(`---`);

  // Executive summary
  sections.push('## Executive Summary');
  sections.push(reportContent.summary.executiveSummary);

  // Key metrics
  sections.push('\n### Key Metrics');
  const metricsTable = [
    '| Metric | Value |',
    '|--------|-------|',
    ...reportContent.summary.metrics.map(metric => 
      `| ${metric.label} | ${metric.value} |`
    )
  ].join('\n');
  sections.push(metricsTable);

  // Key findings
  if (reportContent.summary.keyFindings?.length > 0) {
    sections.push('\n### Key Findings');
    reportContent.summary.keyFindings.forEach(finding => {
      sections.push(`- ${finding}`);
    });
  }

  // Risk assessment
  sections.push('\n### Risk Assessment');
  sections.push(`**Overall Risk Level:** \`${reportContent.summary.riskAssessment.level.toUpperCase()}\``);

  if (reportContent.summary.riskAssessment.factors.length > 0) {
    sections.push('\n**Risk Factors:**');
    reportContent.summary.riskAssessment.factors.forEach(factor => {
      sections.push(`- ${factor}`);
    });
  }

  if (reportContent.summary.riskAssessment.mitigation.length > 0) {
    sections.push('\n**Mitigation Strategies:**');
    reportContent.summary.riskAssessment.mitigation.forEach(mitigation => {
      sections.push(`- ${mitigation}`);
    });
  }

  // Sections
  reportContent.sections.forEach(section => {
    sections.push(`\n## ${section.title}`);
    
    if (section.description) {
      sections.push(section.description);
    }

    // Content
    section.content.forEach(content => {
      switch (content.type) {
        case 'text':
          sections.push(content.content as string);
          break;
        case 'list':
          const items = Array.isArray(content.content) ? content.content : [];
          sections.push(items.map(item => `- ${item}`).join('\n'));
          break;
        case 'metrics-grid':
          if (typeof content.content === 'object' && content.content !== null) {
            const metrics = content.content as Record<string, string | number>;
            sections.push(Object.entries(metrics)
              .map(([key, value]) => `**${key}**: ${value}`)
              .join(' | '));
          }
          break;
        case 'callout':
          const level = content.level || 'info';
          const emoji = {
            info: 'ℹ️',
            warning: '⚠️',
            error: '❌',
            success: '✅'
          }[level];
          sections.push(`> ${emoji} **${level.toUpperCase()}**: ${content.content}`);
          break;
      }
    });

    // Tables
    if (section.tables) {
      section.tables.forEach(table => {
        sections.push(`\n### ${table.title}`);
        
        if (table.rows.length === 0) {
          sections.push('*No data available*');
          return;
        }

        // Header
        const headers = table.columns.map(col => col.label).join(' | ');
        const separator = table.columns.map(() => '---').join(' | ');
        
        sections.push(`| ${headers} |`);
        sections.push(`| ${separator} |`);

        // Rows (limit to first 20 for readability)
        const displayRows = table.rows.slice(0, 20);
        displayRows.forEach(row => {
          const cells = table.columns.map(col => {
            const value = row[col.key];
            
            // Format based on column type
            switch (col.type) {
              case 'badge':
              case 'code':
                return `\`${value}\``;
              case 'progress':
                return `${value}%`;
              default:
                return String(value || '');
            }
          }).join(' | ');
          
          sections.push(`| ${cells} |`);
        });

        if (table.rows.length > 20) {
          sections.push(`\n*... and ${table.rows.length - 20} more rows*`);
        }
      });
    }
  });

  return sections.join('\n\n');
}