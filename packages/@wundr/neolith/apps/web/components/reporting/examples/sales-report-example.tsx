'use client';

/**
 * Sales Report Example
 * Complete example showing how to use the reporting components
 */

import { DollarSign, ShoppingCart, TrendingUp, Users } from 'lucide-react';
import { useState } from 'react';

import {
  AnalyticsReport,
  AreaChart,
  BarChart,
  LineChart,
  PerformanceReport,
  PieChart,
  ReportBuilder,
  type DateRange,
  type ReportFilter,
} from '@/components/reporting';

// Sample data
const salesTimeSeriesData = [
  { date: '2024-01', revenue: 45000, profit: 12000, orders: 234 },
  { date: '2024-02', revenue: 52000, profit: 15000, orders: 267 },
  { date: '2024-03', revenue: 48000, profit: 13500, orders: 245 },
  { date: '2024-04', revenue: 61000, profit: 18000, orders: 312 },
  { date: '2024-05', revenue: 55000, profit: 16500, orders: 289 },
  { date: '2024-06', revenue: 67000, profit: 21000, orders: 356 },
];

const categoryData = [
  { category: 'Electronics', sales: 125000, returns: 5000 },
  { category: 'Clothing', sales: 98000, returns: 8000 },
  { category: 'Home & Garden', sales: 76000, returns: 3000 },
  { category: 'Sports', sales: 54000, returns: 2000 },
];

const pieData = [
  { name: 'Electronics', value: 125000 },
  { name: 'Clothing', value: 98000 },
  { name: 'Home & Garden', value: 76000 },
  { name: 'Sports', value: 54000 },
];

const metrics = [
  {
    title: 'Total Revenue',
    value: '$353,000',
    change: 15.2,
    changeLabel: 'from last period',
    icon: DollarSign,
    trend: 'up' as const,
  },
  {
    title: 'Total Orders',
    value: '1,703',
    change: 8.1,
    changeLabel: 'from last period',
    icon: ShoppingCart,
    trend: 'up' as const,
  },
  {
    title: 'Avg Order Value',
    value: '$207',
    change: 6.5,
    changeLabel: 'from last period',
    icon: TrendingUp,
    trend: 'up' as const,
  },
  {
    title: 'Active Customers',
    value: '8,234',
    change: 12.3,
    changeLabel: 'from last period',
    icon: Users,
    trend: 'up' as const,
  },
];

export function SalesReportExample() {
  const [dateRange, setDateRange] = useState<DateRange>();
  const [filterValues, setFilterValues] = useState({});

  const filters: ReportFilter[] = [
    {
      id: 'region',
      label: 'Region',
      type: 'select',
      options: [
        { label: 'All Regions', value: 'all' },
        { label: 'North America', value: 'na' },
        { label: 'Europe', value: 'eu' },
        { label: 'Asia Pacific', value: 'apac' },
      ],
    },
    {
      id: 'category',
      label: 'Category',
      type: 'select',
      options: [
        { label: 'All Categories', value: 'all' },
        { label: 'Electronics', value: 'electronics' },
        { label: 'Clothing', value: 'clothing' },
        { label: 'Home & Garden', value: 'home' },
        { label: 'Sports', value: 'sports' },
      ],
    },
    {
      id: 'minAmount',
      label: 'Minimum Amount',
      type: 'number',
    },
  ];

  return (
    <div className="space-y-12">
      {/* Example 1: Full Report with Builder */}
      <ReportBuilder
        title="Monthly Sales Report"
        description="Comprehensive sales analysis for the selected period"
        filters={filters}
        onFilterChange={setFilterValues}
        onDateRangeChange={setDateRange}
        showDateRange
        showFilters
        showExport
      >
        <div className="grid gap-6">
          <LineChart
            title="Revenue & Profit Trends"
            description="Monthly revenue and profit over time"
            data={salesTimeSeriesData}
            dataKeys={['revenue', 'profit']}
            xAxisKey="date"
            height={400}
            curved
          />

          <div className="grid md:grid-cols-2 gap-6">
            <BarChart
              title="Sales by Category"
              description="Category-wise sales and returns"
              data={categoryData}
              dataKeys={['sales', 'returns']}
              xAxisKey="category"
              height={350}
            />

            <PieChart
              title="Revenue Distribution"
              description="Revenue breakdown by category"
              data={pieData}
              height={350}
              donut
              innerRadius={60}
            />
          </div>

          <AreaChart
            title="Order Volume"
            description="Number of orders over time"
            data={salesTimeSeriesData}
            dataKeys={['orders']}
            xAxisKey="date"
            height={300}
            gradient
          />
        </div>
      </ReportBuilder>

      {/* Example 2: Performance Report Template */}
      <PerformanceReport
        dateRange={dateRange}
        metrics={metrics}
        timeSeriesData={salesTimeSeriesData}
        categoryData={categoryData}
      />

      {/* Example 3: Analytics Report Template */}
      <AnalyticsReport
        title="Customer Analytics"
        dateRange={dateRange}
        overviewData={{
          totalUsers: 10234,
          activeUsers: 7832,
          totalSessions: 28456,
          avgSessionDuration: '5m 42s',
        }}
        timeSeriesData={salesTimeSeriesData}
        categoryData={pieData}
        comparisonData={categoryData}
      />

      {/* Example 4: Individual Charts */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Individual Chart Examples</h2>

        <div className="grid gap-6 md:grid-cols-2">
          <LineChart
            title="Simple Line Chart"
            data={salesTimeSeriesData}
            dataKeys={['revenue']}
            xAxisKey="date"
            height={300}
          />

          <BarChart
            title="Horizontal Bar Chart"
            data={categoryData}
            dataKeys={['sales']}
            xAxisKey="category"
            height={300}
            horizontal
          />

          <AreaChart
            title="Stacked Area Chart"
            data={salesTimeSeriesData}
            dataKeys={['revenue', 'profit']}
            xAxisKey="date"
            height={300}
            stacked
          />

          <PieChart
            title="Simple Pie Chart"
            data={pieData}
            height={300}
            showLabels
          />
        </div>
      </div>
    </div>
  );
}
