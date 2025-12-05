'use client';

import {
  BarChart3,
  Calendar as CalendarIcon,
  Download,
  Filter,
  LineChart,
  PieChart,
  TrendingUp,
  Users,
  Activity,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { addDays, format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

import type { DateRange } from 'react-day-picker';

interface AnalyticsLayoutProps {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}

const analyticsViews = [
  {
    value: 'overview',
    label: 'Overview',
    icon: BarChart3,
    href: 'overview',
  },
  {
    value: 'performance',
    label: 'Performance',
    icon: TrendingUp,
    href: 'performance',
  },
  {
    value: 'users',
    label: 'Users',
    icon: Users,
    href: 'users',
  },
  {
    value: 'engagement',
    label: 'Engagement',
    icon: Activity,
    href: 'engagement',
  },
  {
    value: 'trends',
    label: 'Trends',
    icon: LineChart,
    href: 'trends',
  },
  {
    value: 'distribution',
    label: 'Distribution',
    icon: PieChart,
    href: 'distribution',
  },
];

const quickFilters = [
  { id: 'all', label: 'All Data', description: 'View all analytics data' },
  {
    id: 'active-users',
    label: 'Active Users',
    description: 'Users active in selected period',
  },
  {
    id: 'new-users',
    label: 'New Users',
    description: 'Users who joined in selected period',
  },
  {
    id: 'high-engagement',
    label: 'High Engagement',
    description: 'Content with above-average engagement',
  },
  {
    id: 'top-performing',
    label: 'Top Performing',
    description: 'Top 10% by metrics',
  },
  {
    id: 'needs-attention',
    label: 'Needs Attention',
    description: 'Items with declining metrics',
  },
];

const timeRangePresets = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
];

const exportFormats = [
  { value: 'csv', label: 'CSV' },
  { value: 'xlsx', label: 'Excel (XLSX)' },
  { value: 'json', label: 'JSON' },
  { value: 'pdf', label: 'PDF Report' },
];

/**
 * Analytics Dashboard Layout
 *
 * Features:
 * - Tab navigation for different analytics views
 * - Sidebar with quick filters (responsive - sheet on mobile)
 * - Date range selector in header
 * - Export functionality with multiple formats
 * - Fully responsive design
 * - Uses shadcn/ui components throughout
 */
export default function AnalyticsLayout({
  children,
  params,
}: AnalyticsLayoutProps) {
  const pathname = usePathname();
  const [workspaceSlug, setWorkspaceSlug] = React.useState<string>('');

  React.useEffect(() => {
    params.then(p => setWorkspaceSlug(p.workspaceSlug));
  }, [params]);

  const [selectedFilter, setSelectedFilter] = React.useState('all');
  const [timeRange, setTimeRange] = React.useState('30d');
  const [exportFormat, setExportFormat] = React.useState('csv');
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });

  // Determine active tab from pathname
  const activeView = React.useMemo(() => {
    const pathSegments = pathname.split('/');
    const lastSegment = pathSegments[pathSegments.length - 1];
    return (
      analyticsViews.find(view => lastSegment.includes(view.href))?.value ||
      'overview'
    );
  }, [pathname]);

  const handleExport = React.useCallback(() => {
    // Implementation would export data in selected format
    console.log('Exporting as:', exportFormat);
    // In a real implementation, this would:
    // 1. Gather current view data
    // 2. Format according to selected export type
    // 3. Trigger download
  }, [exportFormat]);

  const handleTimeRangeChange = React.useCallback((value: string) => {
    setTimeRange(value);

    // Update date range based on preset
    const today = new Date();
    switch (value) {
      case 'today':
        setDate({ from: today, to: today });
        break;
      case '7d':
        setDate({ from: addDays(today, -7), to: today });
        break;
      case '30d':
        setDate({ from: addDays(today, -30), to: today });
        break;
      case '90d':
        setDate({ from: addDays(today, -90), to: today });
        break;
      case 'quarter':
        const quarterStart = new Date(
          today.getFullYear(),
          Math.floor(today.getMonth() / 3) * 3,
          1
        );
        setDate({ from: quarterStart, to: today });
        break;
      case 'year':
        const yearStart = new Date(today.getFullYear(), 0, 1);
        setDate({ from: yearStart, to: today });
        break;
      default:
        // Custom range - keep current dates
        break;
    }
  }, []);

  // Sidebar content component (used in both desktop and mobile views)
  const FilterSidebar = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Quick Filters</h3>
        <p className="text-xs text-muted-foreground">
          Filter data by common patterns
        </p>
      </div>

      <Separator />

      <ScrollArea className="h-[calc(100vh-20rem)] md:h-[calc(100vh-16rem)]">
        <div className="space-y-1">
          {quickFilters.map(filter => (
            <button
              key={filter.id}
              onClick={() => setSelectedFilter(filter.id)}
              className={cn(
                'w-full flex flex-col items-start gap-1 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                selectedFilter === filter.id
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground'
              )}
            >
              <span className="font-medium">{filter.label}</span>
              <span className="text-xs opacity-80">{filter.description}</span>
            </button>
          ))}
        </div>
      </ScrollArea>

      <Separator />

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">
          Additional Filters
        </h4>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Metric Type</label>
          <Select defaultValue="all">
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select metric" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Metrics</SelectItem>
              <SelectItem value="engagement">Engagement</SelectItem>
              <SelectItem value="conversion">Conversion</SelectItem>
              <SelectItem value="retention">Retention</SelectItem>
              <SelectItem value="growth">Growth</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Data Granularity</label>
          <Select defaultValue="daily">
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select granularity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hourly">Hourly</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Comparison</label>
          <Select defaultValue="none">
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Compare with" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Comparison</SelectItem>
              <SelectItem value="previous">Previous Period</SelectItem>
              <SelectItem value="year-ago">Year Ago</SelectItem>
              <SelectItem value="custom">Custom Period</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center gap-4 px-4 md:px-8">
          {/* Mobile Filter Drawer */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="md:hidden"
              >
                <Filter className="h-4 w-4" />
                <span className="sr-only">Toggle filters</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] sm:w-[400px]">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
                <SheetDescription>
                  Apply filters to refine your analytics data
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6">
                <FilterSidebar />
              </div>
            </SheetContent>
          </Sheet>

          {/* Title */}
          <div className="flex flex-1 items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold md:text-xl">Analytics</h1>
          </div>

          {/* Date Range Selector */}
          <div className="hidden items-center gap-2 sm:flex">
            <Select value={timeRange} onValueChange={handleTimeRangeChange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                {timeRangePresets.map(preset => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-[240px] justify-start text-left font-normal',
                    !date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date?.from ? (
                    date.to ? (
                      <>
                        {format(date.from, 'LLL dd, y')} -{' '}
                        {format(date.to, 'LLL dd, y')}
                      </>
                    ) : (
                      format(date.from, 'LLL dd, y')
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  defaultMonth={date?.from}
                  selected={date}
                  onSelect={setDate}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Export Button */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="default" size="default" className="gap-2">
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="end">
              <div className="space-y-3">
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold">Export Data</h4>
                  <p className="text-xs text-muted-foreground">
                    Choose format and download
                  </p>
                </div>
                <Separator />
                <Select value={exportFormat} onValueChange={setExportFormat}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    {exportFormats.map(format => (
                      <SelectItem key={format.value} value={format.value}>
                        {format.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleExport} className="w-full">
                  Download
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Tab Navigation */}
        <div className="container px-4 md:px-8">
          <Tabs value={activeView} className="w-full">
            <ScrollArea className="w-full">
              <TabsList className="inline-flex h-12 w-full justify-start gap-1 bg-transparent p-0">
                {analyticsViews.map(view => {
                  const Icon = view.icon;
                  const href = `/${workspaceSlug}/analytics/${view.href}`;
                  const isActive = activeView === view.value;

                  return (
                    <Link key={view.value} href={href} passHref>
                      <TabsTrigger
                        value={view.value}
                        className={cn(
                          'inline-flex items-center gap-2 border-b-2 border-transparent px-4 py-2.5 text-sm font-medium transition-colors',
                          'hover:border-border hover:text-foreground',
                          'data-[state=active]:border-primary data-[state=active]:text-foreground',
                          'data-[state=active]:shadow-none',
                          !isActive && 'text-muted-foreground'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="hidden sm:inline">{view.label}</span>
                      </TabsTrigger>
                    </Link>
                  );
                })}
              </TabsList>
            </ScrollArea>
          </Tabs>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="container flex flex-1 gap-6 px-4 py-6 md:px-8">
        {/* Desktop Sidebar */}
        <aside className="hidden w-64 shrink-0 md:block">
          <Card className="sticky top-24">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Filters</CardTitle>
              <CardDescription className="text-xs">
                Refine your analytics view
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-4">
              <FilterSidebar />
            </CardContent>
          </Card>
        </aside>

        {/* Main Content */}
        <main className="flex-1 space-y-6">
          {/* Mobile Date Range Selector */}
          <Card className="sm:hidden">
            <CardContent className="space-y-3 p-4">
              <Select value={timeRange} onValueChange={handleTimeRangeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Time range" />
                </SelectTrigger>
                <SelectContent>
                  {timeRangePresets.map(preset => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !date && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date?.from ? (
                      date.to ? (
                        <>
                          {format(date.from, 'LLL dd, y')} -{' '}
                          {format(date.to, 'LLL dd, y')}
                        </>
                      ) : (
                        format(date.from, 'LLL dd, y')
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    defaultMonth={date?.from}
                    selected={date}
                    onSelect={setDate}
                    numberOfMonths={1}
                  />
                </PopoverContent>
              </Popover>
            </CardContent>
          </Card>

          {/* Page Content */}
          {children}
        </main>
      </div>
    </div>
  );
}
