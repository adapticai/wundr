'use client';

import { useAnalysis } from '@/lib/contexts/analysis-context';
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
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import Link from 'next/link';

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

interface ProductionRisk {
  id: string;
  title: string;
  riskLevel: 'critical' | 'high' | 'medium';
  probability: number;
  impact: string;
  mitigation: string;
  timeline: string;
  owner: string;
  status: 'monitoring' | 'mitigating' | 'resolved';
}

const getCriticalAlerts = (): CriticalAlert[] => [
  {
    id: 'crit-1',
    title: 'Security Vulnerability: SQL Injection Risk',
    description: 'Multiple database queries found without proper parameterization, exposing system to SQL injection attacks.',
    severity: 'emergency',
    category: 'security',
    impact: 'Data breach risk, potential full system compromise',
    urgency: 'Immediate action required - patch within 4 hours',
    detectedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    affectedSystems: ['Authentication Service', 'User Management', 'Payment Processing'],
    actionRequired: true,
    autoFixAvailable: true,
    dependencies: ['Database Migration', 'Code Review'],
    assignedTo: 'Security Team',
    status: 'investigating',
    quickFix: {
      available: true,
      action: 'Apply Security Patch',
      description: 'Automatically parameterize vulnerable queries',
      estimatedTime: '30 minutes'
    },
    emergencyContacts: ['security@company.com', 'ciso@company.com'],
    documentationLinks: ['/docs/security/sql-injection-prevention', '/docs/emergency-procedures']
  },
  {
    id: 'crit-2',
    title: 'Performance: Memory Leak in Production',
    description: 'Critical memory leak detected in user session management causing gradual performance degradation.',
    severity: 'critical',
    category: 'performance',
    impact: 'Progressive system slowdown, potential service outage in 6 hours',
    urgency: 'Fix required within 2 hours to prevent downtime',
    detectedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
    affectedSystems: ['Session Manager', 'Load Balancer', 'API Gateway'],
    estimatedDowntime: '15-30 minutes for patch deployment',
    actionRequired: true,
    autoFixAvailable: false,
    dependencies: ['Performance Testing', 'Deployment Pipeline'],
    assignedTo: 'Platform Team',
    status: 'fixing',
    quickFix: {
      available: false,
      action: 'Manual Code Fix',
      description: 'Requires code review and manual deployment',
      estimatedTime: '2 hours'
    },
    emergencyContacts: ['platform@company.com', 'devops@company.com']
  },
  {
    id: 'crit-3',
    title: 'Production: Database Connection Pool Exhaustion',
    description: 'Database connection pool approaching maximum capacity, causing connection timeouts.',
    severity: 'critical',
    category: 'production',
    impact: 'Service unavailability for new users, existing sessions at risk',
    urgency: 'Scale database connections immediately',
    detectedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
    affectedSystems: ['Primary Database', 'Read Replicas', 'Connection Pool'],
    actionRequired: true,
    autoFixAvailable: true,
    dependencies: ['Database Scaling', 'Configuration Update'],
    assignedTo: 'Database Team',
    status: 'active',
    quickFix: {
      available: true,
      action: 'Scale Connection Pool',
      description: 'Automatically increase pool size and add read replicas',
      estimatedTime: '10 minutes'
    },
    emergencyContacts: ['dba@company.com', 'oncall@company.com']
  },
  {
    id: 'crit-4',
    title: 'Data Integrity: Circular Dependency Corruption',
    description: 'Critical circular dependencies causing data inconsistency and potential corruption.',
    severity: 'high',
    category: 'data',
    impact: 'Data integrity compromised, audit trail inconsistent',
    urgency: 'Resolve within 4 hours to prevent data loss',
    detectedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
    affectedSystems: ['Order Management', 'Inventory System', 'Audit Service'],
    actionRequired: true,
    autoFixAvailable: false,
    dependencies: ['Data Validation', 'Schema Migration'],
    assignedTo: 'Data Team',
    status: 'investigating',
    emergencyContacts: ['data@company.com', 'compliance@company.com']
  }
];

const getProductionRisks = (): ProductionRisk[] => [
  {
    id: 'risk-1',
    title: 'High Code Complexity in Payment Service',
    riskLevel: 'critical',
    probability: 85,
    impact: 'Payment processing failures during high traffic',
    mitigation: 'Refactor complex functions, add circuit breakers',
    timeline: '2 weeks',
    owner: 'Payment Team',
    status: 'mitigating'
  },
  {
    id: 'risk-2',
    title: 'Unused Dependencies Creating Attack Surface',
    riskLevel: 'high',
    probability: 70,
    impact: 'Security vulnerabilities from unmaintained packages',
    mitigation: 'Remove unused dependencies, audit remaining packages',
    timeline: '1 week',
    owner: 'Security Team',
    status: 'monitoring'
  },
  {
    id: 'risk-3',
    title: 'Database Query Performance Degradation',
    riskLevel: 'critical',
    probability: 90,
    impact: 'User experience degradation, potential timeouts',
    mitigation: 'Optimize queries, add indexes, implement caching',
    timeline: '3 days',
    owner: 'Database Team',
    status: 'mitigating'
  }
];

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'emergency':
      return 'destructive';
    case 'critical':
      return 'destructive';
    case 'high':
      return 'warning';
    default:
      return 'default';
  }
};

const getSeverityIcon = (severity: string) => {
  switch (severity) {
    case 'emergency':
      return AlertTriangle;
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
  const { data, loading, error, loadSampleData } = useAnalysis();
  const [activeTab, setActiveTab] = useState('alerts');
  
  const criticalAlerts = useMemo(() => getCriticalAlerts(), []);
  const productionRisks = useMemo(() => getProductionRisks(), []);
  
  const emergencyAlerts = criticalAlerts.filter(alert => alert.severity === 'emergency');
  const criticalCount = criticalAlerts.filter(alert => alert.severity === 'critical').length;
  const activeIssues = criticalAlerts.filter(alert => alert.status === 'active').length;
  const autoFixAvailable = criticalAlerts.filter(alert => alert.autoFixAvailable).length;

  if (loading) {
    return (
      <div className='flex flex-1 flex-col gap-4 p-4'>
        <div className='flex items-center justify-between'>
          <h1 className='text-2xl font-bold'>Critical Recommendations</h1>
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
            Upload an analysis report or load sample data to view critical recommendations
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
          <h1 className='text-2xl font-bold text-red-600 dark:text-red-400'>
            Critical Recommendations Dashboard
          </h1>
          <p className='text-sm text-muted-foreground'>
            Urgent action required - Last updated: {format(new Date(), 'PPpp')}
          </p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' size='sm'>
            <RefreshCw className='mr-2 h-4 w-4' />
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
        <Alert variant="destructive" className="border-2 border-red-500">
          <AlertTriangle className="h-4 w-4" />
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
            <AlertTriangle className='h-4 w-4 text-red-500' />
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
            Critical Alerts
          </TabsTrigger>
          <TabsTrigger value="actions">Immediate Actions</TabsTrigger>
          <TabsTrigger value="risks">Production Risks</TabsTrigger>
          <TabsTrigger value="procedures">Emergency Procedures</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="space-y-4">
          <div className="space-y-4">
            {criticalAlerts.map((alert) => (
              <CriticalAlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <ImmediateActionsPanel alerts={criticalAlerts} />
        </TabsContent>

        <TabsContent value="risks" className="space-y-4">
          <ProductionRisksPanel risks={productionRisks} />
        </TabsContent>

        <TabsContent value="procedures" className="space-y-4">
          <EmergencyProceduresPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CriticalAlertCard({ alert }: { alert: CriticalAlert }) {
  const SeverityIcon = getSeverityIcon(alert.severity);
  const CategoryIcon = getCategoryIcon(alert.category);
  const timeAgo = format(new Date(alert.detectedAt), 'PPpp');

  return (
    <Card className={`relative ${alert.severity === 'emergency' ? 'border-red-500 border-2' : 'border-orange-200'}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <CategoryIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{alert.title}</CardTitle>
                <Badge variant={getSeverityColor(alert.severity) as 'destructive' | 'warning' | 'default'}>
                  <SeverityIcon className="h-3 w-3 mr-1" />
                  {alert.severity.toUpperCase()}
                </Badge>
                {alert.actionRequired && (
                  <Badge variant="destructive">ACTION REQUIRED</Badge>
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

        {alert.dependencies && alert.dependencies.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Dependencies:</p>
            <div className="flex flex-wrap gap-1">
              {alert.dependencies.map((dep, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {dep}
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
            <Button size="sm" variant="outline">
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

function ImmediateActionsPanel({ alerts }: { alerts: CriticalAlert[] }) {
  const immediateActions = alerts.filter(alert => alert.actionRequired);
  
  return (
    <div className="space-y-4">
      <Alert variant="warning">
        <Clock className="h-4 w-4" />
        <AlertTitle>Immediate Actions Required</AlertTitle>
        <AlertDescription>
          {immediateActions.length} issues require immediate attention to prevent system impact.
        </AlertDescription>
      </Alert>

      {immediateActions.map((alert, index) => (
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
                  <Button size="sm" variant="outline">
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
      ))}
    </div>
  );
}

function ProductionRisksPanel({ risks }: { risks: ProductionRisk[] }) {
  return (
    <div className="space-y-4">
      <Alert variant="warning">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Production Risk Assessment</AlertTitle>
        <AlertDescription>
          Monitor these critical risks that could impact production stability.
        </AlertDescription>
      </Alert>

      {risks.map((risk) => (
        <Card key={risk.id} className="border-yellow-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{risk.title}</CardTitle>
              <Badge variant={risk.riskLevel === 'critical' ? 'destructive' : 'default'}>
                {risk.riskLevel.toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Risk Probability</p>
                  <div className="flex items-center gap-2">
                    <Progress value={risk.probability} className="flex-1" />
                    <span className="text-sm font-medium">{risk.probability}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium">Timeline</p>
                  <p className="text-sm text-muted-foreground">{risk.timeline}</p>
                </div>
              </div>
              
              <div>
                <p className="text-sm font-medium">Impact</p>
                <p className="text-sm text-muted-foreground">{risk.impact}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium">Mitigation Strategy</p>
                <p className="text-sm text-muted-foreground">{risk.mitigation}</p>
              </div>
              
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Owner:</span>
                  <Badge variant="outline">{risk.owner}</Badge>
                </div>
                <div className={`px-2 py-1 rounded-md text-xs font-medium border ${getStatusColor(risk.status)}`}>
                  {risk.status.toUpperCase()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
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
      <Alert variant="info">
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