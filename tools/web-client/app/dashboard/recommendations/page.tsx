'use client';

import { useAnalysisData } from '@/hooks/use-analysis-data';
import { useWebSocket } from '@/hooks/use-websocket';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
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
  Search,
  Filter,
  Activity,
  Bell,
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { AnalysisRecommendation } from '@/types/data';

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
    case 'Security':
      return AlertTriangle;
    case 'Performance':
      return Zap;
    case 'Maintainability':
      return Code2;
    case 'Reliability':
      return CheckCircle2;
    case 'Architecture':
      return FileCode;
    default:
      return Wrench;
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
  const {
    data,
    loading,
    error,
    refresh,
    updateRecommendation,
    triggerAnalysis
  } = useAnalysisData({
    autoRefresh: true,
    refreshInterval: 300000, // 5 minutes
    realtime: true
  });

  const [sortBy, setSortBy] = useState<'priority' | 'effort' | 'impact' | 'status'>('priority');
  const [filterByPriority, setFilterByPriority] = useState<string>('all');
  const [filterByCategory, setFilterByCategory] = useState<string>('all');
  const [filterByStatus, setFilterByStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [realtimeUpdates, setRealtimeUpdates] = useState<any>(null);

  const { isConnected, subscribe, lastMessage } = useWebSocket({
    enabled: true,
    onMessage: (message) => {
      if (message.type === 'data' && message.channel === 'recommendations') {
        setRealtimeUpdates(message.payload);
      }
    }
  });

  useEffect(() => {
    if (isConnected) {
      subscribe('recommendations');
    }
  }, [isConnected, subscribe]);

  const recommendations = data?.recommendations || [];

  const categories = useMemo(() => {
    const cats = new Set(recommendations.map(r => r.category));
    return Array.from(cats);
  }, [recommendations]);

  const filteredRecommendations = useMemo(() => {
    let filtered = recommendations;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(r => 
        r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply filters
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
        case 'status':
          return a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });
  }, [recommendations, sortBy, filterByPriority, filterByCategory, filterByStatus, searchTerm]);

  const stats = useMemo(() => {
    const total = recommendations.length;
    const byPriority = {
      critical: recommendations.filter(r => r.priority === 'critical').length,
      high: recommendations.filter(r => r.priority === 'high').length,
      medium: recommendations.filter(r => r.priority === 'medium').length,
      low: recommendations.filter(r => r.priority === 'low').length,
    };
    const byStatus = {
      pending: recommendations.filter(r => r.status === 'pending').length,
      in_progress: recommendations.filter(r => r.status === 'in_progress').length,
      completed: recommendations.filter(r => r.status === 'completed').length,
      dismissed: recommendations.filter(r => r.status === 'dismissed').length,
    };
    const autoFixAvailable = recommendations.filter(r => r.autoFixAvailable).length;

    return { total, byPriority, byStatus, autoFixAvailable };
  }, [recommendations]);

  if (loading.isLoading && !data) {
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
        <div className='text-center space-y-4'>
          <AlertTriangle className='mx-auto h-12 w-12 text-destructive' />
          <h2 className='text-xl font-semibold'>Error Loading Recommendations</h2>
          <p className='text-lg text-muted-foreground mb-4'>{error.message}</p>
          <div className='flex gap-2 justify-center'>
            <Button onClick={error.retry || refresh}>Try Again</Button>
            <Button variant='outline' onClick={triggerAnalysis}>
              <RefreshCw className='mr-2 h-4 w-4' />
              Refresh Analysis
            </Button>
          </div>
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
            Trigger a new analysis to get personalized recommendations
          </p>
          <div className='flex gap-2 justify-center'>
            <Button onClick={triggerAnalysis}>
              <Activity className='mr-2 h-4 w-4' />
              Start Analysis
            </Button>
            <Button variant='outline' onClick={refresh}>
              <Upload className='mr-2 h-4 w-4' />
              Check for Updates
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
          <div className='flex items-center gap-3'>
            <h1 className='text-2xl font-bold'>Code Improvement Recommendations</h1>
            <Badge variant={isConnected ? 'default' : 'secondary'}>
              <Activity className='mr-1 h-3 w-3' />
              {isConnected ? 'Live' : 'Cached'}
            </Badge>
            {realtimeUpdates?.data?.newRecommendations > 0 && (
              <Badge variant='destructive'>
                <Bell className='mr-1 h-3 w-3' />
                {realtimeUpdates.data.newRecommendations} New
              </Badge>
            )}
          </div>
          <p className='text-sm text-muted-foreground'>
            Last updated: {format(new Date(data.timestamp), 'PPpp')}
            {loading.isRefreshing && ' • Refreshing...'}
          </p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={refresh} disabled={loading.isRefreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading.isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size='sm' onClick={triggerAnalysis}>
            <Database className='mr-2 h-4 w-4' />
            New Analysis
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Recommendations</CardTitle>
            <Lightbulb className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {realtimeUpdates?.data?.totalPending || stats.total}
            </div>
            <p className='text-xs text-muted-foreground'>
              {stats.byPriority.critical} critical, {stats.byPriority.high} high priority
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Critical Issues</CardTitle>
            <AlertTriangle className='h-4 w-4 text-red-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-red-600'>
              {realtimeUpdates?.data?.critical || stats.byPriority.critical}
            </div>
            <p className='text-xs text-muted-foreground'>
              Require immediate attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Auto-Fix Available</CardTitle>
            <Zap className='h-4 w-4 text-green-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-green-600'>
              {realtimeUpdates?.data?.autoFixAvailable || stats.autoFixAvailable}
            </div>
            <p className='text-xs text-muted-foreground'>
              Can be resolved automatically
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Completed</CardTitle>
            <CheckCircle2 className='h-4 w-4 text-green-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-green-600'>{stats.byStatus.completed}</div>
            <p className='text-xs text-muted-foreground'>
              {stats.byStatus.in_progress} in progress
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className='flex flex-col sm:flex-row gap-4 items-start sm:items-center'>
        <div className='relative flex-1 max-w-sm'>
          <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4' />
          <Input
            placeholder='Search recommendations...'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className='pl-10'
          />
        </div>
        
        <div className='flex flex-wrap gap-4 items-center'>
          <div className='flex items-center gap-2'>
            <label className='text-sm font-medium'>Sort by:</label>
            <Select value={sortBy} onValueChange={(value: 'priority' | 'effort' | 'impact' | 'status') => setSortBy(value)}>
              <SelectTrigger className='w-32'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='priority'>Priority</SelectItem>
                <SelectItem value='effort'>Effort</SelectItem>
                <SelectItem value='impact'>Impact</SelectItem>
                <SelectItem value='status'>Status</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className='flex items-center gap-2'>
            <Filter className='h-4 w-4 text-muted-foreground' />
            <Select value={filterByPriority} onValueChange={setFilterByPriority}>
              <SelectTrigger className='w-32'>
                <SelectValue placeholder='Priority' />
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

          <Select value={filterByCategory} onValueChange={setFilterByCategory}>
            <SelectTrigger className='w-40'>
              <SelectValue placeholder='Category' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterByStatus} onValueChange={setFilterByStatus}>
            <SelectTrigger className='w-32'>
              <SelectValue placeholder='Status' />
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
          <TabsTrigger value="all">All ({filteredRecommendations.length})</TabsTrigger>
          <TabsTrigger value="critical">Critical ({filteredRecommendations.filter(r => r.priority === 'critical').length})</TabsTrigger>
          <TabsTrigger value="high">High ({filteredRecommendations.filter(r => r.priority === 'high').length})</TabsTrigger>
          <TabsTrigger value="medium">Medium ({filteredRecommendations.filter(r => r.priority === 'medium').length})</TabsTrigger>
          <TabsTrigger value="low">Low ({filteredRecommendations.filter(r => r.priority === 'low').length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <RecommendationsList 
            recommendations={filteredRecommendations} 
            updateRecommendation={updateRecommendation}
          />
        </TabsContent>
        
        <TabsContent value="critical" className="space-y-4">
          <RecommendationsList 
            recommendations={filteredRecommendations.filter(r => r.priority === 'critical')} 
            updateRecommendation={updateRecommendation}
          />
        </TabsContent>
        
        <TabsContent value="high" className="space-y-4">
          <RecommendationsList 
            recommendations={filteredRecommendations.filter(r => r.priority === 'high')} 
            updateRecommendation={updateRecommendation}
          />
        </TabsContent>
        
        <TabsContent value="medium" className="space-y-4">
          <RecommendationsList 
            recommendations={filteredRecommendations.filter(r => r.priority === 'medium')} 
            updateRecommendation={updateRecommendation}
          />
        </TabsContent>
        
        <TabsContent value="low" className="space-y-4">
          <RecommendationsList 
            recommendations={filteredRecommendations.filter(r => r.priority === 'low')} 
            updateRecommendation={updateRecommendation}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RecommendationsList({ 
  recommendations,
  updateRecommendation 
}: { 
  recommendations: AnalysisRecommendation[]
  updateRecommendation: (id: string, status: string) => Promise<void>
}) {
  if (recommendations.length === 0) {
    return (
      <div className="text-center py-12">
        <Lightbulb className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No recommendations found</h3>
        <p className="text-muted-foreground">Try adjusting your filters to see more results.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {recommendations.map((recommendation) => (
        <RecommendationCard 
          key={recommendation.id} 
          recommendation={recommendation} 
          updateRecommendation={updateRecommendation}
        />
      ))}
    </div>
  );
}

function RecommendationCard({ 
  recommendation,
  updateRecommendation 
}: { 
  recommendation: AnalysisRecommendation
  updateRecommendation: (id: string, status: string) => Promise<void>
}) {
  const PriorityIcon = getPriorityIcon(recommendation.priority);
  const CategoryIcon = getCategoryIcon(recommendation.category);

  const handleStatusUpdate = async (newStatus: string) => {
    await updateRecommendation(recommendation.id, newStatus);
  };

  return (
    <Card className="relative">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <CategoryIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{recommendation.title}</CardTitle>
                <Badge variant={getPriorityColor(recommendation.priority) as 'destructive' | 'default' | 'secondary' | 'outline'}>
                  <PriorityIcon className="h-3 w-3 mr-1" />
                  {recommendation.priority}
                </Badge>
                {recommendation.autoFixAvailable && (
                  <Badge variant="default">
                    <Zap className="h-3 w-3 mr-1" />
                    Auto-Fix
                  </Badge>
                )}
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
          {recommendation.description}
        </CardDescription>

        <div className="bg-muted/50 p-3 rounded-md">
          <p className="text-sm"><strong>Impact:</strong> {recommendation.impact}</p>
          {recommendation.suggestion && (
            <p className="text-sm mt-2"><strong>Suggestion:</strong> {recommendation.suggestion}</p>
          )}
        </div>

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

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-2 border-t">
          <div className="flex gap-2">
            {recommendation.quickFix?.available && (
              <Button size="sm" variant="destructive">
                <Zap className="h-4 w-4 mr-1" />
                {recommendation.quickFix.action}
              </Button>
            )}
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => handleStatusUpdate('in_progress')}
              disabled={recommendation.status === 'in_progress'}
            >
              <Play className="h-4 w-4 mr-1" />
              {recommendation.status === 'in_progress' ? 'In Progress' : 'Start'}
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => handleStatusUpdate('completed')}
              disabled={recommendation.status === 'completed'}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              {recommendation.status === 'completed' ? 'Completed' : 'Mark Done'}
            </Button>
          </div>
          
          {recommendation.quickFix?.estimatedTime && (
            <span className="text-xs text-muted-foreground">
              ETA: {recommendation.quickFix.estimatedTime}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Helper function to parse effort string to hours for sorting
function parseEffort(effort: string): number {
  const match = effort.match(/(\d+)(?:-(\d+))?\s*hours?/i);
  if (match) {
    const min = parseInt(match[1]);
    const max = match[2] ? parseInt(match[2]) : min;
    return (min + max) / 2;
  }
  return 0;
}