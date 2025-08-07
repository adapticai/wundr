'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Play, 
  Square, 
  Download, 
  Save, 
  Upload,
  AlertTriangle,
  CheckCircle,
  Clock,
  Terminal,
  Loader2
} from 'lucide-react';
import { ParameterForm } from './parameter-form';
import { OutputTerminal } from './output-terminal';

interface Script {
  id: string;
  name: string;
  description: string;
  category: string;
  safetyLevel: 'safe' | 'moderate' | 'unsafe';
  command: string;
  parameters: ScriptParameter[];
  tags: string[];
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

interface ScriptExecutorProps {
  script: Script;
  onExecutionResult: (result: ExecutionResult) => void;
}

export function ScriptExecutor({ script, onExecutionResult }: ScriptExecutorProps) {
  const [parameters, setParameters] = useState<Record<string, unknown>>({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [output, setOutput] = useState('');
  const [errorOutput, setErrorOutput] = useState('');
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [progress, setProgress] = useState(0);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [savedConfigs, setSavedConfigs] = useState<Array<Record<string, unknown>>>([]);
  const [activeTab, setActiveTab] = useState('parameters');

  const abortControllerRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize parameters with default values
  useEffect(() => {
    const defaultParams: Record<string, unknown> = {};
    script.parameters.forEach(param => {
      if (param.defaultValue !== undefined) {
        defaultParams[param.name] = param.defaultValue;
      }
    });
    setParameters(defaultParams);
  }, [script]);

  // Load saved configurations
  useEffect(() => {
    const saved = localStorage.getItem(`script-configs-${script.id}`);
    if (saved) {
      try {
        setSavedConfigs(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to load saved configurations:', error);
      }
    }
  }, [script.id]);

  const validateParameters = (): string[] => {
    const errors: string[] = [];
    
    script.parameters.forEach(param => {
      const value = parameters[param.name];
      
      if (param.required && (value === undefined || value === '')) {
        errors.push(`${param.name} is required`);
      }
      
      if (value !== undefined && param.validation) {
        const validation = param.validation;
        
        if (param.type === 'number') {
          const numValue = Number(value);
          if (validation.min !== undefined && numValue < validation.min) {
            errors.push(`${param.name} must be at least ${validation.min}`);
          }
          if (validation.max !== undefined && numValue > validation.max) {
            errors.push(`${param.name} must be at most ${validation.max}`);
          }
        }
        
        if (param.type === 'string' && validation.pattern) {
          const regex = new RegExp(validation.pattern);
          if (!regex.test(String(value))) {
            errors.push(`${param.name} format is invalid`);
          }
        }
      }
    });
    
    return errors;
  };

  const buildCommand = (): string => {
    let command = script.command;
    
    // Replace parameter placeholders
    Object.entries(parameters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        command += ` --${key}="${value}"`;
      }
    });
    
    return command;
  };

  const executeScript = async () => {
    const errors = validateParameters();
    if (errors.length > 0) {
      alert(`Parameter validation failed:\n${errors.join('\n')}`);
      return;
    }

    if (script.requiresConfirmation && !showConfirmation) {
      setShowConfirmation(true);
      return;
    }

    setShowConfirmation(false);
    setIsExecuting(true);
    setOutput('');
    setErrorOutput('');
    setProgress(0);
    setStartTime(new Date());
    
    const execId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setExecutionId(execId);

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    const result: ExecutionResult = {
      id: execId,
      scriptId: script.id,
      scriptName: script.name,
      startTime: new Date().toISOString(),
      status: 'running',
      output: '',
      errorOutput: '',
      parameters: { ...parameters }
    };

    try {
      // Simulate script execution (in real implementation, this would call backend API)
      const command = buildCommand();
      setOutput(`Executing: ${command}\n\n`);

      // Progress simulation
      const totalSteps = 10;
      let currentStep = 0;
      
      intervalRef.current = setInterval(() => {
        if (currentStep < totalSteps) {
          currentStep++;
          setProgress((currentStep / totalSteps) * 100);
          
          // Simulate output
          const messages = [
            'Initializing analysis...',
            'Scanning files...',
            'Processing TypeScript files...',
            'Analyzing dependencies...',
            'Detecting duplicates...',
            'Calculating metrics...',
            'Generating report...',
            'Saving results...',
            'Cleaning up...',
            'Analysis complete!'
          ];
          
          if (messages[currentStep - 1]) {
            setOutput(prev => prev + `[${new Date().toLocaleTimeString()}] ${messages[currentStep - 1]}\n`);
          }
        } else {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          
          // Complete execution
          result.status = 'completed';
          result.endTime = new Date().toISOString();
          result.exitCode = 0;
          result.duration = Date.now() - (startTime?.getTime() || Date.now());
          result.output = output + '\n✅ Script executed successfully!';
          
          setOutput(prev => prev + '\n✅ Script executed successfully!');
          setIsExecuting(false);
          setProgress(100);
          
          onExecutionResult(result);
        }
      }, script.estimatedDuration ? script.estimatedDuration / totalSteps : 2000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setErrorOutput(errorMessage);
      
      result.status = 'failed';
      result.endTime = new Date().toISOString();
      result.errorOutput = errorMessage;
      result.duration = Date.now() - (startTime?.getTime() || Date.now());
      
      setIsExecuting(false);
      onExecutionResult(result);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
  };

  const cancelExecution = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    setIsExecuting(false);
    setProgress(0);
    
    if (executionId) {
      const result: ExecutionResult = {
        id: executionId,
        scriptId: script.id,
        scriptName: script.name,
        startTime: startTime?.toISOString() || new Date().toISOString(),
        endTime: new Date().toISOString(),
        status: 'cancelled',
        output: output + '\n⚠️ Script execution cancelled',
        errorOutput: 'Execution cancelled by user',
        duration: startTime ? Date.now() - startTime.getTime() : 0,
        parameters: { ...parameters }
      };
      
      onExecutionResult(result);
    }
  };

  const saveConfiguration = () => {
    const configName = prompt('Enter configuration name:');
    if (configName) {
      const newConfig = {
        name: configName,
        parameters: { ...parameters },
        createdAt: new Date().toISOString()
      };
      
      const updated = [...savedConfigs, newConfig];
      setSavedConfigs(updated);
      localStorage.setItem(`script-configs-${script.id}`, JSON.stringify(updated));
    }
  };

  const loadConfiguration = (config: Record<string, unknown>) => {
    setParameters({ ...(config.parameters as Record<string, unknown>) });
  };

  const downloadOutput = () => {
    const content = `Script: ${script.name}
Executed: ${startTime?.toISOString()}
Parameters: ${JSON.stringify(parameters, null, 2)}

=== OUTPUT ===
${output}

=== ERRORS ===
${errorOutput}
`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${script.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getSafetyLevelColor = (level: string) => {
    switch (level) {
      case 'safe': return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'moderate': return 'bg-amber-500/10 text-amber-700 dark:text-amber-400';
      case 'unsafe': return 'bg-destructive/10 text-destructive';
      default: return 'bg-accent/10 text-accent';
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Script Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                {script.name}
              </CardTitle>
              <CardDescription>{script.description}</CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge className={getSafetyLevelColor(script.safetyLevel)}>
                {script.safetyLevel}
              </Badge>
              <Badge variant="outline">{script.category}</Badge>
            </div>
          </div>
          
          {script.estimatedDuration && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Estimated duration: {Math.round(script.estimatedDuration / 1000)}s
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Confirmation Dialog */}
      {showConfirmation && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-5 w-5" />
              Confirmation Required
            </CardTitle>
            <CardDescription className="text-amber-700">
              This script requires confirmation before execution. Please review the parameters and confirm you want to proceed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button onClick={executeScript}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirm & Execute
              </Button>
              <Button variant="outline" onClick={() => setShowConfirmation(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="parameters">Parameters</TabsTrigger>
          <TabsTrigger value="output">Output</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="parameters" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <ParameterForm
                parameters={script.parameters}
                values={parameters}
                onChange={setParameters}
                disabled={isExecuting}
              />
            </div>
            
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button 
                    onClick={executeScript}
                    disabled={isExecuting}
                    className="w-full"
                  >
                    {isExecuting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Execute Script
                      </>
                    )}
                  </Button>
                  
                  {isExecuting && (
                    <Button 
                      onClick={cancelExecution}
                      variant="destructive"
                      className="w-full"
                    >
                      <Square className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  )}
                  
                  <Button 
                    onClick={saveConfiguration}
                    variant="outline"
                    className="w-full"
                    disabled={isExecuting}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Config
                  </Button>
                </CardContent>
              </Card>
              
              {savedConfigs.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Saved Configurations</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {savedConfigs.map((config, index) => (
                      <Button
                        key={index}
                        onClick={() => loadConfiguration(config)}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        disabled={isExecuting}
                      >
                        <Upload className="h-3 w-3 mr-2" />
                        {String(config.name)}
                      </Button>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="output" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Execution Output</h3>
            <div className="flex gap-2">
              {(output || errorOutput) && (
                <Button 
                  onClick={downloadOutput}
                  variant="outline"
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              )}
            </div>
          </div>
          
          {isExecuting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}
          
          <OutputTerminal
            output={output}
            errorOutput={errorOutput}
            isRunning={isExecuting}
          />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Script Settings</CardTitle>
              <CardDescription>
                Configure execution preferences and security settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Timeout (seconds)</label>
                  <Input 
                    type="number" 
                    defaultValue="300"
                    min="10"
                    max="3600"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Max Memory (MB)</label>
                  <Input 
                    type="number" 
                    defaultValue="512"
                    min="128"
                    max="2048"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input type="checkbox" defaultChecked />
                  <span className="text-sm">Enable real-time output</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" defaultChecked />
                  <span className="text-sm">Save execution logs</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" />
                  <span className="text-sm">Auto-download results</span>
                </label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}