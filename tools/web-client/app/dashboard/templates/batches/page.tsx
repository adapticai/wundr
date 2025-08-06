'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { 
  Play, 
  Pause, 
  Square, 
  RotateCcw, 
  Calendar, 
  Plus, 
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Eye,
  Download,
  Trash2
} from 'lucide-react';

// Hooks and components
import { useBatchManagement, BatchJob, BatchSchedule, CreateBatchRequest } from '@/hooks/use-batch-management';
import { BatchProgressCard } from '@/components/batches/batch-progress-card';

const BatchManagementPage: React.FC = () => {
  const {
    activeBatches,
    batchHistory,
    schedules,
    loading,
    error,
    createBatch,
    pauseBatch,
    resumeBatch,
    stopBatch,
    retryBatch,
    rollbackBatch,
    deleteBatch,
    toggleSchedule,
    deleteSchedule
  } = useBatchManagement();

  const [selectedBatch, setSelectedBatch] = useState<BatchJob | null>(null);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

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

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const BatchDashboard = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Batches</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeBatches.length}</div>
            <p className="text-xs text-muted-foreground">
              {activeBatches.filter(b => b.status === 'running').length} running
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {batchHistory.filter(b => 
                b.completedAt && 
                new Date(b.completedAt).toDateString() === new Date().toDateString()
              ).length}
            </div>
            <p className="text-xs text-muted-foreground">
              {batchHistory.filter(b => b.status === 'completed').length} total completed
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Batches</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {batchHistory.filter(b => b.status === 'failed').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Require attention
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled Jobs</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{schedules.length}</div>
            <p className="text-xs text-muted-foreground">
              {schedules.filter(s => s.enabled).length} enabled
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Batches */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Active Batch Jobs</h2>
          <span className="text-sm text-muted-foreground">
            {activeBatches.length} active
          </span>
        </div>
        
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="h-2 bg-muted rounded"></div>
                    <div className="h-3 bg-muted rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card className="border-red-200">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2 text-red-600">
                <AlertTriangle className="h-4 w-4" />
                <span>Error loading batches: {error}</span>
              </div>
            </CardContent>
          </Card>
        ) : activeBatches.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {activeBatches.map((batch) => (
              <BatchProgressCard
                key={batch.id}
                batch={batch}
                onPause={(id) => pauseBatch(id)}
                onResume={(id) => resumeBatch(id)}
                onStop={(id) => stopBatch(id)}
                onView={(batch) => setSelectedBatch(batch)}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No active batch jobs</p>
                <p className="text-sm">Create a new batch to get started</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );

  const BatchWizard = () => {
    const [wizardStep, setWizardStep] = useState(1);
    const [wizardLoading, setWizardLoading] = useState(false);
    const [newBatch, setNewBatch] = useState<CreateBatchRequest>({
      name: '',
      description: '',
      templates: [],
      consolidationType: 'merge',
      priority: 'medium',
      schedule: undefined,
      config: {
        backupStrategy: 'auto',
        conflictResolution: 'interactive'
      }
    });

    const handleCreateBatch = async () => {
      try {
        setWizardLoading(true);
        await createBatch(newBatch);
        
        // Reset form and close wizard
        setNewBatch({
          name: '',
          description: '',
          templates: [],
          consolidationType: 'merge',
          priority: 'medium',
          schedule: undefined,
          config: {
            backupStrategy: 'auto',
            conflictResolution: 'interactive'
          }
        });
        setWizardStep(1);
        setShowCreateWizard(false);
      } catch (error) {
        console.error('Failed to create batch:', error);
      } finally {
        setWizardLoading(false);
      }
    };

    return (
      <Dialog open={showCreateWizard} onOpenChange={setShowCreateWizard}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Batch Job</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Step Indicator */}
            <div className="flex items-center justify-between">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    step <= wizardStep
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {step}
                </div>
              ))}
            </div>

            {/* Step Content */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Basic Information</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="batch-name">Batch Name</Label>
                    <Input
                      id="batch-name"
                      value={newBatch.name}
                      onChange={(e) => setNewBatch(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter batch job name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="batch-description">Description</Label>
                    <Input
                      id="batch-description"
                      value={newBatch.description}
                      onChange={(e) => setNewBatch(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe what this batch will do"
                    />
                  </div>
                  <div>
                    <Label htmlFor="batch-priority">Priority</Label>
                    <Select value={newBatch.priority} onValueChange={(value: CreateBatchRequest['priority']) => setNewBatch(prev => ({ ...prev, priority: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Template Selection</h3>
                <div className="space-y-4">
                  <div>
                    <Label>Consolidation Type</Label>
                    <Select value={newBatch.consolidationType} onValueChange={(value: CreateBatchRequest['consolidationType']) => setNewBatch(prev => ({ ...prev, consolidationType: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="merge">Merge Templates</SelectItem>
                        <SelectItem value="replace">Replace Templates</SelectItem>
                        <SelectItem value="archive">Archive Templates</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Template selection would go here - simplified for demo */}
                  <div className="border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">
                      Template selection interface would be implemented here
                    </p>
                  </div>
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Configuration</h3>
                <div className="space-y-4">
                  <div>
                    <Label>Backup Strategy</Label>
                    <Select 
                      value={newBatch.config?.backupStrategy || 'auto'} 
                      onValueChange={(value: 'auto' | 'manual' | 'none') => setNewBatch(prev => ({ 
                        ...prev, 
                        config: { ...prev.config!, backupStrategy: value }
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Automatic Backup</SelectItem>
                        <SelectItem value="manual">Manual Backup</SelectItem>
                        <SelectItem value="none">No Backup</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Conflict Resolution</Label>
                    <Select 
                      value={newBatch.config?.conflictResolution || 'interactive'} 
                      onValueChange={(value: 'interactive' | 'auto' | 'skip') => setNewBatch(prev => ({ 
                        ...prev, 
                        config: { ...prev.config!, conflictResolution: value }
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="interactive">Interactive</SelectItem>
                        <SelectItem value="auto">Automatic</SelectItem>
                        <SelectItem value="skip">Skip Conflicts</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {wizardStep === 4 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Review & Schedule</h3>
                <div className="space-y-4">
                  <div className="border rounded-lg p-4 space-y-2">
                    <h4 className="font-medium">Batch Summary</h4>
                    <p><strong>Name:</strong> {newBatch.name}</p>
                    <p><strong>Description:</strong> {newBatch.description}</p>
                    <p><strong>Type:</strong> {newBatch.consolidationType}</p>
                    <p><strong>Priority:</strong> {newBatch.priority}</p>
                  </div>
                  <div>
                    <Label>Schedule (Optional)</Label>
                    <Select value={newBatch.schedule || ''} onValueChange={(value: string) => setNewBatch(prev => ({ ...prev, schedule: value || undefined }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Run immediately" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Run immediately</SelectItem>
                        <SelectItem value="1h">In 1 hour</SelectItem>
                        <SelectItem value="24h">In 24 hours</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="bg-muted p-3 rounded-lg text-sm">
                    <h4 className="font-medium mb-2">Configuration Summary:</h4>
                    <div className="space-y-1">
                      <div>Backup: {newBatch.config?.backupStrategy}</div>
                      <div>Conflicts: {newBatch.config?.conflictResolution}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setWizardStep(Math.max(1, wizardStep - 1))}
                disabled={wizardStep === 1 || wizardLoading}
              >
                Previous
              </Button>
              <div className="flex space-x-2">
                {wizardStep < 4 ? (
                  <Button 
                    onClick={() => setWizardStep(wizardStep + 1)}
                    disabled={wizardLoading || (wizardStep === 1 && (!newBatch.name || !newBatch.description))}
                  >
                    Next
                  </Button>
                ) : (
                  <Button 
                    onClick={handleCreateBatch}
                    disabled={wizardLoading || !newBatch.name || !newBatch.description}
                  >
                    {wizardLoading ? 'Creating...' : 'Create Batch'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const BatchHistory = () => (
    <Card>
      <CardHeader>
        <CardTitle>Batch History</CardTitle>
        <CardDescription>Previous batch job executions and results</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Results</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batchHistory.map((batch) => (
              <TableRow key={batch.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{batch.name}</div>
                    <div className="text-sm text-muted-foreground">{batch.description}</div>
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(batch.status)}</TableCell>
                <TableCell>
                  {batch.startedAt?.toLocaleDateString()} {batch.startedAt?.toLocaleTimeString()}
                </TableCell>
                <TableCell>
                  {batch.actualDuration ? formatDuration(batch.actualDuration) : '-'}
                </TableCell>
                <TableCell>
                  {batch.results ? (
                    <div className="text-sm">
                      <div>{batch.results.templatesProcessed} processed</div>
                      <div>{batch.results.duplicatesRemoved} duplicates removed</div>
                    </div>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedBatch(batch)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {batch.status === 'completed' && (
                      <>
                        <Button variant="outline" size="sm" title="Download results">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => rollbackBatch(batch.id)}
                          title="Rollback changes"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {batch.status === 'failed' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => retryBatch(batch.id)}
                        title="Retry batch"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => deleteBatch(batch.id)}
                      title="Delete from history"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  const ScheduledJobs = () => (
    <Card>
      <CardHeader>
        <CardTitle>Scheduled Batch Jobs</CardTitle>
        <CardDescription>Automated batch processing schedules</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Next Run</TableHead>
              <TableHead>Last Run</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedules.map((schedule: BatchSchedule) => (
              <TableRow key={schedule.id}>
                <TableCell className="font-medium">{schedule.name}</TableCell>
                <TableCell>{schedule.cronExpression}</TableCell>
                <TableCell>{schedule.nextRun.toLocaleString()}</TableCell>
                <TableCell>
                  {schedule.lastRun ? schedule.lastRun.toLocaleString() : 'Never'}
                </TableCell>
                <TableCell>
                  <Badge variant={schedule.enabled ? 'default' : 'secondary'}>
                    {schedule.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => toggleSchedule(schedule.id)}
                      title={schedule.enabled ? "Disable schedule" : "Enable schedule"}
                    >
                      {schedule.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => deleteSchedule(schedule.id)}
                      title="Delete schedule"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  const BatchDetailsModal = () => {
    if (!selectedBatch) return null;

    return (
      <Dialog open={!!selectedBatch} onOpenChange={() => setSelectedBatch(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedBatch.name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Status</h4>
                {getStatusBadge(selectedBatch.status)}
              </div>
              <div>
                <h4 className="font-medium mb-2">Progress</h4>
                <div className="space-y-1">
                  <Progress value={selectedBatch.progress} />
                  <span className="text-sm text-muted-foreground">{selectedBatch.progress}%</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Description</h4>
              <p className="text-sm text-muted-foreground">{selectedBatch.description}</p>
            </div>

            <div>
              <h4 className="font-medium mb-2">Templates ({selectedBatch.templates.length})</h4>
              <div className="flex flex-wrap gap-2">
                {selectedBatch.templates.map((template: string) => (
                  <Badge key={template} variant="outline">{template}</Badge>
                ))}
              </div>
            </div>

            {selectedBatch.errors.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 text-red-600">Errors</h4>
                <div className="space-y-1">
                  {selectedBatch.errors.map((error: string, index: number) => (
                    <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                      {error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedBatch.warnings.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 text-yellow-600">Warnings</h4>
                <div className="space-y-1">
                  {selectedBatch.warnings.map((warning: string, index: number) => (
                    <div key={index} className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
                      {warning}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedBatch.results && (
              <div>
                <h4 className="font-medium mb-2">Results</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>Templates Processed: {selectedBatch.results.templatesProcessed}</div>
                  <div>Duplicates Removed: {selectedBatch.results.duplicatesRemoved}</div>
                  <div>Conflicts Resolved: {selectedBatch.results.conflictsResolved}</div>
                  <div>Files Modified: {selectedBatch.results.filesModified}</div>
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <div className="flex space-x-2">
                {selectedBatch.status === 'running' && (
                  <Button 
                    variant="outline"
                    onClick={() => {
                      pauseBatch(selectedBatch.id);
                      setSelectedBatch(null);
                    }}
                  >
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </Button>
                )}
                {selectedBatch.status === 'paused' && (
                  <Button 
                    variant="outline"
                    onClick={() => {
                      resumeBatch(selectedBatch.id);
                      setSelectedBatch(null);
                    }}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Resume
                  </Button>
                )}
                {selectedBatch.status === 'failed' && (
                  <Button 
                    variant="outline"
                    onClick={() => {
                      retryBatch(selectedBatch.id);
                      setSelectedBatch(null);
                    }}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                )}
                {selectedBatch.status === 'completed' && (
                  <>
                    <Button 
                      variant="outline"
                      onClick={() => rollbackBatch(selectedBatch.id)}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Rollback
                    </Button>
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Download Report
                    </Button>
                  </>
                )}
                {(selectedBatch.status === 'running' || selectedBatch.status === 'paused') && (
                  <Button 
                    variant="destructive"
                    onClick={() => {
                      stopBatch(selectedBatch.id);
                      setSelectedBatch(null);
                    }}
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Stop
                  </Button>
                )}
              </div>
              <Button variant="outline" onClick={() => setSelectedBatch(null)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Batch Management</h1>
          <p className="text-muted-foreground">
            Manage template consolidation batches and automated processing
          </p>
        </div>
        <Button onClick={() => setShowCreateWizard(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Batch
        </Button>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <BatchDashboard />
        </TabsContent>

        <TabsContent value="history">
          <BatchHistory />
        </TabsContent>

        <TabsContent value="scheduled">
          <ScheduledJobs />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <BatchWizard />
      <BatchDetailsModal />
    </div>
  );
};

export default BatchManagementPage;