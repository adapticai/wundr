'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  History, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Download,
  Trash2,
  Search,
  Filter,
  Eye,
  RotateCcw
} from 'lucide-react';
import { format } from 'date-fns';

interface ExecutionResult {
  id: string;
  scriptId: string;
  scriptName: string;
  startTime: string;
  endTime?: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  output: string;
  errorOutput: string;
  exitCode?: number;
  duration?: number;
  parameters: Record<string, unknown>;
}

interface ScriptHistoryProps {
  executions: ExecutionResult[];
  onRerun?: (execution: ExecutionResult) => void;
  onViewDetails?: (execution: ExecutionResult) => void;
}

export function ScriptHistory({ executions, onRerun, onViewDetails }: ScriptHistoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedExecution, setSelectedExecution] = useState<ExecutionResult | null>(null);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'running': return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'failed': return 'bg-destructive/10 text-destructive';
      case 'cancelled': return 'bg-amber-500/10 text-amber-700 dark:text-amber-400';
      case 'running': return 'bg-accent/10 text-accent';
      default: return 'bg-accent/10 text-accent';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    const seconds = Math.round(ms / 1000);
    return seconds < 60 ? `${seconds}s` : `${Math.round(seconds / 60)}m ${seconds % 60}s`;
  };

  const downloadExecution = (execution: ExecutionResult) => {
    const content = `Script Execution Report
======================

Script: ${execution.scriptName}
Execution ID: ${execution.id}
Start Time: ${execution.startTime}
End Time: ${execution.endTime || 'N/A'}
Status: ${execution.status}
Duration: ${formatDuration(execution.duration)}
Exit Code: ${execution.exitCode ?? 'N/A'}

Parameters:
${JSON.stringify(execution.parameters, null, 2)}

Standard Output:
${execution.output}

Error Output:
${execution.errorOutput}
`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `execution-${execution.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredExecutions = executions.filter(execution => {
    const matchesSearch = execution.scriptName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      execution.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || execution.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (executions.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <History className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No Execution History</h3>
          <p className="text-muted-foreground">
            Script execution history will appear here once you start running scripts.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Execution History
          </CardTitle>
          <CardDescription>
            View and manage previous script executions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search executions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
              <option value="running">Running</option>
            </select>

            <div className="text-sm text-muted-foreground">
              {filteredExecutions.length} of {executions.length} executions
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Execution List */}
      <div className="grid gap-4">
        {filteredExecutions.map((execution) => (
          <Card 
            key={execution.id} 
            className={`hover:shadow-md transition-shadow ${
              selectedExecution?.id === execution.id ? 'ring-2 ring-blue-500' : ''
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {getStatusIcon(execution.status)}
                  <div>
                    <CardTitle className="text-lg">{execution.scriptName}</CardTitle>
                    <CardDescription className="text-sm">
                      ID: {execution.id}
                    </CardDescription>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(execution.status)}>
                    {execution.status}
                  </Badge>
                  {execution.exitCode !== undefined && (
                    <Badge variant="outline">
                      Exit: {execution.exitCode}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Execution Details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Started:</span>
                  <div className="font-medium">
                    {format(new Date(execution.startTime), 'MMM dd, HH:mm:ss')}
                  </div>
                </div>
                
                {execution.endTime && (
                  <div>
                    <span className="text-muted-foreground">Ended:</span>
                    <div className="font-medium">
                      {format(new Date(execution.endTime), 'MMM dd, HH:mm:ss')}
                    </div>
                  </div>
                )}
                
                <div>
                  <span className="text-muted-foreground">Duration:</span>
                  <div className="font-medium">
                    {formatDuration(execution.duration)}
                  </div>
                </div>
                
                <div>
                  <span className="text-muted-foreground">Parameters:</span>
                  <div className="font-medium">
                    {Object.keys(execution.parameters).length} params
                  </div>
                </div>
              </div>

              {/* Parameters Preview */}
              {Object.keys(execution.parameters).length > 0 && (
                <div className="space-y-2">
                  <span className="text-sm font-medium">Parameters:</span>
                  <div className="bg-muted p-2 rounded text-xs font-mono max-h-20 overflow-auto">
                    {JSON.stringify(execution.parameters, null, 2)}
                  </div>
                </div>
              )}

              {/* Output Preview */}
              {(execution.output || execution.errorOutput) && (
                <div className="space-y-2">
                  <span className="text-sm font-medium">
                    Output {execution.errorOutput && '(with errors)'}:
                  </span>
                  <div className="bg-card text-green-600 dark:text-green-400 p-2 rounded text-xs font-mono max-h-20 overflow-auto">
                    {execution.output && (
                      <div className="text-green-400">
                        {execution.output.split('\n').slice(0, 3).join('\n')}
                        {execution.output.split('\n').length > 3 && '\n...'}
                      </div>
                    )}
                    {execution.errorOutput && (
                      <div className="text-red-400">
                        {execution.errorOutput.split('\n').slice(0, 2).join('\n')}
                        {execution.errorOutput.split('\n').length > 2 && '\n...'}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedExecution(
                    selectedExecution?.id === execution.id ? null : execution
                  )}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {selectedExecution?.id === execution.id ? 'Hide' : 'View'} Details
                </Button>
                
                {onRerun && execution.status !== 'running' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRerun(execution)}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Rerun
                  </Button>
                )}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadExecution(execution)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </CardContent>

            {/* Expanded Details */}
            {selectedExecution?.id === execution.id && (
              <CardContent className="border-t bg-muted/50">
                <div className="space-y-4">
                  <h4 className="font-semibold">Full Output</h4>
                  
                  {execution.output && (
                    <div>
                      <h5 className="text-sm font-medium text-green-600 mb-2">Standard Output:</h5>
                      <div className="bg-card text-green-600 dark:text-green-400 p-3 rounded text-xs font-mono max-h-60 overflow-auto whitespace-pre-wrap">
                        {execution.output}
                      </div>
                    </div>
                  )}
                  
                  {execution.errorOutput && (
                    <div>
                      <h5 className="text-sm font-medium text-red-600 mb-2">Error Output:</h5>
                      <div className="bg-card text-red-400 p-3 rounded text-xs font-mono max-h-60 overflow-auto whitespace-pre-wrap">
                        {execution.errorOutput}
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <h5 className="text-sm font-medium mb-2">Full Parameters:</h5>
                    <div className="bg-muted p-3 rounded text-xs font-mono max-h-40 overflow-auto">
                      <pre>{JSON.stringify(execution.parameters, null, 2)}</pre>
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {filteredExecutions.length === 0 && executions.length > 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Filter className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No Matching Executions</h3>
            <p className="text-muted-foreground">
              Try adjusting your search or status filter.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}