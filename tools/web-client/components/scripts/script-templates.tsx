'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  FileText, 
  Code, 
  Zap, 
  TestTube,
  Settings,
  Database,
  Search,
  Plus,
  Copy,
  Star,
  Clock,
  Tag
} from 'lucide-react';

interface ScriptTemplate {
  id: string;
  name: string;
  description: string;
  category: 'analysis' | 'governance' | 'consolidation' | 'testing' | 'quality' | 'monorepo' | 'custom';
  command: string;
  parameters: TemplateParameter[];
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  isPopular?: boolean;
  usageCount?: number;
}

interface TemplateParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'file' | 'directory';
  description: string;
  required: boolean;
  defaultValue?: unknown;
  options?: string[];
}

interface ScriptTemplatesProps {
  onSelectTemplate: (script: ScriptFromTemplate) => void;
}

interface ScriptFromTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  safetyLevel: 'safe' | 'moderate' | 'unsafe';
  command: string;
  parameters: TemplateParameter[];
  tags: string[];
  estimatedDuration: number;
  requiresConfirmation: boolean;
}

export function ScriptTemplates({ onSelectTemplate }: ScriptTemplatesProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');

  // Sample templates
  const templates: ScriptTemplate[] = [
    {
      id: 'basic-analysis',
      name: 'Basic Code Analysis',
      description: 'Simple code analysis to detect basic issues and get project overview',
      category: 'analysis',
      command: 'npx ts-node scripts/analysis/AnalysisService.ts',
      parameters: [
        {
          name: 'targetDir',
          type: 'directory',
          description: 'Directory to analyze',
          required: true,
          defaultValue: '.'
        },
        {
          name: 'includeTests',
          type: 'boolean',
          description: 'Include test files',
          required: false,
          defaultValue: false
        }
      ],
      tags: ['analysis', 'overview', 'basic'],
      difficulty: 'beginner',
      estimatedTime: '2-5 minutes',
      isPopular: true,
      usageCount: 156
    },
    {
      id: 'comprehensive-analysis',
      name: 'Comprehensive Analysis Suite',
      description: 'Full analysis including duplicates, dependencies, and quality metrics',
      category: 'analysis',
      command: 'npm run analysis:full',
      parameters: [
        {
          name: 'targetDir',
          type: 'directory',
          description: 'Target directory',
          required: true,
          defaultValue: '.'
        },
        {
          name: 'outputFormat',
          type: 'select',
          description: 'Output format',
          required: true,
          defaultValue: 'json',
          options: ['json', 'html', 'markdown']
        },
        {
          name: 'depth',
          type: 'number',
          description: 'Analysis depth',
          required: false,
          defaultValue: 3
        }
      ],
      tags: ['analysis', 'comprehensive', 'quality'],
      difficulty: 'intermediate',
      estimatedTime: '5-15 minutes',
      isPopular: true,
      usageCount: 89
    },
    {
      id: 'dependency-check',
      name: 'Dependency Health Check',
      description: 'Analyze project dependencies and detect circular references',
      category: 'analysis',
      command: 'npx ts-node scripts/analysis/dependency-mapper.ts',
      parameters: [
        {
          name: 'includeExternal',
          type: 'boolean',
          description: 'Include external dependencies',
          required: false,
          defaultValue: false
        },
        {
          name: 'maxDepth',
          type: 'number',
          description: 'Maximum dependency depth',
          required: false,
          defaultValue: 5
        }
      ],
      tags: ['dependencies', 'circular', 'health'],
      difficulty: 'beginner',
      estimatedTime: '1-3 minutes',
      usageCount: 73
    },
    {
      id: 'quality-baseline',
      name: 'Quality Baseline Creation',
      description: 'Create a quality baseline for drift detection and monitoring',
      category: 'governance',
      command: 'npx ts-node scripts/governance/DriftDetectionService.ts',
      parameters: [
        {
          name: 'version',
          type: 'string',
          description: 'Baseline version name',
          required: true,
          defaultValue: 'latest'
        },
        {
          name: 'createBaseline',
          type: 'boolean',
          description: 'Create new baseline',
          required: true,
          defaultValue: true
        }
      ],
      tags: ['governance', 'baseline', 'quality'],
      difficulty: 'intermediate',
      estimatedTime: '3-8 minutes',
      usageCount: 45
    },
    {
      id: 'duplicate-consolidation',
      name: 'Duplicate Code Consolidation',
      description: 'Find and consolidate duplicate code patterns automatically',
      category: 'consolidation',
      command: 'npx ts-node scripts/consolidation/consolidation-manager.ts',
      parameters: [
        {
          name: 'similarityThreshold',
          type: 'number',
          description: 'Similarity threshold (0-1)',
          required: false,
          defaultValue: 0.8
        },
        {
          name: 'dryRun',
          type: 'boolean',
          description: 'Dry run mode (no changes)',
          required: false,
          defaultValue: true
        },
        {
          name: 'targetPatterns',
          type: 'string',
          description: 'File patterns to include',
          required: false,
          defaultValue: '**/*.{ts,tsx,js,jsx}'
        }
      ],
      tags: ['consolidation', 'duplicates', 'refactoring'],
      difficulty: 'advanced',
      estimatedTime: '10-30 minutes',
      usageCount: 32
    },
    {
      id: 'test-coverage',
      name: 'Test Coverage Analysis',
      description: 'Analyze test coverage and identify untested code',
      category: 'testing',
      command: 'npm run test:coverage',
      parameters: [
        {
          name: 'threshold',
          type: 'number',
          description: 'Coverage threshold percentage',
          required: false,
          defaultValue: 80
        },
        {
          name: 'outputFormat',
          type: 'select',
          description: 'Report format',
          required: false,
          defaultValue: 'lcov',
          options: ['lcov', 'text', 'html', 'json']
        }
      ],
      tags: ['testing', 'coverage', 'quality'],
      difficulty: 'beginner',
      estimatedTime: '2-5 minutes',
      usageCount: 67
    },
    {
      id: 'monorepo-health',
      name: 'Monorepo Health Report',
      description: 'Generate comprehensive health report for monorepo structure',
      category: 'monorepo',
      command: 'npx ts-node scripts/monorepo/health-check.ts',
      parameters: [
        {
          name: 'includeWorkspaces',
          type: 'boolean',
          description: 'Include workspace analysis',
          required: false,
          defaultValue: true
        },
        {
          name: 'checkDependencies',
          type: 'boolean',
          description: 'Check cross-workspace dependencies',
          required: false,
          defaultValue: true
        }
      ],
      tags: ['monorepo', 'health', 'workspaces'],
      difficulty: 'intermediate',
      estimatedTime: '5-10 minutes',
      usageCount: 28
    },
    {
      id: 'performance-audit',
      name: 'Performance Audit',
      description: 'Audit code for performance issues and optimization opportunities',
      category: 'quality',
      command: 'npx ts-node scripts/quality/performance-audit.ts',
      parameters: [
        {
          name: 'auditLevel',
          type: 'select',
          description: 'Audit thoroughness level',
          required: false,
          defaultValue: 'standard',
          options: ['basic', 'standard', 'thorough']
        },
        {
          name: 'includeAssets',
          type: 'boolean',
          description: 'Include asset analysis',
          required: false,
          defaultValue: false
        }
      ],
      tags: ['performance', 'optimization', 'audit'],
      difficulty: 'advanced',
      estimatedTime: '15-45 minutes',
      usageCount: 19
    }
  ];

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'analysis': return <Code className="h-4 w-4" />;
      case 'governance': return <FileText className="h-4 w-4" />;
      case 'consolidation': return <Zap className="h-4 w-4" />;
      case 'testing': return <TestTube className="h-4 w-4" />;
      case 'quality': return <Settings className="h-4 w-4" />;
      case 'monorepo': return <Database className="h-4 w-4" />;
      default: return <Code className="h-4 w-4" />;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleUseTemplate = (template: ScriptTemplate) => {
    // Convert template to script format
    const script: ScriptFromTemplate = {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      safetyLevel: template.difficulty === 'advanced' ? 'moderate' : 'safe',
      command: template.command,
      parameters: template.parameters,
      tags: template.tags,
      estimatedDuration: template.estimatedTime.includes('minutes') ? 
        parseInt(template.estimatedTime) * 60000 : 30000,
      requiresConfirmation: template.difficulty === 'advanced'
    };
    
    onSelectTemplate(script);
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchesDifficulty = selectedDifficulty === 'all' || template.difficulty === selectedDifficulty;
    
    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  // Sort by popularity
  const sortedTemplates = filteredTemplates.sort((a, b) => {
    if (a.isPopular && !b.isPopular) return -1;
    if (!a.isPopular && b.isPopular) return 1;
    return (b.usageCount || 0) - (a.usageCount || 0);
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Script Templates
          </CardTitle>
          <CardDescription>
            Pre-configured script templates for common analysis and maintenance tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="all">All Categories</option>
              <option value="analysis">Analysis</option>
              <option value="governance">Governance</option>
              <option value="consolidation">Consolidation</option>
              <option value="testing">Testing</option>
              <option value="quality">Quality</option>
              <option value="monorepo">Monorepo</option>
            </select>
            
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="all">All Levels</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Templates Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sortedTemplates.map((template) => (
          <Card key={template.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {getCategoryIcon(template.category)}
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  {template.isPopular && (
                    <Star className="h-4 w-4 text-yellow-500 fill-current" />
                  )}
                </div>
                <Badge className={getDifficultyColor(template.difficulty)}>
                  {template.difficulty}
                </Badge>
              </div>
              <CardDescription className="text-sm">
                {template.description}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Tags */}
              <div className="flex flex-wrap gap-1">
                {template.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    <Tag className="h-3 w-3 mr-1" />
                    {tag}
                  </Badge>
                ))}
                {template.tags.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{template.tags.length - 3}
                  </Badge>
                )}
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {template.estimatedTime}
                </div>
                {template.usageCount && (
                  <div>
                    Used {template.usageCount} times
                  </div>
                )}
              </div>

              {/* Parameters preview */}
              <div className="text-xs text-muted-foreground">
                {template.parameters.length} parameter{template.parameters.length !== 1 ? 's' : ''}
                {template.parameters.length > 0 && (
                  <span>: {template.parameters.map(p => p.name).join(', ')}</span>
                )}
              </div>

              {/* Command preview */}
              <div className="text-xs text-muted-foreground bg-muted p-2 rounded font-mono">
                {template.command.length > 40 
                  ? `${template.command.substring(0, 40)}...` 
                  : template.command
                }
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={() => handleUseTemplate(template)}
                  className="flex-1"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Use Template
                </Button>
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(template.command);
                    // Could show toast notification
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* No results */}
      {filteredTemplates.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Search className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No Templates Found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search or filter criteria.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Popular Templates Section */}
      {searchTerm === '' && selectedCategory === 'all' && selectedDifficulty === 'all' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Popular Templates
            </CardTitle>
            <CardDescription>
              Most frequently used templates by the community
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {templates
                .filter(t => t.isPopular)
                .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
                .slice(0, 3)
                .map((template) => (
                  <div 
                    key={template.id}
                    className="flex items-center justify-between p-2 rounded border hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleUseTemplate(template)}
                  >
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(template.category)}
                      <span className="font-medium">{template.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {template.difficulty}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {template.usageCount} uses
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}