import { Chart } from 'chart.js';
import { ExportOptions } from '@/types/report';

export class ChartExporter {
  static async exportChart(
    chart: Chart,
    options: ExportOptions
  ): Promise<void> {
    const { format, filename = 'chart', includeData = false } = options;

    switch (format) {
      case 'png':
        await this.exportAsPNG(chart, filename);
        break;
      case 'pdf':
        await this.exportAsPDF(chart, filename);
        break;
      case 'csv':
        await this.exportAsCSV(chart, filename, includeData);
        break;
      case 'json':
        await this.exportAsJSON(chart, filename, includeData);
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private static async exportAsPNG(chart: Chart, filename: string): Promise<void> {
    const canvas = chart.canvas;
    const url = canvas.toDataURL('image/png');
    this.downloadFile(url, `${filename}.png`);
  }

  private static async exportAsPDF(chart: Chart, filename: string): Promise<void> {
    // Dynamic import to reduce bundle size
    const { jsPDF } = await import('jspdf');
    
    const canvas = chart.canvas;
    const imgData = canvas.toDataURL('image/png');
    
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [canvas.width, canvas.height]
    });
    
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(`${filename}.pdf`);
  }

  private static async exportAsCSV(
    chart: Chart,
    filename: string,
    includeData: boolean
  ): Promise<void> {
    if (!includeData) {
      throw new Error('CSV export requires includeData to be true');
    }

    const data = chart.data;
    let csvContent = 'Label';

    // Add dataset headers
    data.datasets.forEach(dataset => {
      csvContent += `,${dataset.label || 'Data'}`;
    });
    csvContent += '\n';

    // Add data rows
    data.labels?.forEach((label, index) => {
      csvContent += `${label}`;
      data.datasets.forEach(dataset => {
        const value = Array.isArray(dataset.data[index]) 
          ? (dataset.data[index] as any).y || (dataset.data[index] as any).value
          : dataset.data[index];
        csvContent += `,${value}`;
      });
      csvContent += '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    this.downloadFile(url, `${filename}.csv`);
  }

  private static async exportAsJSON(
    chart: Chart,
    filename: string,
    includeData: boolean
  ): Promise<void> {
    const exportData = {
      type: chart.config.type,
      options: chart.config.options,
      ...(includeData && { data: chart.data })
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    this.downloadFile(url, `${filename}.json`);
  }

  private static downloadFile(url: string, filename: string): void {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up object URL
    if (url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }

  static exportTableData(data: any[], filename: string, format: 'csv' | 'json'): void {
    if (format === 'csv') {
      this.exportTableAsCSV(data, filename);
    } else {
      this.exportTableAsJSON(data, filename);
    }
  }

  private static exportTableAsCSV(data: any[], filename: string): void {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    let csvContent = headers.join(',') + '\n';

    data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header];
        // Escape commas and quotes in CSV
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csvContent += values.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    this.downloadFile(url, `${filename}.csv`);
  }

  private static exportTableAsJSON(data: any[], filename: string): void {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    this.downloadFile(url, `${filename}.json`);
  }
}

export const exportChart = ChartExporter.exportChart.bind(ChartExporter);
export const exportTableData = ChartExporter.exportTableData.bind(ChartExporter);