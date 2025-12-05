/**
 * Report Templates - Pre-configured report templates for common use cases
 */

import type { ReportTemplate, ReportSection, PDFExportOptions } from './types';

/**
 * Create a basic table report template
 */
export function createTableReportTemplate(
  name: string,
  options: {
    title?: string;
    description?: string;
    includeTimestamp?: boolean;
    includeSummary?: boolean;
  } = {},
): ReportTemplate {
  const { title = name, description, includeTimestamp = true, includeSummary = false } = options;

  const sections: ReportSection[] = [];
  let order = 0;

  // Title section
  sections.push({
    id: 'title',
    type: 'text',
    title,
    content: description || '',
    order: order++,
  });

  // Timestamp
  if (includeTimestamp) {
    sections.push({
      id: 'timestamp',
      type: 'text',
      content: `Generated: ${new Date().toLocaleString()}`,
      order: order++,
    });
  }

  // Divider
  sections.push({
    id: 'divider',
    type: 'divider',
    order: order++,
  });

  // Summary section
  if (includeSummary) {
    sections.push({
      id: 'summary',
      type: 'text',
      title: 'Summary',
      content: 'Summary content will be populated dynamically',
      order: order++,
    });
  }

  // Data table
  sections.push({
    id: 'data',
    type: 'table',
    title: 'Data',
    order: order++,
  });

  return {
    id: generateTemplateId(name),
    name,
    description,
    format: 'pdf',
    sections,
    options: {
      includeHeaders: true,
    } as PDFExportOptions,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Create a dashboard report template with charts
 */
export function createDashboardReportTemplate(
  name: string,
  chartIds: string[],
  options: {
    title?: string;
    description?: string;
    includeDataTables?: boolean;
  } = {},
): ReportTemplate {
  const { title = name, description, includeDataTables = false } = options;

  const sections: ReportSection[] = [];
  let order = 0;

  // Title
  sections.push({
    id: 'title',
    type: 'text',
    title,
    content: description || '',
    order: order++,
  });

  // Timestamp
  sections.push({
    id: 'timestamp',
    type: 'text',
    content: `Generated: ${new Date().toLocaleString()}`,
    order: order++,
  });

  sections.push({
    id: 'divider',
    type: 'divider',
    order: order++,
  });

  // Add chart sections
  for (const chartId of chartIds) {
    sections.push({
      id: `chart-${chartId}`,
      type: 'chart',
      title: `Chart: ${chartId}`,
      order: order++,
      options: { chartId },
    });
  }

  // Add data tables if requested
  if (includeDataTables) {
    sections.push({
      id: 'page-break',
      type: 'pageBreak',
      order: order++,
    });

    sections.push({
      id: 'data-section',
      type: 'text',
      title: 'Supporting Data',
      order: order++,
    });

    sections.push({
      id: 'data',
      type: 'table',
      order: order++,
    });
  }

  return {
    id: generateTemplateId(name),
    name,
    description,
    format: 'pdf',
    sections,
    options: {
      orientation: 'landscape',
    } as PDFExportOptions,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Create a financial report template
 */
export function createFinancialReportTemplate(
  name: string,
  options: {
    title?: string;
    period?: string;
    includeCharts?: boolean;
  } = {},
): ReportTemplate {
  const { title = 'Financial Report', period, includeCharts = true } = options;

  const sections: ReportSection[] = [];
  let order = 0;

  // Header
  sections.push({
    id: 'header',
    type: 'text',
    title,
    content: period ? `Period: ${period}` : '',
    order: order++,
  });

  sections.push({
    id: 'timestamp',
    type: 'text',
    content: `Generated: ${new Date().toLocaleString()}`,
    order: order++,
  });

  sections.push({
    id: 'divider',
    type: 'divider',
    order: order++,
  });

  // Executive Summary
  sections.push({
    id: 'executive-summary',
    type: 'text',
    title: 'Executive Summary',
    content: 'Key financial highlights and insights',
    order: order++,
  });

  // Charts
  if (includeCharts) {
    sections.push({
      id: 'revenue-chart',
      type: 'chart',
      title: 'Revenue Overview',
      order: order++,
      options: { chartId: 'revenue' },
    });

    sections.push({
      id: 'expense-chart',
      type: 'chart',
      title: 'Expense Breakdown',
      order: order++,
      options: { chartId: 'expenses' },
    });
  }

  // Page break
  sections.push({
    id: 'page-break',
    type: 'pageBreak',
    order: order++,
  });

  // Detailed Data
  sections.push({
    id: 'detailed-data',
    type: 'text',
    title: 'Detailed Financial Data',
    order: order++,
  });

  sections.push({
    id: 'transactions',
    type: 'table',
    title: 'Transactions',
    order: order++,
  });

  return {
    id: generateTemplateId(name),
    name,
    description: 'Financial report with charts and detailed transaction data',
    format: 'pdf',
    sections,
    options: {
      orientation: 'portrait',
      includePageNumbers: true,
    } as PDFExportOptions,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Create a custom report template
 */
export function createCustomReportTemplate(
  name: string,
  sections: Omit<ReportSection, 'id' | 'order'>[],
  options: PDFExportOptions = {},
): ReportTemplate {
  const orderedSections: ReportSection[] = sections.map((section, index) => ({
    ...section,
    id: section.type + '-' + index,
    order: index,
  }));

  return {
    id: generateTemplateId(name),
    name,
    format: 'pdf',
    sections: orderedSections,
    options,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Get pre-defined templates
 */
export function getTemplateLibrary(): Record<string, ReportTemplate> {
  return {
    basic: createTableReportTemplate('Basic Report', {
      title: 'Data Export Report',
      includeTimestamp: true,
      includeSummary: true,
    }),
    dashboard: createDashboardReportTemplate(
      'Dashboard Report',
      ['chart1', 'chart2', 'chart3'],
      {
        title: 'Dashboard Overview',
        includeDataTables: true,
      },
    ),
    financial: createFinancialReportTemplate('Financial Report', {
      includeCharts: true,
    }),
    executive: createCustomReportTemplate(
      'Executive Summary',
      [
        {
          type: 'text',
          title: 'Executive Summary Report',
          content: 'High-level overview and key metrics',
        },
        { type: 'divider' },
        {
          type: 'text',
          title: 'Key Metrics',
          content: 'Critical performance indicators and trends',
        },
        { type: 'chart', title: 'Performance Overview' },
        { type: 'pageBreak' },
        {
          type: 'text',
          title: 'Recommendations',
          content: 'Strategic recommendations based on data analysis',
        },
        { type: 'table', title: 'Supporting Data' },
      ],
      {
        orientation: 'landscape',
        includePageNumbers: true,
      },
    ),
  };
}

/**
 * Save custom template
 */
export function saveTemplate(template: ReportTemplate): void {
  try {
    const templates = loadTemplates();
    templates[template.id] = {
      ...template,
      updatedAt: new Date(),
    };
    localStorage.setItem('exportTemplates', JSON.stringify(templates));
  } catch (error) {
    console.error('Failed to save template:', error);
  }
}

/**
 * Load custom templates
 */
export function loadTemplates(): Record<string, ReportTemplate> {
  try {
    const stored = localStorage.getItem('exportTemplates');
    if (!stored) {
      return {};
    }
    const templates = JSON.parse(stored);

    // Convert date strings back to Date objects
    Object.values(templates).forEach((template: any) => {
      template.createdAt = new Date(template.createdAt);
      template.updatedAt = new Date(template.updatedAt);
    });

    return templates;
  } catch (error) {
    console.error('Failed to load templates:', error);
    return {};
  }
}

/**
 * Delete template
 */
export function deleteTemplate(templateId: string): void {
  try {
    const templates = loadTemplates();
    delete templates[templateId];
    localStorage.setItem('exportTemplates', JSON.stringify(templates));
  } catch (error) {
    console.error('Failed to delete template:', error);
  }
}

/**
 * Get template by ID
 */
export function getTemplate(templateId: string): ReportTemplate | null {
  const library = getTemplateLibrary();
  const customTemplates = loadTemplates();

  return library[templateId] || customTemplates[templateId] || null;
}

/**
 * List all available templates
 */
export function listTemplates(): ReportTemplate[] {
  const library = getTemplateLibrary();
  const customTemplates = loadTemplates();

  return [
    ...Object.values(library),
    ...Object.values(customTemplates),
  ];
}

/**
 * Generate template ID
 */
function generateTemplateId(name: string): string {
  return `template_${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
}

/**
 * Clone template
 */
export function cloneTemplate(
  templateId: string,
  newName: string,
): ReportTemplate | null {
  const template = getTemplate(templateId);

  if (!template) {
    return null;
  }

  return {
    ...template,
    id: generateTemplateId(newName),
    name: newName,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Update template
 */
export function updateTemplate(
  templateId: string,
  updates: Partial<Omit<ReportTemplate, 'id' | 'createdAt'>>,
): void {
  const templates = loadTemplates();
  const template = templates[templateId];

  if (!template) {
    throw new Error(`Template ${templateId} not found`);
  }

  templates[templateId] = {
    ...template,
    ...updates,
    updatedAt: new Date(),
  };

  localStorage.setItem('exportTemplates', JSON.stringify(templates));
}
