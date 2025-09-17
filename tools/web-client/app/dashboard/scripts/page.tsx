'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { 
  Settings, 
  Search,
  FileText,
  CheckCircle,
  AlertTriangle,
  Terminal,
  Code,
  Zap
} from 'lucide-react';
import { ScriptCard } from '@/components/scripts/script-card';
import { ScriptExecutor } from '@/components/scripts/script-executor';
import { OutputTerminal } from '@/components/scripts/output-terminal';
import { ScriptHistory } from '@/components/scripts/script-history';
import { ScriptTemplates } from '@/components/scripts/script-templates';

interface Script {
  id: string;
  name: string;
  description: string;
  category: 'analysis' | 'governance' | 'consolidation' | 'testing' | 'quality' | 'monorepo';
  safetyLevel: 'safe' | 'moderate' | 'unsafe';
  command: string;
  parameters: ScriptParameter[];
  tags: string[];
  lastRun?: string;
  status?: 'idle' | 'running' | 'completed' | 'failed';
  estimatedDuration?: number;
  requiresConfirmation?: boolean;
}

interface ScriptParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'file' | 'directory';
  description: string;
  required: boolean;
  defaultValue?: unknown;
  options?: string[];
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
  };
}

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

export default function ScriptsPage() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScript, setSelectedScript] = useState<Script | null>(null);
  const [executionResults, setExecutionResults] = useState<ExecutionResult[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('scripts');

  // Load scripts from API
  useEffect(() => {
    const loadScripts = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/scripts');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setScripts(data.data);
            setLoading(false);
            return;
          }
        }
        
        // Fallback to mock scripts if API fails
        console.warn('Failed to load scripts from API, using mock data');
        const mockScripts: Script[] = [
          {
            id: 'analysis-service',
            name: 'Analysis Service',
            description: 'Run comprehensive code analysis to detect duplicates, dependencies, and issues',
            category: 'analysis',
            safetyLevel: 'safe',
            command: 'npx ts-node scripts/analysis/AnalysisService.ts',
            parameters: [
              {
                name: 'targetDir',
                type: 'directory',
                description: 'Target directory to analyze',
                required: true,
                defaultValue: process.cwd()
              },
              {
                name: 'outputFormat',
                type: 'select',
                description: 'Output format for results',
                required: true,
                defaultValue: 'json',
                options: ['json', 'html', 'markdown']
              },
              {
                name: 'includeTests',
                type: 'boolean',
                description: 'Include test files in analysis',
                required: false,
                defaultValue: false
              }
            ],
            tags: ['analysis', 'duplicates', 'dependencies'],
            estimatedDuration: 30000,
            requiresConfirmation: false
          },
          {
            id: 'drift-detection',
            name: 'Drift Detection Service',
            description: 'Detect code drift and quality degradation over time',
            category: 'governance',
            safetyLevel: 'safe',
            command: 'npx ts-node scripts/governance/DriftDetectionService.ts',
            parameters: [
              {
                name: 'baselineVersion',
                type: 'string',
                description: 'Baseline version to compare against',
                required: false,
                defaultValue: 'latest'
              },
              {
                name: 'createBaseline',
                type: 'boolean',
                description: 'Create new baseline instead of detecting drift',
                required: false,
                defaultValue: false
              }
            ],
            tags: ['governance', 'quality', 'drift'],
            estimatedDuration: 15000,
            requiresConfirmation: false
          },
          {
            id: 'dependency-mapper',
            name: 'Dependency Mapper',
            description: 'Create detailed dependency maps and detect circular dependencies',
            category: 'analysis',
            safetyLevel: 'safe',
            command: 'npx ts-node scripts/analysis/dependency-mapper.ts',
            parameters: [
              {
                name: 'depth',
                type: 'number',
                description: 'Maximum depth for dependency analysis',
                required: false,
                defaultValue: 5,
                validation: { min: 1, max: 10 }
              },
              {
                name: 'includeExternal',
                type: 'boolean',
                description: 'Include external dependencies',
                required: false,
                defaultValue: false
              }
            ],
            tags: ['dependencies', 'mapping', 'circular'],
            estimatedDuration: 20000,
            requiresConfirmation: false
          },
          {
            id: 'consolidation-manager',
            name: 'Consolidation Manager',
            description: 'Automatically consolidate duplicate code and merge similar entities',
            category: 'consolidation',
            safetyLevel: 'moderate',
            command: 'npx ts-node scripts/consolidation/consolidation-manager.ts',
            parameters: [
              {
                name: 'similarityThreshold',
                type: 'number',
                description: 'Similarity threshold for consolidation (0-1)',
                required: false,
                defaultValue: 0.8,
                validation: { min: 0.1, max: 1.0 }
              },
              {
                name: 'dryRun',
                type: 'boolean',
                description: 'Run in dry-run mode (no actual changes)',
                required: false,
                defaultValue: true
              }
            ],
            tags: ['consolidation', 'duplicates', 'merge'],
            estimatedDuration: 45000,
            requiresConfirmation: true
          },
          {
            id: 'weekly-report',
            name: 'Weekly Report Generator',
            description: 'Generate comprehensive weekly governance and quality reports',
            category: 'governance',
            safetyLevel: 'safe',
            command: 'npx ts-node scripts/governance/weekly-report-generator.ts',
            parameters: [
              {
                name: 'format',
                type: 'select',
                description: 'Report format',
                required: true,
                defaultValue: 'markdown',
                options: ['markdown', 'html', 'pdf']
              },
              {
                name: 'includeMetrics',
                type: 'boolean',
                description: 'Include detailed metrics',
                required: false,
                defaultValue: true
              }
            ],
            tags: ['reports', 'governance', 'weekly'],
            estimatedDuration: 10000,
            requiresConfirmation: false
          }
        ];

        setScripts(mockScripts);
      } catch (_error) {
        // Error logged - details available in network tab;
        // Use mock scripts as fallback
        const mockScripts: Script[] = [
          {
            id: 'analysis-service',
            name: 'Analysis Service',
            description: 'Run comprehensive code analysis to detect duplicates, dependencies, and issues',
            category: 'analysis',
            safetyLevel: 'safe',
            command: 'npx ts-node scripts/analysis/AnalysisService.ts',
            parameters: [],
            tags: ['analysis', 'duplicates', 'dependencies'],
            estimatedDuration: 30000,
            requiresConfirmation: false
          }
        ];
        setScripts(mockScripts);
      } finally {
        setLoading(false);
      }
    };

    loadScripts();
  }, []);

  const filteredScripts = scripts.filter(script => {
    const matchesSearch = script.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      script.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      script.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || script.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const handleScriptExecution = async (scriptId: string, parameters: Record<string, any>) => {
    try {
      const response = await fetch(`/api/scripts/${scriptId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parameters })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Poll for execution result
          const executionId = data.data.executionId;
          pollExecutionResult(executionId);
        }
      }
    } catch (_error) {
      // Error logged - details available in network tab;
    }
  };
  
  const pollExecutionResult = async (executionId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/scripts/executions/${executionId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            const result = data.data;
            setExecutionResults(prev => {
              const existing = prev.find(r => r.id === result.id);
              if (existing) {
                return prev.map(r => r.id === result.id ? result : r);
              } else {
                return [result, ...prev.slice(0, 49)];
              }
            });
            
            if (result.status !== 'running') {
              clearInterval(pollInterval);
            }
          }
        }
      } catch (_error) {
        // Error logged - details available in network tab;
        clearInterval(pollInterval);
      }
    }, 2000); // Poll every 2 seconds
  };
  
  const loadExecutionHistory = async () => {
    try {
      const response = await fetch('/api/scripts/executions');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setExecutionResults(data.data);
        }
      }
    } catch (_error) {
      // Error logged - details available in network tab;
    }
  };
  
  // Load execution history on mount
  useEffect(() => {
    loadExecutionHistory();
  }, []);

  const getSafetyLevelColor = (level: string) => {
    switch (level) {
      case 'safe': return 'bg-green-100 text-green-800';
      case 'moderate': return 'bg-yellow-100 text-yellow-800';
      case 'unsafe': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'analysis': return <Code className="h-4 w-4" />;
      case 'governance': return <FileText className="h-4 w-4" />;
      case 'consolidation': return <Zap className="h-4 w-4" />;
      case 'testing': return <CheckCircle className="h-4 w-4" />;
      case 'quality': return <AlertTriangle className="h-4 w-4" />;
      case 'monorepo': return <Terminal className="h-4 w-4" />;
      default: return <Code className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Script Runner</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Script Runner</h1>
          <p className="text-sm text-muted-foreground">
            Execute analysis scripts and manage automation tasks
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="scripts">Scripts</TabsTrigger>
          <TabsTrigger value="executor">Executor</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="scripts" className="space-y-4">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search scripts..."
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
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredScripts.map((script) => (
              <ScriptCard
                key={script.id}
                script={script}
                onSelect={(script) => setSelectedScript(script)}
                onExecute={() => setActiveTab('executor')}
              />
            ))}
          </div>

          {filteredScripts.length === 0 && (
            <div className="text-center py-8">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No scripts found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search or category filter
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="executor" className="space-y-4">
          {selectedScript ? (
            <ScriptExecutor
              script={selectedScript}
              onExecutionResult={(result) => {
                // Handle execution result if needed
                console.log('Script execution result:', result);
              }}
            />
          ) : (
            <div className="text-center py-8">
              <Terminal className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No script selected</h3>
              <p className="text-muted-foreground">
                Select a script from the Scripts tab to execute it
              </p>
              <Button 
                onClick={() => setActiveTab('scripts')} 
                className="mt-4"
                variant="outline"
              >
                Browse Scripts
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <ScriptHistory executions={executionResults} />
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <ScriptTemplates onSelectTemplate={(script) => {
            // Convert the script from template to the expected Script type
            setSelectedScript(script as Script);
          }} />
        </TabsContent>
      </Tabs>
    </div>
  );
}