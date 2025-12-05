'use client';

/**
 * Advanced Report Builder Page
 * Drag-and-drop report builder with scheduling and data source selection
 */

import { ReportBuilderCanvas } from './components/report-builder-canvas';

export default function ReportBuilderPage() {
  return (
    <div className="h-full flex flex-col">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-4">
          <h1 className="text-lg font-semibold">Report Builder</h1>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <ReportBuilderCanvas />
      </div>
    </div>
  );
}
