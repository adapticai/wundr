/**
 * Chart Export - Export charts as images using html2canvas
 */

import html2canvas from 'html2canvas';

import { downloadBlob, measureExportDuration } from './utils';

import type { ChartExportOptions, ImageExportOptions, ExportResult } from './types';

/**
 * Export chart element to image
 */
export async function exportChartToImage(
  element: HTMLElement | string,
  options: ChartExportOptions = {},
): Promise<ExportResult> {
  const startTime = Date.now();

  try {
    const {
      filename = 'chart.png',
      format = 'png',
      quality = 1.0,
      scale = 2,
      backgroundColor = '#ffffff',
      width,
      height,
    } = options;

    // Get the element
    const chartElement =
      typeof element === 'string' ? document.getElementById(element) : element;

    if (!chartElement) {
      throw new Error('Chart element not found');
    }

    // Configure html2canvas options
    const canvasOptions = {
      scale,
      backgroundColor,
      logging: false,
      useCORS: true,
      allowTaint: true,
      width: width || chartElement.offsetWidth,
      height: height || chartElement.offsetHeight,
    };

    // Capture the element as canvas
    const canvas = await html2canvas(chartElement, canvasOptions);

    // Convert canvas to blob
    const blob = await canvasToBlob(canvas, format, quality);
    const size = blob.size;

    // Download the image
    downloadBlob(blob, filename);

    const duration = measureExportDuration(startTime);

    return {
      success: true,
      filename,
      format: format === 'png' ? 'png' : 'jpeg',
      size,
      duration,
    };
  } catch (error) {
    const duration = measureExportDuration(startTime);
    return {
      success: false,
      filename: options.filename || 'chart.png',
      format: options.format === 'png' ? 'png' : 'jpeg',
      size: 0,
      error: error instanceof Error ? error : new Error(String(error)),
      duration,
    };
  }
}

/**
 * Convert canvas to blob
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: 'png' | 'jpeg',
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';

    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      },
      mimeType,
      quality,
    );
  });
}

/**
 * Export chart to data URL
 */
export async function exportChartToDataURL(
  element: HTMLElement | string,
  options: ChartExportOptions = {},
): Promise<string> {
  const {
    format = 'png',
    quality = 1.0,
    scale = 2,
    backgroundColor = '#ffffff',
    width,
    height,
  } = options;

  const chartElement =
    typeof element === 'string' ? document.getElementById(element) : element;

  if (!chartElement) {
    throw new Error('Chart element not found');
  }

  const canvasOptions = {
    scale,
    backgroundColor,
    logging: false,
    useCORS: true,
    allowTaint: true,
    width: width || chartElement.offsetWidth,
    height: height || chartElement.offsetHeight,
  };

  const canvas = await html2canvas(chartElement, canvasOptions);
  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';

  return canvas.toDataURL(mimeType, quality);
}

/**
 * Export multiple charts to images
 */
export async function exportMultipleCharts(
  elements: Array<{ id: string; element: HTMLElement | string; filename?: string }>,
  options: ChartExportOptions = {},
): Promise<ExportResult[]> {
  const results: ExportResult[] = [];

  for (const { id, element, filename } of elements) {
    const chartFilename = filename || `${id}.${options.format || 'png'}`;
    const result = await exportChartToImage(element, {
      ...options,
      filename: chartFilename,
    });
    results.push(result);
  }

  return results;
}

/**
 * Export chart with custom dimensions
 */
export async function exportChartWithDimensions(
  element: HTMLElement | string,
  dimensions: { width: number; height: number },
  options: ChartExportOptions = {},
): Promise<ExportResult> {
  return exportChartToImage(element, {
    ...options,
    width: dimensions.width,
    height: dimensions.height,
  });
}

/**
 * Export any DOM element to image
 */
export async function exportElementToImage(
  element: HTMLElement | string,
  options: ImageExportOptions = {},
): Promise<ExportResult> {
  const startTime = Date.now();

  try {
    const {
      filename = 'export.png',
      format = 'png',
      quality = 1.0,
      scale = 2,
      backgroundColor = 'transparent',
      width,
      height,
    } = options;

    const targetElement =
      typeof element === 'string' ? document.getElementById(element) : element;

    if (!targetElement) {
      throw new Error('Element not found');
    }

    const canvasOptions = {
      scale,
      backgroundColor,
      logging: false,
      useCORS: true,
      allowTaint: true,
      width: width || targetElement.offsetWidth,
      height: height || targetElement.offsetHeight,
    };

    const canvas = await html2canvas(targetElement, canvasOptions);
    const blob = await canvasToBlob(canvas, format, quality);
    const size = blob.size;

    downloadBlob(blob, filename);

    const duration = measureExportDuration(startTime);

    return {
      success: true,
      filename,
      format,
      size,
      duration,
    };
  } catch (error) {
    const duration = measureExportDuration(startTime);
    return {
      success: false,
      filename: options.filename || 'export.png',
      format: options.format || 'png',
      size: 0,
      error: error instanceof Error ? error : new Error(String(error)),
      duration,
    };
  }
}

/**
 * Create composite image from multiple elements
 */
export async function exportCompositeImage(
  elements: Array<{
    element: HTMLElement | string;
    x: number;
    y: number;
    width?: number;
    height?: number;
  }>,
  canvasSize: { width: number; height: number },
  options: ImageExportOptions = {},
): Promise<ExportResult> {
  const startTime = Date.now();

  try {
    const {
      filename = 'composite.png',
      format = 'png',
      quality = 1.0,
      backgroundColor = '#ffffff',
    } = options;

    // Create composite canvas
    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = canvasSize.width;
    compositeCanvas.height = canvasSize.height;
    const ctx = compositeCanvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Fill background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    // Render each element onto the composite canvas
    for (const { element, x, y, width, height } of elements) {
      const targetElement =
        typeof element === 'string' ? document.getElementById(element) : element;

      if (!targetElement) {
continue;
}

      const elementCanvas = await html2canvas(targetElement, {
        logging: false,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
      });

      ctx.drawImage(
        elementCanvas,
        x,
        y,
        width || elementCanvas.width,
        height || elementCanvas.height,
      );
    }

    const blob = await canvasToBlob(compositeCanvas, format, quality);
    const size = blob.size;

    downloadBlob(blob, filename);

    const duration = measureExportDuration(startTime);

    return {
      success: true,
      filename,
      format,
      size,
      duration,
    };
  } catch (error) {
    const duration = measureExportDuration(startTime);
    return {
      success: false,
      filename: options.filename || 'composite.png',
      format: options.format || 'png',
      size: 0,
      error: error instanceof Error ? error : new Error(String(error)),
      duration,
    };
  }
}

/**
 * Get chart preview as base64 string
 */
export async function getChartPreview(
  element: HTMLElement | string,
  maxWidth: number = 300,
): Promise<string> {
  const dataURL = await exportChartToDataURL(element, {
    format: 'png',
    quality: 0.8,
    scale: 1,
    width: maxWidth,
  });

  return dataURL;
}
