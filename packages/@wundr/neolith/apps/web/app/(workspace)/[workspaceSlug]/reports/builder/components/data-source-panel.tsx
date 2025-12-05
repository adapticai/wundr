'use client';

/**
 * Data Source Panel Component
 * Configure data sources for report widgets
 */

import { Plus, Database, Link2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

import type { ReportWidget, DataSource, DataSourceType } from '../types';
import { generateWidgetId } from '../utils';

interface DataSourcePanelProps {
  widget: ReportWidget;
  dataSources: DataSource[];
  onDataSourceChange: (dataSource: DataSource | undefined) => void;
  onAddDataSource: (dataSource: DataSource) => void;
}

export function DataSourcePanel({
  widget,
  dataSources,
  onDataSourceChange,
  onAddDataSource,
}: DataSourcePanelProps) {
  const [showNewDataSource, setShowNewDataSource] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceType, setNewSourceType] = useState<DataSourceType>('analytics');
  const [newSourceEndpoint, setNewSourceEndpoint] = useState('');
  const [newSourceQuery, setNewSourceQuery] = useState('');

  const handleAddDataSource = () => {
    if (!newSourceName) return;

    const newDataSource: DataSource = {
      id: generateWidgetId(),
      name: newSourceName,
      type: newSourceType,
      endpoint: newSourceEndpoint || undefined,
      query: newSourceQuery || undefined,
    };

    onAddDataSource(newDataSource);
    onDataSourceChange(newDataSource);
    setShowNewDataSource(false);

    // Reset form
    setNewSourceName('');
    setNewSourceType('analytics');
    setNewSourceEndpoint('');
    setNewSourceQuery('');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Data Source</CardTitle>
            <CardDescription className="text-xs">
              Select or create a data source
            </CardDescription>
          </div>
          <Dialog open={showNewDataSource} onOpenChange={setShowNewDataSource}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-3 w-3 mr-1" />
                New
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Data Source</DialogTitle>
                <DialogDescription>
                  Create a new data source for your report widgets
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="source-name">Name</Label>
                  <Input
                    id="source-name"
                    placeholder="My Data Source"
                    value={newSourceName}
                    onChange={(e) => setNewSourceName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="source-type">Type</Label>
                  <Select
                    value={newSourceType}
                    onValueChange={(v) => setNewSourceType(v as DataSourceType)}
                  >
                    <SelectTrigger id="source-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="analytics">Analytics</SelectItem>
                      <SelectItem value="tasks">Tasks</SelectItem>
                      <SelectItem value="workflows">Workflows</SelectItem>
                      <SelectItem value="agents">Agents</SelectItem>
                      <SelectItem value="custom-query">Custom Query</SelectItem>
                      <SelectItem value="api-endpoint">API Endpoint</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newSourceType === 'api-endpoint' && (
                  <div className="space-y-2">
                    <Label htmlFor="source-endpoint">Endpoint URL</Label>
                    <Input
                      id="source-endpoint"
                      placeholder="https://api.example.com/data"
                      value={newSourceEndpoint}
                      onChange={(e) => setNewSourceEndpoint(e.target.value)}
                    />
                  </div>
                )}
                {newSourceType === 'custom-query' && (
                  <div className="space-y-2">
                    <Label htmlFor="source-query">Query</Label>
                    <Textarea
                      id="source-query"
                      placeholder="SELECT * FROM..."
                      value={newSourceQuery}
                      onChange={(e) => setNewSourceQuery(e.target.value)}
                      rows={4}
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowNewDataSource(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleAddDataSource} disabled={!newSourceName}>
                  Add Source
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Select Source</Label>
            <Select
              value={widget.dataSource?.id || 'none'}
              onValueChange={(value) => {
                if (value === 'none') {
                  onDataSourceChange(undefined);
                } else {
                  const source = dataSources.find((ds) => ds.id === value);
                  if (source) onDataSourceChange(source);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="No data source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No data source</SelectItem>
                {dataSources.map((source) => (
                  <SelectItem key={source.id} value={source.id}>
                    <div className="flex items-center gap-2">
                      <Database className="h-3 w-3" />
                      <span>{source.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({source.type})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {widget.dataSource && (
            <div className="rounded-md bg-muted/50 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Database className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{widget.dataSource.name}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Type: {widget.dataSource.type}
              </div>
              {widget.dataSource.endpoint && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Link2 className="h-3 w-3" />
                  <span className="truncate">{widget.dataSource.endpoint}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
