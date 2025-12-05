'use client';

/**
 * Report Builder Component
 * Main component for building and exporting reports
 */

import { Download, FileText, Loader2 } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import { convertChartDataToCSV, exportToCSV } from './export/csv-export';
import { exportElementToPDF, exportToPDF } from './export/pdf-export';
import { DateRangePicker } from './filters/date-range-picker';
import { ReportFilters } from './filters/report-filters';

import type { DateRange, Report, ReportFilter } from './types';

interface ReportBuilderProps {
  report?: Report;
  filters?: ReportFilter[];
  onFilterChange?: (values: Record<string, unknown>) => void;
  onDateRangeChange?: (range: DateRange | undefined) => void;
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
  showDateRange?: boolean;
  showFilters?: boolean;
  showExport?: boolean;
}

export function ReportBuilder({
  report,
  filters = [],
  onFilterChange,
  onDateRangeChange,
  children,
  className,
  title = 'Report',
  description,
  showDateRange = true,
  showFilters = true,
  showExport = true,
}: ReportBuilderProps) {
  const [filterValues, setFilterValues] = React.useState<
    Record<string, unknown>
  >({});
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [isExporting, setIsExporting] = React.useState(false);
  const reportRef = React.useRef<HTMLDivElement>(null);

  const handleFilterChange = (values: Record<string, unknown>) => {
    setFilterValues(values);
    onFilterChange?.(values);
  };

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    onDateRangeChange?.(range);
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      if (report) {
        await exportToPDF(report, {
          format: 'pdf',
          filename: `${title.toLowerCase().replace(/\s+/g, '-')}.pdf`,
        });
      } else if (reportRef.current) {
        await exportElementToPDF(
          reportRef.current.id || 'report-content',
          `${title.toLowerCase().replace(/\s+/g, '-')}.pdf`
        );
      }
    } catch (error) {
      console.error('PDF export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCSV = () => {
    setIsExporting(true);
    try {
      if (report) {
        exportToCSV(report, `${title.toLowerCase().replace(/\s+/g, '-')}.csv`);
      }
    } catch (error) {
      console.error('CSV export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with title and export */}
      <div className='flex items-start justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>{title}</h1>
          {description && (
            <p className='text-muted-foreground mt-1'>{description}</p>
          )}
        </div>

        {showExport && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={isExporting}>
                {isExporting ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : (
                  <Download className='h-4 w-4' />
                )}
                <span className='ml-2'>Export</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem onClick={handleExportPDF}>
                <FileText className='h-4 w-4 mr-2' />
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCSV}>
                <FileText className='h-4 w-4 mr-2' />
                Export as CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Date Range Picker */}
      {showDateRange && (
        <div className='flex items-center gap-4'>
          <span className='text-sm font-medium'>Date Range:</span>
          <DateRangePicker
            value={dateRange}
            onChange={handleDateRangeChange}
            className='w-[300px]'
          />
        </div>
      )}

      {/* Filters */}
      {showFilters && filters.length > 0 && (
        <ReportFilters
          filters={filters}
          values={filterValues}
          onChange={handleFilterChange}
        />
      )}

      <Separator />

      {/* Report Content */}
      <div ref={reportRef} id='report-content'>
        {children}
      </div>
    </div>
  );
}
