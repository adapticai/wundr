'use client';

import React from 'react';
import { useAnalysis } from '@/lib/contexts/analysis-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  Clock,
  Users,
  Target,
  Zap,
  TrendingUp,
  Calendar,
  DollarSign,
  CheckCircle2,
  ArrowRight,
  Flame,
  Shield,
  Code,
  RefreshCw,
  Database,
} from 'lucide-react';
import { format, addDays, addWeeks } from 'date-fns';

interface HighPriorityIssue {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high';
  impact: {
    score: number;
    areas: string[];
    affectedFiles: number;
    estimatedDowntime?: string;
  };
  effort: {
    hours: number;
    complexity: 'low' | 'medium' | 'high';
    skillsRequired: string[];
  };
  timeline: {
    urgency: 'immediate' | 'this-week' | 'this-month';
    estimatedDuration: string;
    dependencies: string[];
  };
  category: 'security' | 'performance' | 'maintainability' | 'reliability';
}

interface QuickWin {
  id: string;
  title: string;
  description: string;
  effort: number; // hours
  impact: number; // 1-10 scale
  category: string;
  estimatedCompletion: string;
}

interface ResourceAllocation {
  role: string;
  hoursNeeded: number;
  priority: 'critical' | 'high' | 'medium';
  skills: string[];
}

export default function HighPriorityRecommendationsPage() {
  const { data, loading, error } = useAnalysis();

  // Generate high priority issues from analysis data
  const generateHighPriorityIssues = (): HighPriorityIssue[] => {
    if (!data) return [];

    const issues: HighPriorityIssue[] = [];

    // Critical duplicates
    const criticalDuplicates = data.duplicates.filter(d => d.severity === 'critical');
    if (criticalDuplicates.length > 0) {
      issues.push({
        id: 'critical-duplicates',
        title: `${criticalDuplicates.length} Critical Code Duplications`,
        description: 'Multiple identical code blocks detected that pose maintenance risks and increase technical debt.',
        severity: 'critical',
        impact: {
          score: 9,
          areas: ['Maintainability', 'Code Quality', 'Developer Productivity'],
          affectedFiles: criticalDuplicates.reduce((sum, d) => sum + d.files.length, 0),
        },
        effort: {
          hours: criticalDuplicates.length * 4,
          complexity: 'medium',
          skillsRequired: ['Refactoring', 'Architecture Design'],
        },
        timeline: {
          urgency: 'this-week',
          estimatedDuration: '1-2 weeks',
          dependencies: ['Code review approval', 'Test coverage'],
        },
        category: 'maintainability',
      });
    }

    // Circular dependencies
    if (data.summary.circularDependencies > 0) {
      issues.push({
        id: 'circular-dependencies',
        title: `${data.summary.circularDependencies} Circular Dependencies`,
        description: 'Circular imports detected that can cause runtime errors and make code difficult to test.',
        severity: 'high',
        impact: {
          score: 8,
          areas: ['Reliability', 'Testability', 'Build Process'],
          affectedFiles: data.summary.circularDependencies * 2,
          estimatedDowntime: '2-4 hours if not resolved',
        },
        effort: {
          hours: data.summary.circularDependencies * 6,
          complexity: 'high',
          skillsRequired: ['Architecture Design', 'Dependency Management'],
        },
        timeline: {
          urgency: 'immediate',
          estimatedDuration: '3-5 days',
          dependencies: ['Architecture review', 'Impact analysis'],
        },
        category: 'reliability',
      });
    }

    // High complexity entities
    const highComplexityEntities = data.entities.filter(e => (e.complexity || 0) > 15);
    if (highComplexityEntities.length > 0) {
      issues.push({
        id: 'high-complexity',
        title: `${highComplexityEntities.length} High Complexity Components`,
        description: 'Components with excessive complexity that are difficult to maintain and test.',
        severity: 'high',
        impact: {
          score: 7,
          areas: ['Maintainability', 'Testing', 'Bug Risk'],
          affectedFiles: highComplexityEntities.length,
        },
        effort: {
          hours: highComplexityEntities.length * 8,
          complexity: 'medium',
          skillsRequired: ['Refactoring', 'Unit Testing'],
        },
        timeline: {
          urgency: 'this-month',
          estimatedDuration: '2-3 weeks',
          dependencies: ['Refactoring strategy', 'Test coverage plan'],
        },
        category: 'maintainability',
      });
    }

    // Unused exports (potential dead code)
    if (data.summary.unusedExports > 10) {
      issues.push({
        id: 'unused-exports',
        title: `${data.summary.unusedExports} Unused Exports`,
        description: 'Large amount of unused code that increases bundle size and maintenance overhead.',
        severity: 'high',
        impact: {
          score: 6,
          areas: ['Performance', 'Bundle Size', 'Maintainability'],
          affectedFiles: Math.floor(data.summary.unusedExports / 2),
        },
        effort: {
          hours: 16,
          complexity: 'low',
          skillsRequired: ['Code Analysis', 'Impact Assessment'],
        },
        timeline: {
          urgency: 'this-month',
          estimatedDuration: '1 week',
          dependencies: ['Dead code analysis', 'Usage verification'],
        },
        category: 'performance',
      });
    }

    return issues;
  };

  const generateQuickWins = (): QuickWin[] => {
    if (!data) return [];

    const quickWins: QuickWin[] = [];

    // Remove unused imports
    quickWins.push({
      id: 'unused-imports',
      title: 'Remove Unused Imports',
      description: 'Automated cleanup of unused import statements',
      effort: 2,
      impact: 7,
      category: 'Code Quality',
      estimatedCompletion: '1 day',
    });

    // Format code consistently
    quickWins.push({
      id: 'code-formatting',
      title: 'Apply Consistent Code Formatting',
      description: 'Run prettier/eslint auto-fix across codebase',
      effort: 1,
      impact: 6,
      category: 'Developer Experience',
      estimatedCompletion: '2 hours',
    });

    // Add missing type annotations
    quickWins.push({
      id: 'type-annotations',
      title: 'Add Missing Type Annotations',
      description: 'Add explicit types where TypeScript inference is unclear',
      effort: 8,
      impact: 8,
      category: 'Type Safety',
      estimatedCompletion: '3 days',
    });

    // Update documentation
    quickWins.push({
      id: 'update-docs',
      title: 'Update Component Documentation',
      description: 'Add JSDoc comments to public APIs and components',
      effort: 6,
      impact: 7,
      category: 'Documentation',
      estimatedCompletion: '2 days',
    });

    return quickWins.sort((a, b) => (b.impact / b.effort) - (a.impact / a.effort));
  };

  const generateResourceAllocation = (issues: HighPriorityIssue[]): ResourceAllocation[] => {
    const allocations: ResourceAllocation[] = [];

    // Senior Developer for complex issues
    const complexIssues = issues.filter(i => i.effort.complexity === 'high');
    if (complexIssues.length > 0) {
      allocations.push({
        role: 'Senior Developer',
        hoursNeeded: complexIssues.reduce((sum, i) => sum + i.effort.hours, 0),
        priority: 'critical',
        skills: ['Architecture Design', 'Refactoring', 'System Design'],
      });
    }

    // Mid-level developers for medium complexity
    const mediumIssues = issues.filter(i => i.effort.complexity === 'medium');
    if (mediumIssues.length > 0) {
      allocations.push({
        role: 'Mid-level Developer',
        hoursNeeded: mediumIssues.reduce((sum, i) => sum + i.effort.hours, 0),
        priority: 'high',
        skills: ['Refactoring', 'Unit Testing', 'Code Review'],
      });
    }

    // Junior developers for simple tasks
    const simpleIssues = issues.filter(i => i.effort.complexity === 'low');
    if (simpleIssues.length > 0) {
      allocations.push({
        role: 'Junior Developer',
        hoursNeeded: simpleIssues.reduce((sum, i) => sum + i.effort.hours, 0),
        priority: 'medium',
        skills: ['Code Cleanup', 'Documentation', 'Testing'],
      });
    }

    // QA Engineer for testing
    allocations.push({
      role: 'QA Engineer',
      hoursNeeded: Math.floor(issues.reduce((sum, i) => sum + i.effort.hours, 0) * 0.3),
      priority: 'high',
      skills: ['Test Planning', 'Regression Testing', 'Quality Assurance'],
    });

    return allocations;
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="text-center">
          <p className="text-lg text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Database className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="text-xl font-semibold">No Analysis Data Available</h2>
          <p className="text-muted-foreground max-w-md">
            Upload an analysis report to view high priority recommendations
          </p>
        </div>
      </div>
    );
  }

  const highPriorityIssues = generateHighPriorityIssues();
  const quickWins = generateQuickWins();
  const resourceAllocations = generateResourceAllocation(highPriorityIssues);

  const totalEffort = highPriorityIssues.reduce((sum, issue) => sum + issue.effort.hours, 0);
  const criticalIssues = highPriorityIssues.filter(i => i.severity === 'critical').length;
  const immediateIssues = highPriorityIssues.filter(i => i.timeline.urgency === 'immediate').length;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Flame className="h-6 w-6 text-red-500" />
            High Priority Recommendations
          </h1>
          <p className="text-sm text-muted-foreground">
            Critical issues requiring immediate attention
          </p>
        </div>
        <Button variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh Analysis
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center p-4">
            <AlertTriangle className="h-8 w-8 text-red-500 mr-3" />
            <div>
              <p className="text-2xl font-bold">{criticalIssues}</p>
              <p className="text-xs text-muted-foreground">Critical Issues</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-4">
            <Clock className="h-8 w-8 text-orange-500 mr-3" />
            <div>
              <p className="text-2xl font-bold">{immediateIssues}</p>
              <p className="text-xs text-muted-foreground">Immediate Action</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-4">
            <Target className="h-8 w-8 text-blue-500 mr-3" />
            <div>
              <p className="text-2xl font-bold">{totalEffort}h</p>
              <p className="text-xs text-muted-foreground">Total Effort</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-4">
            <Zap className="h-8 w-8 text-green-500 mr-3" />
            <div>
              <p className="text-2xl font-bold">{quickWins.length}</p>
              <p className="text-xs text-muted-foreground">Quick Wins</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="issues" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="issues">Issues</TabsTrigger>
          <TabsTrigger value="impact">Impact</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="quick-wins">Quick Wins</TabsTrigger>
        </TabsList>

        {/* High Priority Issues */}
        <TabsContent value="issues" className="space-y-4">
          <div className="grid gap-4">
            {highPriorityIssues.map((issue) => (
              <Card key={issue.id} className="border-l-4 border-l-red-500">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{issue.title}</CardTitle>
                        <Badge variant={issue.severity === 'critical' ? 'destructive' : 'secondary'}>
                          {issue.severity}
                        </Badge>
                        <Badge variant="outline">{issue.category}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{issue.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {issue.timeline.urgency === 'immediate' && (
                        <Badge variant="destructive" className="animate-pulse">
                          <Clock className="w-3 h-3 mr-1" />
                          URGENT
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" />
                        Impact
                      </h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Score</span>
                          <Badge variant="outline">{issue.impact.score}/10</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Affects {issue.impact.affectedFiles} files
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {issue.impact.areas.map((area) => (
                            <Badge key={area} variant="secondary" className="text-xs">
                              {area}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        Effort
                      </h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Hours</span>
                          <Badge variant="outline">{issue.effort.hours}h</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Complexity</span>
                          <Badge 
                            variant={issue.effort.complexity === 'high' ? 'destructive' : 
                                   issue.effort.complexity === 'medium' ? 'secondary' : 'outline'}
                          >
                            {issue.effort.complexity}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {issue.effort.skillsRequired.map((skill) => (
                            <Badge key={skill} variant="secondary" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Timeline
                      </h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Duration</span>
                          <Badge variant="outline">{issue.timeline.estimatedDuration}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {issue.timeline.dependencies.length} dependencies
                        </div>
                        {issue.impact.estimatedDowntime && (
                          <div className="text-xs text-red-600 font-medium">
                            Risk: {issue.impact.estimatedDowntime}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Impact Assessment */}
        <TabsContent value="impact" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Impact by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {['maintainability', 'reliability', 'performance', 'security'].map((category) => {
                    const categoryIssues = highPriorityIssues.filter(i => i.category === category);
                    const totalImpact = categoryIssues.reduce((sum, i) => sum + i.impact.score, 0);
                    const maxPossibleImpact = categoryIssues.length * 10;
                    const percentage = maxPossibleImpact > 0 ? (totalImpact / maxPossibleImpact) * 100 : 0;
                    
                    return (
                      <div key={category}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium capitalize">{category}</span>
                          <span className="text-sm text-muted-foreground">
                            {categoryIssues.length} issues
                          </span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Risk Assessment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-red-500" />
                      <span className="font-medium">High Risk Issues</span>
                    </div>
                    <Badge variant="destructive">
                      {highPriorityIssues.filter(i => i.impact.score >= 8).length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-orange-500" />
                      <span className="font-medium">Time-Sensitive</span>
                    </div>
                    <Badge variant="secondary">
                      {highPriorityIssues.filter(i => i.timeline.urgency === 'immediate').length}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Code className="w-5 h-5 text-blue-500" />
                      <span className="font-medium">Files Affected</span>
                    </div>
                    <Badge variant="outline">
                      {highPriorityIssues.reduce((sum, i) => sum + i.impact.affectedFiles, 0)}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Resource Allocation */}
        <TabsContent value="resources" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Team Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {resourceAllocations.map((allocation, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{allocation.role}</h4>
                        <Badge variant={allocation.priority === 'critical' ? 'destructive' : 'secondary'}>
                          {allocation.priority}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mb-2">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span className="text-sm">{allocation.hoursNeeded}h</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          <span className="text-sm">
                            ~${(allocation.hoursNeeded * (allocation.role.includes('Senior') ? 150 : allocation.role.includes('Mid') ? 100 : 75)).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {allocation.skills.map((skill) => (
                          <Badge key={skill} variant="outline" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Budget Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center p-6 border rounded-lg">
                    <div className="text-3xl font-bold mb-2">
                      ${resourceAllocations.reduce((sum, a) => 
                        sum + (a.hoursNeeded * (a.role.includes('Senior') ? 150 : a.role.includes('Mid') ? 100 : 75)), 0
                      ).toLocaleString()}
                    </div>
                    <p className="text-sm text-muted-foreground">Total Estimated Cost</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Development</span>
                      <span className="text-sm font-medium">80%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">QA & Testing</span>
                      <span className="text-sm font-medium">15%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Project Management</span>
                      <span className="text-sm font-medium">5%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Timeline Recommendations */}
        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recommended Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Immediate (This Week) */}
                <div>
                  <h4 className="font-semibold text-red-600 mb-3 flex items-center gap-2">
                    <Flame className="w-4 h-4" />
                    Immediate (This Week)
                  </h4>
                  <div className="space-y-2 ml-6">
                    {highPriorityIssues
                      .filter(i => i.timeline.urgency === 'immediate')
                      .map((issue) => (
                        <div key={issue.id} className="flex items-center gap-2 p-2 border rounded">
                          <ArrowRight className="w-4 h-4 text-red-500" />
                          <span className="text-sm">{issue.title}</span>
                          <Badge variant="outline" className="ml-auto">
                            {issue.timeline.estimatedDuration}
                          </Badge>
                        </div>
                      ))}
                  </div>
                </div>

                {/* This Week */}
                <div>
                  <h4 className="font-semibold text-orange-600 mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    This Week
                  </h4>
                  <div className="space-y-2 ml-6">
                    {highPriorityIssues
                      .filter(i => i.timeline.urgency === 'this-week')
                      .map((issue) => (
                        <div key={issue.id} className="flex items-center gap-2 p-2 border rounded">
                          <ArrowRight className="w-4 h-4 text-orange-500" />
                          <span className="text-sm">{issue.title}</span>
                          <Badge variant="outline" className="ml-auto">
                            {issue.timeline.estimatedDuration}
                          </Badge>
                        </div>
                      ))}
                  </div>
                </div>

                {/* This Month */}
                <div>
                  <h4 className="font-semibold text-blue-600 mb-3 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    This Month
                  </h4>
                  <div className="space-y-2 ml-6">
                    {highPriorityIssues
                      .filter(i => i.timeline.urgency === 'this-month')
                      .map((issue) => (
                        <div key={issue.id} className="flex items-center gap-2 p-2 border rounded">
                          <ArrowRight className="w-4 h-4 text-blue-500" />
                          <span className="text-sm">{issue.title}</span>
                          <Badge variant="outline" className="ml-auto">
                            {issue.timeline.estimatedDuration}
                          </Badge>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Timeline Summary */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">Milestone Dates</h4>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="text-center p-3 border rounded">
                      <div className="font-semibold">{format(addDays(new Date(), 7), 'MMM dd')}</div>
                      <div className="text-xs text-muted-foreground">Critical fixes</div>
                    </div>
                    <div className="text-center p-3 border rounded">
                      <div className="font-semibold">{format(addWeeks(new Date(), 2), 'MMM dd')}</div>
                      <div className="text-xs text-muted-foreground">High priority items</div>
                    </div>
                    <div className="text-center p-3 border rounded">
                      <div className="font-semibold">{format(addWeeks(new Date(), 4), 'MMM dd')}</div>
                      <div className="text-xs text-muted-foreground">All recommendations</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quick Win Opportunities */}
        <TabsContent value="quick-wins" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-green-500" />
                Quick Win Opportunities
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                High-impact, low-effort improvements that can be implemented quickly
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {quickWins.map((win) => (
                  <div key={win.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold">{win.title}</h4>
                      <Badge variant="secondary">{win.category}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{win.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span className="text-sm">{win.effort}h</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-4 h-4" />
                          <span className="text-sm">{win.impact}/10</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Target className="w-4 h-4" />
                          <span className="text-sm">ROI: {(win.impact / win.effort).toFixed(1)}x</span>
                        </div>
                      </div>
                      <Badge variant="outline">{win.estimatedCompletion}</Badge>
                    </div>
                    <div className="mt-3">
                      <Button size="sm" className="w-full">
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Start Task
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}