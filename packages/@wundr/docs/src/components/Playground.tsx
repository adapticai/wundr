import React, { useState, useEffect } from 'react';
import { Editor } from '@monaco-editor/react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';

interface AnalysisResult {
  success: boolean;
  data?: {
    issues: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
      line?: number;
      suggestion?: string;
    }>;
    metrics: {
      complexity: number;
      maintainability: number;
      duplicates: number;
    };
    patterns: string[];
  };
  error?: string;
}

const defaultCode = `// Try pasting your code here to see Wundr analysis in action
import React, { useState } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
}

// This component has some issues Wundr will detect
export const UserList = ({ users }: { users: User[] }) => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Potential issue: No error handling
  const handleUserClick = (user: User) => {
    setSelectedUser(user);
    console.log('Selected user:', user); // TODO: remove debug log
  };
  
  // Potential issue: Inline styling should be extracted
  const userListStyle = {
    padding: '20px',
    backgroundColor: '#f0f0f0',
    borderRadius: '8px'
  };
  
  return (
    <div style={userListStyle}>
      <h2>User List</h2>
      {users.map((user) => (
        <div 
          key={user.id} 
          onClick={() => handleUserClick(user)}
          style={{
            padding: '10px',
            cursor: 'pointer',
            borderBottom: '1px solid #ccc'
          }}
        >
          <strong>{user.name}</strong>
          <br />
          <span>{user.email}</span>
        </div>
      ))}
      
      {/* Duplicate logic - should be extracted */}
      {selectedUser && (
        <div>
          <h3>Selected User</h3>
          <p><strong>{selectedUser.name}</strong></p>
          <p>{selectedUser.email}</p>
        </div>
      )}
    </div>
  );
};

// Duplicate interface - Wundr will flag this
interface UserData {
  id: string;
  name: string;
  email: string;
}`;

const exampleTemplates = [
  {
    id: 'react-component',
    name: 'React Component',
    description: 'A React component with common issues',
    code: defaultCode
  },
  {
    id: 'node-service',
    name: 'Node.js Service',
    description: 'A backend service with patterns to analyze',
    code: `// Node.js service example
const express = require('express');
const fs = require('fs');

class UserService {
  constructor() {
    this.users = [];
  }

  // Issue: No error handling
  async getUsers() {
    return this.users;
  }

  // Issue: Synchronous file operation
  saveToFile(filename) {
    fs.writeFileSync(filename, JSON.stringify(this.users));
  }

  // Duplicate logic
  async getUserById(id) {
    return this.users.find(user => user.id === id);
  }

  // More duplicate logic
  async findUserById(id) {
    return this.users.find(user => user.id === id);
  }
}

// Issue: Global variable
let globalUserService = new UserService();

module.exports = { UserService, globalUserService };`
  },
  {
    id: 'typescript-util',
    name: 'TypeScript Utility',
    description: 'Utility functions with type issues',
    code: `// TypeScript utility with issues
import { promises as fs } from 'fs';

// Issue: Any type usage
export const processData = (data: any): any => {
  return data.map((item: any) => {
    return {
      ...item,
      processed: true
    };
  });
};

// Issue: No error handling
export const readConfigFile = async (path: string) => {
  const content = await fs.readFile(path, 'utf-8');
  return JSON.parse(content);
};

// Issue: Duplicate logic
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Issue: Complex function that should be split
export const complexProcessor = (data: any[], options: any) => {
  let result = [];
  for (let i = 0; i < data.length; i++) {
    if (data[i].type === 'user') {
      if (options.includeUsers) {
        if (data[i].active) {
          result.push({
            id: data[i].id,
            name: data[i].name,
            email: data[i].email,
            status: 'active'
          });
        }
      }
    } else if (data[i].type === 'admin') {
      if (options.includeAdmins) {
        result.push({
          id: data[i].id,
          name: data[i].name,
          role: 'admin'
        });
      }
    }
  }
  return result;
};`
  }
];

export const Playground: React.FC = () => {
  const [code, setCode] = useState(defaultCode);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('react-component');

  const analyzeCode = async () => {
    setIsAnalyzing(true);
    
    try {
      // Simulate API call to Wundr analysis endpoint
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock analysis results based on code content
      const mockAnalysis: AnalysisResult = {
        success: true,
        data: {
          issues: [
            {
              type: 'code_smell',
              severity: 'medium',
              message: 'Inline styles should be extracted to CSS modules or styled-components',
              line: 19,
              suggestion: 'Consider using CSS modules or a styling library'
            },
            {
              type: 'duplication',
              severity: 'high',
              message: 'Duplicate interface definition detected',
              line: 52,
              suggestion: 'Remove duplicate interface and reuse existing User interface'
            },
            {
              type: 'maintainability',
              severity: 'low',
              message: 'Console.log should be removed from production code',
              line: 14,
              suggestion: 'Use a proper logging library or remove debug statements'
            },
            {
              type: 'performance',
              severity: 'medium',
              message: 'Component could benefit from memoization',
              suggestion: 'Wrap component with React.memo or use useMemo for expensive calculations'
            }
          ],
          metrics: {
            complexity: 7,
            maintainability: 73,
            duplicates: 2
          },
          patterns: [
            'React Functional Component',
            'TypeScript Interface',
            'Event Handler Pattern',
            'State Management'
          ]
        }
      };
      
      setAnalysis(mockAnalysis);
    } catch (error) {
      setAnalysis({
        success: false,
        error: 'Failed to analyze code. Please try again.'
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const loadTemplate = (templateId: string) => {
    const template = exampleTemplates.find(t => t.id === templateId);
    if (template) {
      setCode(template.code);
      setSelectedTemplate(templateId);
      setAnalysis(null); // Clear previous analysis
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Wundr Code Analysis Playground</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Try Wundr's analysis capabilities with your own code or explore our examples.
          Paste your TypeScript, JavaScript, or React code below to see real-time analysis results.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Code Editor Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Code Editor</h2>
            <div className="flex gap-2">
              <select 
                value={selectedTemplate}
                onChange={(e) => loadTemplate(e.target.value)}
                className="px-3 py-1 border rounded-md"
              >
                {exampleTemplates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              <Button 
                onClick={analyzeCode} 
                disabled={isAnalyzing}
              >
                {isAnalyzing ? 'Analyzing...' : 'Analyze Code'}
              </Button>
            </div>
          </div>
          
          <Card>
            <CardContent className="p-0">
              <Editor
                height="500px"
                defaultLanguage="typescript"
                value={code}
                onChange={(value) => setCode(value || '')}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  roundedSelection: false,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            </CardContent>
          </Card>

          <Alert>
            <AlertDescription>
              💡 <strong>Tip:</strong> Try modifying the code to see how different patterns 
              and issues are detected. The analysis updates when you click "Analyze Code".
            </AlertDescription>
          </Alert>
        </div>

        {/* Analysis Results Section */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Analysis Results</h2>
          
          {!analysis && (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  Click "Analyze Code" to see Wundr's analysis results
                </p>
              </CardContent>
            </Card>
          )}

          {analysis && !analysis.success && (
            <Alert>
              <AlertDescription className="text-red-600">
                {analysis.error}
              </AlertDescription>
            </Alert>
          )}

          {analysis && analysis.success && analysis.data && (
            <Tabs defaultValue="issues" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="issues">Issues</TabsTrigger>
                <TabsTrigger value="metrics">Metrics</TabsTrigger>
                <TabsTrigger value="patterns">Patterns</TabsTrigger>
              </TabsList>

              <TabsContent value="issues" className="space-y-3">
                {analysis.data.issues.map((issue, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <Badge variant={getSeverityColor(issue.severity) as any}>
                          {issue.severity.toUpperCase()}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {issue.type.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm mb-2">{issue.message}</p>
                      {issue.line && (
                        <p className="text-xs text-gray-500 mb-2">Line {issue.line}</p>
                      )}
                      {issue.suggestion && (
                        <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">
                          <strong>Suggestion:</strong> {issue.suggestion}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="metrics">
                <Card>
                  <CardHeader>
                    <CardTitle>Code Quality Metrics</CardTitle>
                    <CardDescription>
                      Overall health indicators for your code
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Complexity Score</span>
                      <Badge variant="outline">{analysis.data.metrics.complexity}/10</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Maintainability</span>
                      <Badge variant="outline">{analysis.data.metrics.maintainability}%</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Duplicates Found</span>
                      <Badge variant="outline">{analysis.data.metrics.duplicates}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="patterns">
                <Card>
                  <CardHeader>
                    <CardTitle>Detected Patterns</CardTitle>
                    <CardDescription>
                      Code patterns and structures identified in your code
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {analysis.data.patterns.map((pattern, index) => (
                        <Badge key={index} variant="secondary">
                          {pattern}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>

      {/* Features Section */}
      <div className="mt-12">
        <h2 className="text-2xl font-semibold mb-6">What Wundr Can Detect</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Code Duplicates</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Identifies duplicate code blocks and suggests consolidation opportunities.
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pattern Violations</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Detects deviations from established coding patterns and best practices.
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Complexity Issues</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Measures cyclomatic complexity and suggests simplification strategies.
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Type Safety</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Identifies TypeScript type issues and suggests improvements.
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Spots potential performance bottlenecks and optimization opportunities.
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Architecture</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Analyzes dependency structures and suggests architectural improvements.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Playground;