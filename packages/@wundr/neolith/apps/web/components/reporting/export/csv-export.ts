/**
 * CSV Export Utility
 * Generate CSV files from report data
 */

import type { Report, TableData } from '../types';

export function exportToCSV(
  data: TableData | Report,
  filename: string = 'report.csv'
): void {
  let csvContent = '';

  if ('columns' in data && 'rows' in data) {
    // Direct table data
    csvContent = generateCSVFromTable(data);
  } else if ('sections' in data) {
    // Full report - extract table sections
    const report = data as Report;
    const tableSections = report.sections.filter(s => s.type === 'table');

    if (tableSections.length === 0) {
      throw new Error('No table data found in report');
    }

    // If multiple tables, combine them with section headers
    csvContent = tableSections
      .map(section => {
        const sectionHeader = `\n"${section.title}"\n`;
        const tableContent = generateCSVFromTable(section.content as TableData);
        return sectionHeader + tableContent;
      })
      .join('\n\n');
  }

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function generateCSVFromTable(tableData: TableData): string {
  // Generate header row
  const headers = tableData.columns.map(col => escapeCSVValue(col.header));
  let csv = headers.join(',') + '\n';

  // Generate data rows
  tableData.rows.forEach(row => {
    const values = tableData.columns.map(col => {
      const value = row[col.accessorKey];
      return escapeCSVValue(String(value ?? ''));
    });
    csv += values.join(',') + '\n';
  });

  return csv;
}

function escapeCSVValue(value: string): string {
  // Escape quotes and wrap in quotes if necessary
  if (
    value.includes(',') ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r')
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function convertChartDataToCSV(
  data: Array<Record<string, string | number>>,
  filename: string = 'chart-data.csv'
): void {
  if (data.length === 0) {
    throw new Error('No data to export');
  }

  // Extract headers from first data item
  const headers = Object.keys(data[0]);
  let csv = headers.map(escapeCSVValue).join(',') + '\n';

  // Add data rows
  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header];
      return escapeCSVValue(String(value ?? ''));
    });
    csv += values.join(',') + '\n';
  });

  // Download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportMultipleCSVs(
  datasets: Array<{
    name: string;
    data: TableData | Array<Record<string, string | number>>;
  }>,
  zipFilename: string = 'reports.zip'
): void {
  // This would require a zip library like JSZip
  // For now, export each as separate file
  datasets.forEach(({ name, data }) => {
    if (Array.isArray(data)) {
      convertChartDataToCSV(data, `${name}.csv`);
    } else {
      exportToCSV(data, `${name}.csv`);
    }
  });
}
