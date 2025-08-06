'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Play, 
  Pause, 
  Square, 
  Eye, 
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle 
} from 'lucide-react';
import { BatchJob } from '@/hooks/use-batch-management';

interface BatchProgressCardProps {
  batch: BatchJob;
  onPause?: (batchId: string) => void;
  onResume?: (batchId: string) => void;
  onStop?: (batchId: string) => void;
  onView?: (batch: BatchJob) => void;
}

export const BatchProgressCard: React.FC<BatchProgressCardProps> = ({
  batch,
  onPause,
  onResume,
  onStop,
  onView
}) => {
  const getStatusIcon = (status: BatchJob['status']) => {
    switch (status) {
      case 'running': return <Play className="h-4 w-4 text-blue-500" />;
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'paused': return <Pause className="h-4 w-4 text-yellow-500" />;
      case 'pending': return <Clock className="h-4 w-4 text-gray-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: BatchJob['status']) => {
    const variants = {
      running: 'default',
      completed: 'default',
      failed: 'destructive',
      paused: 'secondary',
      pending: 'outline'
    } as const;

    return (
      <Badge variant={variants[status]} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getPriorityColor = (priority: BatchJob['priority']) => {
    switch (priority) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getElapsedTime = () => {
    if (!batch.startedAt) return null;
    const now = new Date();
    const elapsed = Math.floor((now.getTime() - batch.startedAt.getTime()) / 60000); // minutes
    return formatDuration(elapsed);
  };

  const getETA = () => {
    if (batch.progress === 0) return formatDuration(batch.estimatedDuration);
    const elapsed = getElapsedTime();
    if (!elapsed || batch.progress === 100) return null;
    
    const elapsedMinutes = batch.startedAt ? 
      Math.floor((new Date().getTime() - batch.startedAt.getTime()) / 60000) : 0;
    const remainingProgress = 100 - batch.progress;
    const estimatedRemaining = (elapsedMinutes / batch.progress) * remainingProgress;
    
    return formatDuration(Math.ceil(estimatedRemaining));
  };

  return (
    <Card className="transition-all duration-200 hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <CardTitle className="text-lg">{batch.name}</CardTitle>
            {getStatusBadge(batch.status)}
          </div>
          <div className="flex items-center space-x-1">
            {batch.status === 'running' && onPause && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onPause(batch.id)}
                title="Pause batch"
              >
                <Pause className="h-4 w-4" />
              </Button>
            )}
            {batch.status === 'paused' && onResume && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onResume(batch.id)}
                title="Resume batch"
              >
                <Play className="h-4 w-4" />
              </Button>
            )}
            {(batch.status === 'running' || batch.status === 'paused') && onStop && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onStop(batch.id)}
                title="Stop batch"
              >
                <Square className="h-4 w-4" />
              </Button>
            )}
            {onView && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onView(batch)}
                title="View details"
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{batch.description}</p>
        
        {/* Progress Section */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="font-medium">Progress</span>
            <span className="text-muted-foreground">{batch.progress.toFixed(1)}%</span>
          </div>
          <Progress 
            value={batch.progress} 
            className="h-2"
          />
        </div>
        
        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Templates:</span>
            <span className="ml-2 font-medium">{batch.templates.length}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Priority:</span>
            <span className={`ml-2 font-medium ${getPriorityColor(batch.priority)}`}>
              {batch.priority.charAt(0).toUpperCase() + batch.priority.slice(1)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Type:</span>
            <span className="ml-2 font-medium">
              {batch.consolidationType.charAt(0).toUpperCase() + batch.consolidationType.slice(1)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">
              {batch.status === 'running' ? 'ETA:' : 'Duration:'}
            </span>
            <span className="ml-2 font-medium">
              {batch.status === 'running' ? getETA() || 'Calculating...' : 
               batch.actualDuration ? formatDuration(batch.actualDuration) :
               formatDuration(batch.estimatedDuration)}
            </span>
          </div>
        </div>
        
        {/* Time Information */}
        {batch.startedAt && (
          <div className="text-xs text-muted-foreground space-y-1">
            <div>Started: {batch.startedAt.toLocaleString()}</div>
            {batch.status === 'running' && getElapsedTime() && (
              <div>Elapsed: {getElapsedTime()}</div>
            )}
            {batch.completedAt && (
              <div>Completed: {batch.completedAt.toLocaleString()}</div>
            )}
          </div>
        )}
        
        {/* Templates Preview */}
        <div className="space-y-2">
          <span className="text-sm font-medium">Templates:</span>
          <div className="flex flex-wrap gap-1">
            {batch.templates.slice(0, 3).map((template) => (
              <Badge key={template} variant="outline" className="text-xs">
                {template}
              </Badge>
            ))}
            {batch.templates.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{batch.templates.length - 3} more
              </Badge>
            )}
          </div>
        </div>
        
        {/* Warnings and Errors */}
        {batch.warnings.length > 0 && (
          <div className="flex items-center space-x-2 text-yellow-600 bg-yellow-50 p-2 rounded">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm">
              {batch.warnings.length} warning{batch.warnings.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
        
        {batch.errors.length > 0 && (
          <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-2 rounded">
            <XCircle className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm">
              {batch.errors.length} error{batch.errors.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
        
        {/* Results Summary for Completed Batches */}
        {batch.results && batch.status === 'completed' && (
          <div className="bg-green-50 p-3 rounded-lg space-y-1">
            <div className="text-sm font-medium text-green-800">Results:</div>
            <div className="grid grid-cols-2 gap-2 text-xs text-green-700">
              <div>{batch.results.templatesProcessed} processed</div>
              <div>{batch.results.duplicatesRemoved} duplicates removed</div>
              <div>{batch.results.conflictsResolved} conflicts resolved</div>
              <div>{batch.results.filesModified} files modified</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};