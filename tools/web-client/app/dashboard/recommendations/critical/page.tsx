'use client';

import { useAnalysisData } from '@/hooks/use-analysis-data';
import { useWebSocket } from '@/hooks/use-websocket';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  Shield,
  Zap,
  Clock,
  Database,
  Upload,
  RefreshCw,
  ExternalLink,
  Play,
  Wrench,
  Bug,
  Server,
  Lock,
  Activity,
  Timer,
  Target,
  CheckCircle2,
  XCircle,
  ArrowRight,
  FileCode,
  Bell,
  Siren,
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import Link from 'next/link';
import { AnalysisRecommendation } from '@/types/data';

interface CriticalAlert {
  id: string;
  title: string;
  description: string;
  severity: 'emergency' | 'critical' | 'high';
  category: 'security' | 'performance' | 'production' | 'data';
  impact: string;
  urgency: string;
  detectedAt: string;
  affectedSystems: string[];
  estimatedDowntime?: string;
  actionRequired: boolean;
  autoFixAvailable: boolean;
  dependencies: string[];
  assignedTo?: string;
  status: 'active' | 'investigating' | 'fixing' | 'resolved';
  quickFix?: {
    available: boolean;
    action: string;
    description: string;
    estimatedTime: string;
  };
  emergencyContacts?: string[];
  documentationLinks?: string[];
}

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'emergency':
      return 'destructive';
    case 'critical':
      return 'destructive';
    case 'high':
      return 'default';
    default:
      return 'secondary';
  }
};

const getSeverityIcon = (severity: string) => {
  switch (severity) {
    case 'emergency':
      return Siren;
    case 'critical':
      return AlertTriangle;
    case 'high':
      return AlertTriangle;
    default:
      return AlertTriangle;
  }
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'security':
      return Shield;
    case 'performance':
      return Zap;
    case 'production':
      return Server;
    case 'data':
      return Database;
    default:
      return AlertTriangle;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'resolved':
      return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950/20 dark:text-green-200 dark:border-green-800';
    case 'fixing':
      return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/20 dark:text-blue-200 dark:border-blue-800';
    case 'investigating':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-200 dark:border-yellow-800';
    case 'active':
      return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/20 dark:text-red-200 dark:border-red-800';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-950/20 dark:text-gray-200 dark:border-gray-800';
  }
};

export default function CriticalRecommendationsPage() {
  const {
    data,
    loading,
    error,
    refresh,
    updateRecommendation,
    triggerAnalysis
  } = useAnalysisData({
    autoRefresh: true,
    refreshInterval: 60000, // 1 minute for critical issues
    realtime: true
  });

  const [activeTab, setActiveTab] = useState('alerts');
  const [realtimeAlerts, setRealtimeAlerts] = useState<any[]>([]);

  const { isConnected, subscribe, lastMessage } = useWebSocket({
    enabled: true,
    onMessage: (message) => {
      if (message.type === 'data' && message.channel === 'recommendations') {
        if (message.payload?.data?.critical > 0) {
          // New critical issue detected
          setRealtimeAlerts(prev => [...prev, message.payload]);
        }
      }
    }
  });

  useEffect(() => {
    if (isConnected) {
      subscribe('recommendations');
      subscribe('dashboard');
    }
  }, [isConnected, subscribe]);

  // Generate critical alerts from recommendations
  const criticalAlerts: CriticalAlert[] = useMemo(() => {
    if (!data?.recommendations) return [];

    return data.recommendations
      .filter(rec => rec.priority === 'critical')
      .map((rec, index) => ({
        id: rec.id,
        title: rec.title,
        description: rec.description,
        severity: 'critical' as const,
        category: mapCategoryToAlertCategory(rec.category),
        impact: rec.impact,
        urgency: `${rec.estimatedEffort} to resolve`,
        detectedAt: new Date(Date.now() - Math.random() * 4 * 60 * 60 * 1000).toISOString(),
        affectedSystems: rec.entities.slice(0, 3),
        actionRequired: true,
        autoFixAvailable: rec.autoFixAvailable,
        dependencies: rec.dependencies,
        assignedTo: rec.assignedTo,
        status: mapStatusToAlertStatus(rec.status),
        quickFix: rec.quickFix ? {
          available: rec.quickFix.available,
          action: rec.quickFix.action,
          description: rec.quickFix.description,
          estimatedTime: rec.quickFix.estimatedTime
        } : undefined,
        emergencyContacts: generateEmergencyContacts(rec.category),
        documentationLinks: generateDocLinks(rec.type)
      }));
  }, [data?.recommendations]);

  const emergencyAlerts = criticalAlerts.filter(alert => alert.severity === 'emergency');
  const criticalCount = criticalAlerts.filter(alert => alert.severity === 'critical').length;
  const activeIssues = criticalAlerts.filter(alert => alert.status === 'active').length;
  const autoFixAvailable = criticalAlerts.filter(alert => alert.autoFixAvailable).length;

  if (loading.isLoading && !data) {
    return (
      <div className='flex flex-1 flex-col gap-4 p-4'>
        <div className='flex items-center justify-between'>
          <h1 className='text-2xl font-bold text-red-600'>Critical Recommendations</h1>
          <Skeleton className='h-10 w-32' />
        </div>
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className='h-24' />
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
          <h2 className='text-xl font-semibold'>Error Loading Critical Issues</h2>
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
            Trigger a new analysis to identify critical issues requiring immediate attention
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
            <h1 className='text-2xl font-bold text-red-600 dark:text-red-400'>
              Critical Issues Dashboard
            </h1>
            <Badge variant={isConnected ? 'default' : 'secondary'}>
              <Activity className='mr-1 h-3 w-3' />
              {isConnected ? 'Live Monitoring' : 'Cached Data'}
            </Badge>
            {realtimeAlerts.length > 0 && (
              <Badge variant='destructive' className='animate-pulse'>
                <Bell className='mr-1 h-3 w-3' />
                {realtimeAlerts.length} New Alerts
              </Badge>
            )}
          </div>
          <p className='text-sm text-muted-foreground'>
            Urgent action required - Last updated: {format(new Date(), 'PPpp')}
            {loading.isRefreshing && ' • Refreshing...'}
          </p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={refresh} disabled={loading.isRefreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading.isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Link href='/dashboard/recommendations'>
            <Button variant='ghost' size='sm'>
              <ArrowRight className='mr-2 h-4 w-4' />
              All Recommendations
            </Button>
          </Link>
        </div>
      </div>

      {/* Emergency Alert Banner */}
      {emergencyAlerts.length > 0 && (
        <Alert variant="destructive" className="border-2 border-red-500 animate-pulse">
          <Siren className="h-4 w-4" />
          <AlertTitle>EMERGENCY: Immediate Action Required</AlertTitle>
          <AlertDescription>
            {emergencyAlerts.length} emergency-level issues detected requiring immediate attention.
            <div className="mt-2">
              <Button size="sm" variant="destructive">
                <Shield className="mr-2 h-4 w-4" />
                Initiate Emergency Response
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Critical Stats */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Emergency Alerts</CardTitle>
            <Siren className='h-4 w-4 text-red-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-red-600'>{emergencyAlerts.length}</div>
            <p className='text-xs text-muted-foreground'>
              Require immediate response
            </p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Critical Issues</CardTitle>
            <AlertTriangle className='h-4 w-4 text-orange-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-orange-600'>{criticalCount}</div>
            <p className='text-xs text-muted-foreground'>
              High priority fixes needed
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Active Issues</CardTitle>
            <Activity className='h-4 w-4 text-blue-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-blue-600'>{activeIssues}</div>
            <p className='text-xs text-muted-foreground'>
              Currently being investigated
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-200 dark:border-green-800">
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Auto-Fix Available</CardTitle>
            <Zap className='h-4 w-4 text-green-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-green-600'>{autoFixAvailable}</div>
            <p className='text-xs text-muted-foreground'>
              Can be resolved automatically
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="alerts" className="text-red-600 data-[state=active]:text-red-600">
            Critical Alerts ({criticalAlerts.length})
          </TabsTrigger>
          <TabsTrigger value="actions">Immediate Actions</TabsTrigger>
          <TabsTrigger value="monitoring">Live Monitoring</TabsTrigger>
          <TabsTrigger value="procedures">Emergency Procedures</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="space-y-4">
          <div className="space-y-4">
            {criticalAlerts.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Critical Issues</h3>
                  <p className="text-muted-foreground">Great! No critical issues detected at this time.</p>
                </CardContent>
              </Card>
            ) : (
              criticalAlerts.map((alert) => (
                <CriticalAlertCard key={alert.id} alert={alert} updateRecommendation={updateRecommendation} />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <ImmediateActionsPanel alerts={criticalAlerts} updateRecommendation={updateRecommendation} />
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <LiveMonitoringPanel alerts={criticalAlerts} realtimeAlerts={realtimeAlerts} />
        </TabsContent>

        <TabsContent value="procedures" className="space-y-4">
          <EmergencyProceduresPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CriticalAlertCard({ 
  alert, 
  updateRecommendation 
}: { 
  alert: CriticalAlert
  updateRecommendation: (id: string, status: string) => Promise<void>
}) {
  const SeverityIcon = getSeverityIcon(alert.severity);
  const CategoryIcon = getCategoryIcon(alert.category);
  const timeAgo = format(new Date(alert.detectedAt), 'PPpp');

  const handleStatusUpdate = async (newStatus: string) => {
    await updateRecommendation(alert.id, newStatus);
  };

  return (
    <Card className={`relative ${alert.severity === 'emergency' ? 'border-red-500 border-2 animate-pulse' : 'border-orange-200'}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <CategoryIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{alert.title}</CardTitle>
                <Badge variant={getSeverityColor(alert.severity) as 'destructive' | 'default' | 'secondary'}>
                  <SeverityIcon className="h-3 w-3 mr-1" />
                  {alert.severity.toUpperCase()}
                </Badge>
                {alert.actionRequired && (
                  <Badge variant="destructive" className="animate-bounce">ACTION REQUIRED</Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Detected: {timeAgo}
                </span>
                <span className="flex items-center gap-1">
                  <Target className="h-4 w-4" />
                  {alert.category.toUpperCase()}
                </span>
                {alert.assignedTo && (
                  <span>Assigned: {alert.assignedTo}</span>
                )}
              </div>
            </div>
          </div>
          <div className={`px-2 py-1 rounded-md text-xs font-medium border ${getStatusColor(alert.status)}`}>
            {alert.status.replace('_', ' ').toUpperCase()}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <CardDescription className="text-base">
          {alert.description}
        </CardDescription>

        <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-md border border-red-200 dark:border-red-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-200">Impact</p>
              <p className="text-sm text-red-700 dark:text-red-300">{alert.impact}</p>
            </div>
          </div>
        </div>

        <div className="bg-orange-50 dark:bg-orange-950/20 p-3 rounded-md border border-orange-200 dark:border-orange-800">
          <div className="flex items-start gap-2">
            <Timer className="h-4 w-4 text-orange-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-orange-800 dark:text-orange-200">Urgency</p>
              <p className="text-sm text-orange-700 dark:text-orange-300">{alert.urgency}</p>
            </div>
          </div>
        </div>

        {alert.affectedSystems && alert.affectedSystems.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Affected Systems:</p>
            <div className="flex flex-wrap gap-1">
              {alert.affectedSystems.map((system, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  <Server className="h-3 w-3 mr-1" />
                  {system}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="flex gap-2">
            {alert.quickFix?.available && (
              <Button size="sm" variant="destructive">
                <Zap className="h-4 w-4 mr-1" />
                {alert.quickFix.action}
              </Button>
            )}
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => handleStatusUpdate('investigating')}
            >
              <Play className="h-4 w-4 mr-1" />
              Start Investigation
            </Button>
            {alert.documentationLinks && (
              <Button size="sm" variant="ghost">
                <FileCode className="h-4 w-4 mr-1" />
                View Docs
              </Button>
            )}
          </div>
          
          {alert.quickFix?.estimatedTime && (
            <span className="text-xs text-muted-foreground">
              ETA: {alert.quickFix.estimatedTime}
            </span>
          )}
        </div>

        {alert.emergencyContacts && (
          <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-md border border-blue-200 dark:border-blue-800">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">Emergency Contacts:</p>
            <div className="flex flex-wrap gap-2">
              {alert.emergencyContacts.map((contact, index) => (
                <span key={index} className="text-xs text-blue-700 dark:text-blue-300">
                  {contact}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ImmediateActionsPanel({ 
  alerts, 
  updateRecommendation 
}: { 
  alerts: CriticalAlert[]
  updateRecommendation: (id: string, status: string) => Promise<void>
}) {
  const immediateActions = alerts.filter(alert => alert.actionRequired && alert.status === 'active');
  
  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <Clock className="h-4 w-4" />
        <AlertTitle>Immediate Actions Required</AlertTitle>
        <AlertDescription>
          {immediateActions.length} critical issues require immediate attention to prevent system impact.
        </AlertDescription>
      </Alert>

      {immediateActions.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Immediate Actions Needed</h3>
            <p className="text-muted-foreground">All critical issues are being handled or resolved.</p>
          </CardContent>
        </Card>
      ) : (
        immediateActions.map((alert, index) => (
          <Card key={alert.id} className="border-orange-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">
                    {index + 1}
                  </span>
                  {alert.title}
                </CardTitle>
                <Badge variant="destructive">URGENT</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm">{alert.description}</p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Priority: {alert.severity.toUpperCase()}</span>
                  <span>Category: {alert.category.toUpperCase()}</span>
                  {alert.quickFix?.estimatedTime && (
                    <span>ETA: {alert.quickFix.estimatedTime}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  {alert.autoFixAvailable ? (
                    <Button size="sm" variant="destructive">
                      <Zap className="h-4 w-4 mr-1" />
                      Auto-Fix Now
                    </Button>
                  ) : (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => updateRecommendation(alert.id, 'investigating')}
                    >
                      <Wrench className="h-4 w-4 mr-1" />
                      Manual Fix Required
                    </Button>
                  )}
                  <Button size="sm" variant="ghost">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    View Details
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function LiveMonitoringPanel({ 
  alerts, 
  realtimeAlerts 
}: { 
  alerts: CriticalAlert[]
  realtimeAlerts: any[]
}) {
  return (
    <div className="space-y-4">
      <Alert>
        <Activity className="h-4 w-4" />
        <AlertTitle>Live Monitoring Status</AlertTitle>
        <AlertDescription>
          Real-time monitoring is active. New critical issues will appear here automatically.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-500" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Monitoring</span>
                <Badge variant="default">Active</Badge>
              </div>
              <div className="flex justify-between">
                <span>Critical Issues</span>
                <Badge variant={alerts.length > 0 ? "destructive" : "default"}>
                  {alerts.length}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Auto-Fix Enabled</span>
                <Badge variant="default">Yes</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-500" />
              Recent Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {realtimeAlerts.slice(0, 3).map((alert, index) => (
                <div key={index} className="text-sm p-2 bg-muted rounded">
                  <p className="font-medium">New critical issue detected</p>
                  <p className="text-muted-foreground">
                    {format(new Date(alert.timestamp || Date.now()), 'HH:mm:ss')}
                  </p>
                </div>
              ))}
              {realtimeAlerts.length === 0 && (
                <p className="text-sm text-muted-foreground">No recent alerts</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmergencyProceduresPanel() {
  const procedures = [
    {
      title: 'Security Incident Response',
      description: 'Steps to follow when security vulnerabilities are detected',
      steps: [
        'Immediately isolate affected systems',
        'Contact security team and CISO',
        'Apply emergency patches if available',
        'Document incident details',
        'Begin forensic analysis'
      ],
      contacts: ['security@company.com', 'ciso@company.com'],
      documentation: '/docs/security/incident-response'
    },
    {
      title: 'Performance Crisis Management',
      description: 'Response protocol for critical performance issues',
      steps: [
        'Enable monitoring and alerting',
        'Scale resources immediately',
        'Identify bottlenecks using APM tools',
        'Deploy performance fixes',
        'Monitor system recovery'
      ],
      contacts: ['platform@company.com', 'devops@company.com'],
      documentation: '/docs/performance/crisis-management'
    },
    {
      title: 'Production Outage Recovery',
      description: 'Steps for restoring service during outages',
      steps: [
        'Activate incident command center',
        'Assess scope and impact',
        'Implement immediate workarounds',
        'Deploy fixes to staging first',
        'Gradual production rollout'
      ],
      contacts: ['oncall@company.com', 'engineering@company.com'],
      documentation: '/docs/operations/outage-recovery'
    }
  ];

  return (
    <div className="space-y-4">
      <Alert>
        <Lock className="h-4 w-4" />
        <AlertTitle>Emergency Response Procedures</AlertTitle>
        <AlertDescription>
          Follow these standardized procedures during critical incidents.
        </AlertDescription>
      </Alert>

      {procedures.map((procedure, index) => (
        <Card key={index} className="border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg">{procedure.title}</CardTitle>
            <CardDescription>{procedure.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Response Steps:</p>
                <ol className="list-decimal list-inside space-y-1">
                  {procedure.steps.map((step, stepIndex) => (
                    <li key={stepIndex} className="text-sm text-muted-foreground">
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
              
              <div>
                <p className="text-sm font-medium mb-2">Emergency Contacts:</p>
                <div className="flex flex-wrap gap-2">
                  {procedure.contacts.map((contact, contactIndex) => (
                    <Badge key={contactIndex} variant="outline" className="text-xs">
                      {contact}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-between items-center pt-2 border-t">
                <Button size="sm" variant="outline">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  View Full Documentation
                </Button>
                <Button size="sm" variant="destructive">
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Initiate Procedure
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Helper functions
function mapCategoryToAlertCategory(category: string): 'security' | 'performance' | 'production' | 'data' {
  switch (category.toLowerCase()) {
    case 'security':
      return 'security';
    case 'performance':
      return 'performance';
    case 'reliability':
    case 'architecture':
      return 'production';
    default:
      return 'data';
  }
}

function mapStatusToAlertStatus(status: string): 'active' | 'investigating' | 'fixing' | 'resolved' {
  switch (status) {
    case 'pending':
      return 'active';
    case 'in_progress':
      return 'investigating';
    case 'completed':
      return 'resolved';
    default:
      return 'active';
  }
}

function generateEmergencyContacts(category: string): string[] {
  const contactMap: Record<string, string[]> = {
    'Security': ['security@company.com', 'ciso@company.com'],
    'Performance': ['platform@company.com', 'devops@company.com'],
    'Reliability': ['oncall@company.com', 'sre@company.com'],
    'Architecture': ['architect@company.com', 'engineering@company.com'],
    'Maintainability': ['team-lead@company.com', 'devops@company.com']
  };
  
  return contactMap[category] || ['support@company.com'];
}

function generateDocLinks(type: string): string[] {
  const docMap: Record<string, string[]> = {
    'security': ['/docs/security/guidelines', '/docs/security/incident-response'],
    'performance': ['/docs/performance/optimization', '/docs/performance/monitoring'],
    'code_quality': ['/docs/development/standards', '/docs/development/best-practices']
  };
  
  return docMap[type] || ['/docs/general/troubleshooting'];
}