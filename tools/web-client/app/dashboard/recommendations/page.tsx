'use client';

import { useAnalysis } from '@/lib/contexts/analysis-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Code2,
  FileCode,
  Lightbulb,
  Play,
  RefreshCw,
  Target,
  Timer,
  TrendingUp,
  Wrench,
  Zap,
  Database,
  Upload,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { format } from 'date-fns';

interface RecommendationWithProgress {
  id: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  impact: string;
  estimatedEffort: string;
  suggestion?: string;
  entities?: string[];
  category: string;
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  progress: number;
  implementationTime?: string;
  assignedTo?: string;
  dependencies?: string[];
  quickFix?: {
    available: boolean;
    action: string;
    description: string;
  };
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'critical':
      return 'destructive';
    case 'high':
      return 'default';
    case 'medium':
      return 'secondary';
    case 'low':
      return 'outline';
    default:
      return 'outline';
  }
};

const getPriorityIcon = (priority: string) => {
  switch (priority) {
    case 'critical':
      return AlertTriangle;
    case 'high':
      return Target;
    case 'medium':
      return Clock;
    case 'low':
      return Lightbulb;
    default:
      return Lightbulb;
  }
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'Code Quality':
      return Code2;
    case 'Performance':
      return Zap;
    case 'Architecture':
      return FileCode;
    case 'Maintenance':
      return Wrench;
    case 'Security':
      return AlertTriangle;
    default:
      return Lightbulb;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'in_progress':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'pending':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'dismissed':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export default function RecommendationsPage() {
  const { data, loading, error, loadSampleData } = useAnalysis();
  const [sortBy, setSortBy] = useState<'priority' | 'effort' | 'impact'>('priority');
  const [filterByPriority, setFilterByPriority] = useState<string>('all');
  const [filterByCategory, setFilterByCategory] = useState<string>('all');
  const [filterByStatus, setFilterByStatus] = useState<string>('all');

  // Enhanced sample recommendations with progress tracking
  const enhancedRecommendations: RecommendationWithProgress[] = useMemo(() => {
    if (!data?.recommendations) return [];

    return data.recommendations.map((rec, index) => ({
      id: `rec-${index}`,
      ...rec,
      category: getCategoryFromType(rec.type),
      status: getRandomStatus(),
      progress: getRandomProgress(),
      implementationTime: getRandomImplementationTime(),
      assignedTo: getRandomAssignee(),
      dependencies: getRandomDependencies(),
      quickFix: {
        available: Math.random() > 0.5,
        action: 'Auto-fix',
        description: `Automatically apply fix for ${rec.type}`,
      },
    }));
  }, [data?.recommendations]);

  const categories = useMemo(() => {
    const cats = new Set(enhancedRecommendations.map(r => r.category));
    return Array.from(cats);
  }, [enhancedRecommendations]);

  const filteredRecommendations = useMemo(() => {
    let filtered = enhancedRecommendations;

    if (filterByPriority !== 'all') {
      filtered = filtered.filter(r => r.priority === filterByPriority);
    }

    if (filterByCategory !== 'all') {
      filtered = filtered.filter(r => r.category === filterByCategory);
    }

    if (filterByStatus !== 'all') {
      filtered = filtered.filter(r => r.status === filterByStatus);
    }

    // Sort recommendations
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        case 'effort':
          return parseEffort(a.estimatedEffort) - parseEffort(b.estimatedEffort);
        case 'impact':
          return b.impact.localeCompare(a.impact);
        default:
          return 0;
      }
    });
  }, [enhancedRecommendations, sortBy, filterByPriority, filterByCategory, filterByStatus]);

  const stats = useMemo(() => {
    const total = enhancedRecommendations.length;
    const byPriority = {
      critical: enhancedRecommendations.filter(r => r.priority === 'critical').length,
      high: enhancedRecommendations.filter(r => r.priority === 'high').length,
      medium: enhancedRecommendations.filter(r => r.priority === 'medium').length,
      low: enhancedRecommendations.filter(r => r.priority === 'low').length,
    };
    const byStatus = {
      pending: enhancedRecommendations.filter(r => r.status === 'pending').length,
      in_progress: enhancedRecommendations.filter(r => r.status === 'in_progress').length,
      completed: enhancedRecommendations.filter(r => r.status === 'completed').length,
      dismissed: enhancedRecommendations.filter(r => r.status === 'dismissed').length,
    };
    const avgProgress = enhancedRecommendations.reduce((sum, r) => sum + r.progress, 0) / total || 0;
    const quickFixAvailable = enhancedRecommendations.filter(r => r.quickFix?.available).length;

    return { total, byPriority, byStatus, avgProgress, quickFixAvailable };
  }, [enhancedRecommendations]);

  if (loading) {
    return (
      <div className='flex flex-1 flex-col gap-4 p-4'>
        <div className='flex items-center justify-between'>
          <h1 className='text-2xl font-bold'>Recommendations</h1>
          <Skeleton className='h-10 w-32' />
        </div>
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className='h-32' />
          ))}
        </div>
        <div className='space-y-4'>
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className='h-48' />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='flex flex-1 items-center justify-center p-4'>
        <div className='text-center'>
          <p className='text-lg text-muted-foreground mb-4'>{error}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className='flex flex-1 items-center justify-center p-4'>
        <div className='text-center space-y-4'>
          <Database className='mx-auto h-12 w-12 text-muted-foreground' />
          <h2 className='text-xl font-semibold'>No Analysis Data Available</h2>
          <p className='text-muted-foreground max-w-md'>
            Upload an analysis report or load sample data to view recommendations
          </p>
          <div className='flex gap-2 justify-center'>
            <Button onClick={loadSampleData}>
              <Database className='mr-2 h-4 w-4' />
              Load Sample Data
            </Button>
            <Button variant='outline'>
              <Upload className='mr-2 h-4 w-4' />
              Upload Report
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='flex flex-1 flex-col gap-6 p-4'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold'>Code Improvement Recommendations</h1>
          <p className='text-sm text-muted-foreground'>
            Last updated: {format(new Date(data.timestamp), 'PPpp')}
          </p>
        </div>
        <Button variant='outline' size='sm'>
          <RefreshCw className='mr-2 h-4 w-4' />
          Refresh
        </Button>
      </div>

      {/* Stats Overview */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Recommendations</CardTitle>
            <Lightbulb className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.total}</div>
            <p className='text-xs text-muted-foreground'>
              {stats.byPriority.critical} critical, {stats.byPriority.high} high priority
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Overall Progress</CardTitle>
            <TrendingUp className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{Math.round(stats.avgProgress)}%</div>
            <Progress value={stats.avgProgress} className='mt-2' />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Quick Fixes Available</CardTitle>
            <Zap className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.quickFixAvailable}</div>
            <p className='text-xs text-muted-foreground'>
              {Math.round((stats.quickFixAvailable / stats.total) * 100)}% can be auto-fixed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Completed</CardTitle>
            <CheckCircle2 className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.byStatus.completed}</div>
            <p className='text-xs text-muted-foreground'>
              {stats.byStatus.in_progress} in progress
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Controls */}
      <div className='flex flex-wrap gap-4 items-center'>
        <div className='flex items-center gap-2'>
          <label className='text-sm font-medium'>Sort by:</label>
          <Select value={sortBy} onValueChange={(value: 'priority' | 'effort' | 'impact') => setSortBy(value)}>
            <SelectTrigger className='w-32'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='priority'>Priority</SelectItem>
              <SelectItem value='effort'>Effort</SelectItem>
              <SelectItem value='impact'>Impact</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className='flex items-center gap-2'>
          <label className='text-sm font-medium'>Priority:</label>
          <Select value={filterByPriority} onValueChange={setFilterByPriority}>
            <SelectTrigger className='w-32'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All</SelectItem>
              <SelectItem value='critical'>Critical</SelectItem>
              <SelectItem value='high'>High</SelectItem>
              <SelectItem value='medium'>Medium</SelectItem>
              <SelectItem value='low'>Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className='flex items-center gap-2'>
          <label className='text-sm font-medium'>Category:</label>
          <Select value={filterByCategory} onValueChange={setFilterByCategory}>
            <SelectTrigger className='w-40'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='flex items-center gap-2'>
          <label className='text-sm font-medium'>Status:</label>
          <Select value={filterByStatus} onValueChange={setFilterByStatus}>
            <SelectTrigger className='w-32'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All</SelectItem>
              <SelectItem value='pending'>Pending</SelectItem>
              <SelectItem value='in_progress'>In Progress</SelectItem>
              <SelectItem value='completed'>Completed</SelectItem>
              <SelectItem value='dismissed'>Dismissed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Recommendations Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="critical">Critical</TabsTrigger>
          <TabsTrigger value="high">High</TabsTrigger>
          <TabsTrigger value="medium">Medium</TabsTrigger>
          <TabsTrigger value="low">Low</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <RecommendationsList recommendations={filteredRecommendations} />
        </TabsContent>
        
        <TabsContent value="critical" className="space-y-4">
          <RecommendationsList 
            recommendations={filteredRecommendations.filter(r => r.priority === 'critical')} 
          />
        </TabsContent>
        
        <TabsContent value="high" className="space-y-4">
          <RecommendationsList 
            recommendations={filteredRecommendations.filter(r => r.priority === 'high')} 
          />
        </TabsContent>
        
        <TabsContent value="medium" className="space-y-4">
          <RecommendationsList 
            recommendations={filteredRecommendations.filter(r => r.priority === 'medium')} 
          />
        </TabsContent>
        
        <TabsContent value="low" className="space-y-4">
          <RecommendationsList 
            recommendations={filteredRecommendations.filter(r => r.priority === 'low')} 
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RecommendationsList({ 
  recommendations 
}: { 
  recommendations: RecommendationWithProgress[] 
}) {
  if (recommendations.length === 0) {
    return (
      <div className="text-center py-8">
        <Lightbulb className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No recommendations found</h3>
        <p className="text-muted-foreground">Try adjusting your filters to see more results.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {recommendations.map((recommendation) => (
        <RecommendationCard key={recommendation.id} recommendation={recommendation} />
      ))}
    </div>
  );
}

function RecommendationCard({ 
  recommendation 
}: { 
  recommendation: RecommendationWithProgress 
}) {
  const PriorityIcon = getPriorityIcon(recommendation.priority);
  const CategoryIcon = getCategoryIcon(recommendation.category);

  return (
    <Card className="relative">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <CategoryIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{recommendation.description}</CardTitle>
                <Badge variant={getPriorityColor(recommendation.priority) as 'destructive' | 'default' | 'secondary' | 'outline'}>
                  <PriorityIcon className="h-3 w-3 mr-1" />
                  {recommendation.priority}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Timer className="h-4 w-4" />
                  {recommendation.estimatedEffort}
                </span>
                <span className="flex items-center gap-1">
                  <Target className="h-4 w-4" />
                  {recommendation.category}
                </span>
                {recommendation.assignedTo && (
                  <span>Assigned to: {recommendation.assignedTo}</span>
                )}
              </div>
            </div>
          </div>
          <div className={`px-2 py-1 rounded-md text-xs font-medium border ${getStatusColor(recommendation.status)}`}>
            {recommendation.status.replace('_', ' ').toUpperCase()}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <CardDescription className="text-base">
          {recommendation.impact}
        </CardDescription>

        {recommendation.suggestion && (
          <div className="bg-muted/50 p-3 rounded-md">
            <p className="text-sm"><strong>Suggestion:</strong> {recommendation.suggestion}</p>
          </div>
        )}

        {recommendation.entities && recommendation.entities.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="text-sm text-muted-foreground mr-2">Affected entities:</span>
            {recommendation.entities.map((entity, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {entity}
              </Badge>
            ))}
          </div>
        )}

        {recommendation.dependencies && recommendation.dependencies.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="text-sm text-muted-foreground mr-2">Dependencies:</span>
            {recommendation.dependencies.map((dep, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {dep}
              </Badge>
            ))}
          </div>
        )}

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{recommendation.progress}%</span>
          </div>
          <Progress value={recommendation.progress} />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-2">
          <div className="flex gap-2">
            {recommendation.quickFix?.available && (
              <Button size="sm" variant="outline">
                <Zap className="h-4 w-4 mr-1" />
                {recommendation.quickFix.action}
              </Button>
            )}
            <Button size="sm" variant="outline">
              <Play className="h-4 w-4 mr-1" />
              Start Implementation
            </Button>
          </div>
          
          {recommendation.implementationTime && (
            <span className="text-xs text-muted-foreground">
              ETA: {recommendation.implementationTime}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Helper functions
function getCategoryFromType(type: string): string {
  const categoryMap: Record<string, string> = {
    'duplicate_removal': 'Code Quality',
    'pattern_extraction': 'Architecture',
    'code_cleanup': 'Maintenance',
    'performance': 'Performance',
    'security': 'Security',
  };
  return categoryMap[type] || 'Code Quality';
}

function getRandomStatus(): 'pending' | 'in_progress' | 'completed' | 'dismissed' {
  const statuses = ['pending', 'in_progress', 'completed', 'dismissed'] as const;
  const weights = [0.5, 0.25, 0.15, 0.1]; // Weights for each status
  const random = Math.random();
  let sum = 0;
  
  for (let i = 0; i < statuses.length; i++) {
    sum += weights[i];
    if (random < sum) {
      return statuses[i];
    }
  }
  
  return 'pending';
}

function getRandomProgress(): number {
  // Generate random progress based on status logic
  const baseProgress = Math.floor(Math.random() * 100);
  return Math.max(0, Math.min(100, baseProgress));
}

function getRandomImplementationTime(): string {
  const times = ['2 hours', '1 day', '3 days', '1 week', '2 weeks'];
  return times[Math.floor(Math.random() * times.length)];
}

function getRandomAssignee(): string {
  const assignees = ['John Doe', 'Jane Smith', 'Mike Johnson', 'Sarah Wilson', 'Alex Chen'];
  return assignees[Math.floor(Math.random() * assignees.length)];
}

function getRandomDependencies(): string[] {
  const allDeps = ['Refactor Module A', 'Update Tests', 'Review Security', 'Performance Audit', 'Documentation Update'];
  const numDeps = Math.floor(Math.random() * 3); // 0-2 dependencies
  const shuffled = allDeps.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, numDeps);
}

function parseEffort(effort: string): number {
  // Parse effort string to hours for sorting
  const match = effort.match(/(\d+)(?:-(\d+))?\s*hours?/i);
  if (match) {
    const min = parseInt(match[1]);
    const max = match[2] ? parseInt(match[2]) : min;
    return (min + max) / 2;
  }
  return 0;
}