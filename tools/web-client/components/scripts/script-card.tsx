'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Play, 
  Clock, 
  Shield, 
  Tag, 
  AlertTriangle,
  CheckCircle,
  Code,
  FileText,
  Zap,
  Terminal
} from 'lucide-react';

interface Script {
  id: string;
  name: string;
  description: string;
  category: 'analysis' | 'governance' | 'consolidation' | 'testing' | 'quality' | 'monorepo';
  safetyLevel: 'safe' | 'moderate' | 'unsafe';
  command: string;
  tags: string[];
  lastRun?: string;
  status?: 'idle' | 'running' | 'completed' | 'failed';
  estimatedDuration?: number;
  requiresConfirmation?: boolean;
}

interface ScriptCardProps {
  script: Script;
  onSelect: (script: Script) => void;
  onExecute: () => void;
}

export function ScriptCard({ script, onSelect, onExecute }: ScriptCardProps) {
  const getSafetyLevelColor = (level: string) => {
    switch (level) {
      case 'safe': return 'bg-green-100 text-green-800 border-green-200';
      case 'moderate': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'unsafe': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
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

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'running': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'Unknown';
    const seconds = Math.round(ms / 1000);
    return seconds < 60 ? `${seconds}s` : `${Math.round(seconds / 60)}m`;
  };

  const handleRun = () => {
    onSelect(script);
    onExecute();
  };

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {getCategoryIcon(script.category)}
            <CardTitle className="text-lg">{script.name}</CardTitle>
          </div>
          <div className="flex gap-1">
            <Badge 
              variant="outline" 
              className={getSafetyLevelColor(script.safetyLevel)}
            >
              <Shield className="h-3 w-3 mr-1" />
              {script.safetyLevel}
            </Badge>
            {script.status && (
              <Badge 
                variant="outline"
                className={getStatusColor(script.status)}
              >
                {script.status}
              </Badge>
            )}
          </div>
        </div>
        <CardDescription className="text-sm">
          {script.description}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1">
          {script.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              <Tag className="h-3 w-3 mr-1" />
              {tag}
            </Badge>
          ))}
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(script.estimatedDuration)}
          </div>
          {script.lastRun && (
            <div>
              Last run: {new Date(script.lastRun).toLocaleDateString()}
            </div>
          )}
        </div>

        {script.requiresConfirmation && (
          <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
            <AlertTriangle className="h-3 w-3" />
            Requires confirmation
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button 
            onClick={handleRun}
            className="flex-1"
            disabled={script.status === 'running'}
          >
            <Play className="h-4 w-4 mr-2" />
            {script.status === 'running' ? 'Running...' : 'Run Script'}
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onSelect(script)}
          >
            Configure
          </Button>
        </div>

        <div className="text-xs text-muted-foreground bg-muted p-2 rounded font-mono">
          {script.command.length > 50 
            ? `${script.command.substring(0, 50)}...` 
            : script.command
          }
        </div>
      </CardContent>
    </Card>
  );
}