'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Code, 
  FileText, 
  Settings, 
  Package,
  ChevronRight,
  Copy,
  ExternalLink
} from 'lucide-react';
import { ApiDocEntry } from '@/lib/docs-utils';

interface ApiDocsRendererProps {
  apiDocs: ApiDocEntry[];
  className?: string;
}

export function ApiDocsRenderer({ apiDocs, className = '' }: ApiDocsRendererProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Filter API docs
  const filteredDocs = apiDocs.filter(doc => {
    const matchesSearch = !searchTerm || 
      doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = selectedType === 'all' || doc.type === selectedType;
    
    return matchesSearch && matchesType;
  });

  // Group by type
  const groupedDocs = filteredDocs.reduce((acc, doc) => {
    if (!acc[doc.type]) acc[doc.type] = [];
    acc[doc.type].push(doc);
    return acc;
  }, {} as Record<string, ApiDocEntry[]>);

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'interface': return <FileText className="h-4 w-4" />;
      case 'type': return <Code className="h-4 w-4" />;
      case 'function': return <Settings className="h-4 w-4" />;
      case 'class': return <Package className="h-4 w-4" />;
      case 'enum': return <Package className="h-4 w-4" />;
      default: return <Code className="h-4 w-4" />;
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'interface': return 'default';
      case 'type': return 'secondary';
      case 'function': return 'outline';
      case 'class': return 'destructive';
      case 'enum': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search API documentation..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Tabs value={selectedType} onValueChange={setSelectedType} className="w-auto">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="interface">Interfaces</TabsTrigger>
            <TabsTrigger value="type">Types</TabsTrigger>
            <TabsTrigger value="function">Functions</TabsTrigger>
            <TabsTrigger value="class">Classes</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Results Summary */}
      <div className="text-sm text-muted-foreground">
        {filteredDocs.length} {filteredDocs.length === 1 ? 'item' : 'items'} found
        {searchTerm && ` for "${searchTerm}"`}
      </div>

      {/* API Documentation Items */}
      <div className="space-y-4">
        {Object.entries(groupedDocs).map(([type, docs]) => (
          <div key={type}>
            <h3 className="text-lg font-semibold mb-3 capitalize flex items-center gap-2">
              {getTypeIcon(type)}
              {type}s ({docs.length})
            </h3>
            
            <div className="space-y-3">
              {docs.map((doc) => (
                <ApiDocItem
                  key={doc.name}
                  doc={doc}
                  isExpanded={expandedItems.has(doc.name)}
                  onToggle={() => toggleExpanded(doc.name)}
                  onCopy={copyToClipboard}
                  getTypeBadgeVariant={getTypeBadgeVariant}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {filteredDocs.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Code className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No API documentation found</p>
          {searchTerm && (
            <p className="text-sm">Try adjusting your search terms</p>
          )}
        </div>
      )}
    </div>
  );
}

interface ApiDocItemProps {
  doc: ApiDocEntry;
  isExpanded: boolean;
  onToggle: () => void;
  onCopy: (text: string) => void;
  getTypeBadgeVariant: (type: string) => any;
}

function ApiDocItem({ doc, isExpanded, onToggle, onCopy, getTypeBadgeVariant }: ApiDocItemProps) {
  return (
    <Card className="transition-all duration-200 hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="p-0 h-auto hover:bg-transparent"
            >
              <ChevronRight 
                className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
              />
            </Button>
            <code className="text-lg font-mono">{doc.name}</code>
            <Badge variant={getTypeBadgeVariant(doc.type)} className="text-xs">
              {doc.type}
            </Badge>
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCopy(doc.signature || doc.name)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <p className="text-sm text-muted-foreground mt-2">{doc.description}</p>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-4">
            {/* Signature */}
            {doc.signature && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Signature</h4>
                <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto">
                  <code>{doc.signature}</code>
                </pre>
              </div>
            )}

            {/* Properties */}
            {doc.properties && doc.properties.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Properties</h4>
                <div className="space-y-2">
                  {doc.properties.map((prop) => (
                    <div key={prop.name} className="flex items-start gap-3 text-sm">
                      <code className="font-mono text-primary">{prop.name}</code>
                      {!prop.required && <Badge variant="outline" className="text-xs">optional</Badge>}
                      <span className="text-muted-foreground flex-1">
                        <code className="text-xs">{prop.type}</code>
                        {prop.description && <span className="ml-2">{prop.description}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Methods */}
            {doc.methods && doc.methods.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Methods</h4>
                <div className="space-y-3">
                  {doc.methods.map((method) => (
                    <div key={method.name} className="border-l-2 border-muted pl-3">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="font-mono text-primary">{method.name}</code>
                        <Badge variant="outline" className="text-xs">
                          returns {method.returns}
                        </Badge>
                      </div>
                      <pre className="bg-muted p-2 rounded text-xs mb-2 overflow-x-auto">
                        <code>{method.signature}</code>
                      </pre>
                      <p className="text-sm text-muted-foreground">{method.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Examples */}
            {doc.examples && doc.examples.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Examples</h4>
                <div className="space-y-3">
                  {doc.examples.map((example, index) => (
                    <div key={index}>
                      <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto">
                        <code>{example}</code>
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}