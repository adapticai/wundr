'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Calendar,
  Download,
  Plus,
  Search,
  Filter,
  FileText,
  BarChart3,
  TrendingUp,
  Users,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Types
interface Report {
  id: string;
  title: string;
  description: string;
  type: 'performance' | 'analytics' | 'engagement' | 'revenue' | 'custom';
  createdAt: Date;
  updatedAt: Date;
  createdBy: {
    id: string;
    name: string;
    avatar?: string;
  };
  status: 'draft' | 'published' | 'scheduled';
  scheduledFor?: Date;
  sections: number;
  lastViewed?: Date;
}

interface ReportTemplate {
  id: string;
  title: string;
  description: string;
  type: 'performance' | 'analytics' | 'engagement' | 'revenue' | 'custom';
  icon: React.ElementType;
  sectionsCount: number;
}

// No mock data - reports are loaded from the API
const mockReports: Report[] = [];

const reportTemplates: ReportTemplate[] = [
  {
    id: 'template-1',
    title: 'Performance Dashboard',
    description: 'Track key performance metrics and KPIs',
    type: 'performance',
    icon: TrendingUp,
    sectionsCount: 6,
  },
  {
    id: 'template-2',
    title: 'Analytics Overview',
    description: 'Comprehensive analytics and insights',
    type: 'analytics',
    icon: BarChart3,
    sectionsCount: 5,
  },
  {
    id: 'template-3',
    title: 'User Engagement',
    description: 'User activity and engagement metrics',
    type: 'engagement',
    icon: Users,
    sectionsCount: 4,
  },
  {
    id: 'template-4',
    title: 'Revenue Report',
    description: 'Financial performance and revenue tracking',
    type: 'revenue',
    icon: TrendingUp,
    sectionsCount: 7,
  },
  {
    id: 'template-5',
    title: 'Custom Report',
    description: 'Build your own custom report',
    type: 'custom',
    icon: FileText,
    sectionsCount: 0,
  },
];

export default function ReportsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceSlug = params.workspaceSlug as string;

  // State
  const [reports, setReports] = useState<Report[]>(mockReports);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [creatorFilter, setCreatorFilter] = useState<string>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  // Filter and search logic
  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      const matchesSearch =
        report.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = typeFilter === 'all' || report.type === typeFilter;

      const matchesStatus =
        statusFilter === 'all' || report.status === statusFilter;

      const matchesCreator =
        creatorFilter === 'all' || report.createdBy.id === creatorFilter;

      return matchesSearch && matchesType && matchesStatus && matchesCreator;
    });
  }, [reports, searchQuery, typeFilter, statusFilter, creatorFilter]);

  // Get unique creators for filter
  const creators = useMemo(() => {
    const uniqueCreators = Array.from(
      new Map(reports.map(r => [r.createdBy.id, r.createdBy])).values()
    );
    return uniqueCreators;
  }, [reports]);

  // Handlers
  const handleViewReport = (reportId: string) => {
    router.push(`/${workspaceSlug}/reports/${reportId}`);
  };

  const handleEditReport = (reportId: string) => {
    router.push(`/${workspaceSlug}/reports/${reportId}/edit`);
  };

  const handleDeleteReport = (report: Report) => {
    setSelectedReport(report);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedReport) {
      setReports(reports.filter(r => r.id !== selectedReport.id));
      setDeleteDialogOpen(false);
      setSelectedReport(null);
    }
  };

  const handleScheduleReport = (reportId: string) => {
    router.push(`/${workspaceSlug}/reports/${reportId}/schedule`);
  };

  const handleExportReport = (reportId: string) => {
    router.push(`/${workspaceSlug}/reports/${reportId}/export`);
  };

  const handleCreateFromTemplate = (templateId: string) => {
    router.push(`/${workspaceSlug}/reports/new?template=${templateId}`);
  };

  const handleCreateNew = () => {
    router.push(`/${workspaceSlug}/reports/new`);
  };

  const getStatusBadge = (status: Report['status']) => {
    const variants = {
      draft: 'secondary',
      published: 'default',
      scheduled: 'outline',
    } as const;

    return (
      <Badge variant={variants[status]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getTypeBadge = (type: Report['type']) => {
    const colors = {
      performance: 'bg-blue-100 text-blue-800',
      analytics: 'bg-purple-100 text-purple-800',
      engagement: 'bg-green-100 text-green-800',
      revenue: 'bg-yellow-100 text-yellow-800',
      custom: 'bg-gray-100 text-gray-800',
    };

    return (
      <span
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colors[type]}`}
      >
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </span>
    );
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return formatDate(date);
  };

  return (
    <div className='flex flex-col gap-6 p-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Reports</h1>
          <p className='text-muted-foreground'>
            Manage and create custom reports for your workspace
          </p>
        </div>
        <Button onClick={handleCreateNew} size='lg'>
          <Plus className='mr-2 h-4 w-4' />
          Create Report
        </Button>
      </div>

      {/* Report Templates Gallery */}
      <Card>
        <CardHeader>
          <CardTitle>Report Templates</CardTitle>
          <CardDescription>
            Start with a pre-built template or create a custom report
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5'>
            {reportTemplates.map(template => {
              const Icon = template.icon;
              return (
                <button
                  key={template.id}
                  onClick={() => handleCreateFromTemplate(template.id)}
                  className='flex flex-col items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-accent'
                >
                  <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10'>
                    <Icon className='h-5 w-5 text-primary' />
                  </div>
                  <div className='flex-1'>
                    <h4 className='font-semibold text-sm'>{template.title}</h4>
                    <p className='text-xs text-muted-foreground mt-1'>
                      {template.description}
                    </p>
                    <p className='text-xs text-muted-foreground mt-2'>
                      {template.sectionsCount > 0
                        ? `${template.sectionsCount} sections`
                        : 'Customizable'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filters and Search */}
      <Card>
        <CardContent className='pt-6'>
          <div className='flex flex-col gap-4 md:flex-row md:items-center'>
            <div className='relative flex-1'>
              <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                placeholder='Search reports...'
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className='pl-9'
              />
            </div>

            <div className='flex gap-2'>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className='w-[150px]'>
                  <SelectValue placeholder='Type' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Types</SelectItem>
                  <SelectItem value='performance'>Performance</SelectItem>
                  <SelectItem value='analytics'>Analytics</SelectItem>
                  <SelectItem value='engagement'>Engagement</SelectItem>
                  <SelectItem value='revenue'>Revenue</SelectItem>
                  <SelectItem value='custom'>Custom</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className='w-[150px]'>
                  <SelectValue placeholder='Status' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Status</SelectItem>
                  <SelectItem value='draft'>Draft</SelectItem>
                  <SelectItem value='published'>Published</SelectItem>
                  <SelectItem value='scheduled'>Scheduled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={creatorFilter} onValueChange={setCreatorFilter}>
                <SelectTrigger className='w-[150px]'>
                  <SelectValue placeholder='Creator' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Creators</SelectItem>
                  {creators.map(creator => (
                    <SelectItem key={creator.id} value={creator.id}>
                      {creator.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reports List */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle>Saved Reports</CardTitle>
              <CardDescription>
                {filteredReports.length} report
                {filteredReports.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Report</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Creator</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className='text-right'>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className='text-center py-8'>
                    <div className='flex flex-col items-center gap-2'>
                      <FileText className='h-8 w-8 text-muted-foreground' />
                      <p className='font-medium text-foreground'>
                        {searchQuery ||
                        typeFilter !== 'all' ||
                        statusFilter !== 'all' ||
                        creatorFilter !== 'all'
                          ? 'No reports match your filters'
                          : 'No reports yet'}
                      </p>
                      <p className='text-sm text-muted-foreground'>
                        {searchQuery ||
                        typeFilter !== 'all' ||
                        statusFilter !== 'all' ||
                        creatorFilter !== 'all'
                          ? 'Try adjusting your search or filters to find what you are looking for.'
                          : 'Create your first report using a template above or start from scratch.'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredReports.map(report => (
                  <TableRow key={report.id} className='group'>
                    <TableCell>
                      <div className='flex flex-col gap-1'>
                        <button
                          onClick={() => handleViewReport(report.id)}
                          className='font-medium text-left hover:underline'
                        >
                          {report.title}
                        </button>
                        <p className='text-sm text-muted-foreground'>
                          {report.description}
                        </p>
                        <div className='flex items-center gap-2 text-xs text-muted-foreground mt-1'>
                          <span>{report.sections} sections</span>
                          {report.lastViewed && (
                            <>
                              <span>•</span>
                              <Clock className='h-3 w-3' />
                              <span>
                                Viewed {formatRelativeTime(report.lastViewed)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getTypeBadge(report.type)}</TableCell>
                    <TableCell>
                      <div className='flex flex-col gap-1'>
                        {getStatusBadge(report.status)}
                        {report.scheduledFor && (
                          <span className='text-xs text-muted-foreground'>
                            {formatDate(report.scheduledFor)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className='flex items-center gap-2'>
                        <div className='flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium'>
                          {report.createdBy.name
                            .split(' ')
                            .map(n => n[0])
                            .join('')}
                        </div>
                        <span className='text-sm'>{report.createdBy.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className='flex flex-col gap-1'>
                        <span className='text-sm'>
                          {formatDate(report.updatedAt)}
                        </span>
                        <span className='text-xs text-muted-foreground'>
                          {formatRelativeTime(report.updatedAt)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className='text-right'>
                      <div className='flex items-center justify-end gap-2'>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => handleViewReport(report.id)}
                        >
                          <Eye className='h-4 w-4' />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant='ghost' size='sm'>
                              <MoreVertical className='h-4 w-4' />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align='end'>
                            <DropdownMenuItem
                              onClick={() => handleViewReport(report.id)}
                            >
                              <Eye className='mr-2 h-4 w-4' />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleEditReport(report.id)}
                            >
                              <Edit className='mr-2 h-4 w-4' />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleScheduleReport(report.id)}
                            >
                              <Calendar className='mr-2 h-4 w-4' />
                              Schedule
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleExportReport(report.id)}
                            >
                              <Download className='mr-2 h-4 w-4' />
                              Export
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteReport(report)}
                              className='text-destructive'
                            >
                              <Trash2 className='mr-2 h-4 w-4' />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Report</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedReport?.title}
              &quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant='destructive' onClick={confirmDelete}>
              Delete Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
