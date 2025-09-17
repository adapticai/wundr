'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Terminal, 
  Copy, 
  Download, 
  Maximize2, 
  Minimize2,
  ScrollText,
  Pause,
  Play,
  Trash2,
  Search
} from 'lucide-react';

interface OutputTerminalProps {
  output: string;
  errorOutput: string;
  isRunning: boolean;
  title?: string;
}

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

export function OutputTerminal({ 
  output, 
  errorOutput, 
  isRunning, 
  title = "Script Output" 
}: OutputTerminalProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [parsedLogs, setParsedLogs] = useState<LogEntry[]>([]);
  
  const outputRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Parse output into structured log entries
  useEffect(() => {
    const parseOutput = (text: string, level: 'info' | 'error' = 'info'): LogEntry[] => {
      if (!text) return [];
      
      return text.split('\n').filter(line => line.trim()).map(line => {
        // Extract timestamp if present
        const timestampMatch = line.match(/^\[(\d{2}:\d{2}:\d{2})\]/);
        const timestamp = timestampMatch ? timestampMatch[1] : new Date().toLocaleTimeString();
        const message = timestampMatch ? line.replace(timestampMatch[0], '').trim() : line;

        // Determine log level from message content
        let detectedLevel: LogEntry['level'] = level;
        if (message.includes('✅') || message.includes('SUCCESS') || message.includes('completed')) {
          detectedLevel = 'success';
        } else if (message.includes('⚠️') || message.includes('WARNING') || message.includes('WARN')) {
          detectedLevel = 'warn';
        } else if (message.includes('❌') || message.includes('ERROR') || message.includes('FAILED')) {
          detectedLevel = 'error';
        }

        return {
          timestamp,
          level: detectedLevel,
          message
        };
      });
    };

    const outputLogs = parseOutput(output, 'info');
    const errorLogs = parseOutput(errorOutput, 'error');
    
    setParsedLogs([...outputLogs, ...errorLogs].sort((a, b) => 
      a.timestamp.localeCompare(b.timestamp)
    ));
  }, [output, errorOutput]);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (autoScroll && !isPaused && isRunning && endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [parsedLogs, autoScroll, isPaused, isRunning]);

  const copyToClipboard = async () => {
    const content = `${output}\n${errorOutput}`.trim();
    try {
      await navigator.clipboard.writeText(content);
      // Could show a toast notification here
    } catch (_error) {
      // Error logged - details available in network tab;
    }
  };

  const downloadOutput = () => {
    const content = `Script Output - ${new Date().toISOString()}
====================================================

STANDARD OUTPUT:
${output}

ERROR OUTPUT:
${errorOutput}
`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `script-output-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearOutput = () => {
    setParsedLogs([]);
  };

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'success': return 'text-green-400';
      case 'warn': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-300';
    }
  };

  const getLevelBadgeColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'success': return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'warn': return 'bg-amber-500/10 text-amber-700 dark:text-amber-400';
      case 'error': return 'bg-destructive/10 text-destructive';
      default: return 'bg-accent/10 text-accent';
    }
  };

  const filteredLogs = parsedLogs.filter(log => {
    const matchesLevel = filterLevel === 'all' || log.level === filterLevel;
    const matchesSearch = !searchTerm || 
      log.message.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesLevel && matchesSearch;
  });

  const getRunningIndicator = () => {
    if (!isRunning) return null;
    
    return (
      <div className="flex items-center gap-2 text-sm text-blue-600">
        <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
        <span>Running...</span>
      </div>
    );
  };

  return (
    <Card className={`${isExpanded ? 'fixed inset-4 z-50' : ''} transition-all duration-300`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            <CardTitle className="text-base">{title}</CardTitle>
            {getRunningIndicator()}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Log level filter */}
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="text-xs px-2 py-1 border rounded bg-background"
            >
              <option value="all">All</option>
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warn">Warnings</option>
              <option value="error">Errors</option>
            </select>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-xs pl-7 pr-2 py-1 border rounded bg-background w-24 focus:w-32 transition-all"
              />
            </div>

            {/* Controls */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsPaused(!isPaused)}
              className="h-6 w-6 p-0"
            >
              {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAutoScroll(!autoScroll)}
              className="h-6 w-6 p-0"
            >
              <ScrollText className={`h-3 w-3 ${autoScroll ? 'text-blue-600' : ''}`} />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={copyToClipboard}
              className="h-6 w-6 p-0"
            >
              <Copy className="h-3 w-3" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={downloadOutput}
              className="h-6 w-6 p-0"
            >
              <Download className="h-3 w-3" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={clearOutput}
              className="h-6 w-6 p-0"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 w-6 p-0"
            >
              {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            </Button>
          </div>
        </div>
        
        {/* Status bar */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>Lines: {filteredLogs.length}</span>
            {searchTerm && <span>Filtered: {filteredLogs.length}/{parsedLogs.length}</span>}
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={showTimestamps}
                onChange={(e) => setShowTimestamps(e.target.checked)}
                className="w-3 h-3"
              />
              Timestamps
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="w-3 h-3"
              />
              Auto-scroll
            </label>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div 
          ref={outputRef}
          className={`
            bg-card text-green-600 dark:text-green-400 font-mono text-sm p-4 overflow-auto
            ${isExpanded ? 'h-[calc(100vh-200px)]' : 'h-64'}
          `}
        >
          {filteredLogs.length === 0 ? (
            <div className="text-gray-500 italic">
              {isRunning ? 'Waiting for output...' : 'No output available'}
            </div>
          ) : (
            <>
              {filteredLogs.map((log, index) => (
                <div key={index} className="flex items-start gap-2 mb-1 hover:bg-gray-900 px-1 rounded">
                  {showTimestamps && (
                    <span className="text-gray-500 text-xs min-w-[60px]">
                      {log.timestamp}
                    </span>
                  )}
                  <Badge 
                    variant="outline" 
                    className={`text-xs min-w-[50px] justify-center ${getLevelBadgeColor(log.level)}`}
                  >
                    {log.level.toUpperCase()}
                  </Badge>
                  <span className={`flex-1 ${getLevelColor(log.level)}`}>
                    {log.message}
                  </span>
                </div>
              ))}
              
              {isRunning && (
                <div className="flex items-center gap-2 text-blue-400 animate-pulse">
                  <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                  <span>Processing...</span>
                </div>
              )}
              
              <div ref={endRef} />
            </>
          )}
        </div>
      </CardContent>
      
      {/* Status footer */}
      <div className="px-4 py-2 bg-muted text-xs text-muted-foreground border-t">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {parsedLogs.filter(l => l.level === 'error').length > 0 && (
              <span className="text-red-600">
                {parsedLogs.filter(l => l.level === 'error').length} errors
              </span>
            )}
            {parsedLogs.filter(l => l.level === 'warn').length > 0 && (
              <span className="text-yellow-600">
                {parsedLogs.filter(l => l.level === 'warn').length} warnings
              </span>
            )}
            {parsedLogs.filter(l => l.level === 'success').length > 0 && (
              <span className="text-green-600">
                {parsedLogs.filter(l => l.level === 'success').length} success
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {isPaused && (
              <Badge variant="outline" className="text-xs">
                Paused
              </Badge>
            )}
            {!autoScroll && (
              <Badge variant="outline" className="text-xs">
                Manual scroll
              </Badge>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}