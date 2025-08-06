"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Code2, 
  Download, 
  Star, 
  Calendar, 
  User, 
  Package, 
  FileText, 
  Settings,
  ExternalLink,
  Copy,
  CheckCircle
} from "lucide-react";

interface ServiceTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  language: string;
  framework: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  tags: string[];
  downloads: number;
  rating: number;
  lastUpdated: string;
  author: string;
  version: string;
  dependencies: string[];
  features: string[];
  codePreview: string;
  documentation: string;
  usageStats: {
    monthly: number;
    total: number;
    trending: boolean;
  };
}

interface TemplatePreviewProps {
  template: ServiceTemplate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCustomize: () => void;
}

export function TemplatePreview({ template, open, onOpenChange, onCustomize }: TemplatePreviewProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "beginner": return "bg-green-100 text-green-800";
      case "intermediate": return "bg-yellow-100 text-yellow-800";
      case "advanced": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const installCommand = `npm create wundr-service@latest --template=${template.id}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl">{template.name}</DialogTitle>
              <DialogDescription className="mt-2">
                {template.description}
              </DialogDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Badge className={getDifficultyColor(template.difficulty)}>
                {template.difficulty}
              </Badge>
              <div className="flex items-center text-sm text-muted-foreground">
                <Star className="h-4 w-4 mr-1 fill-yellow-400 text-yellow-400" />
                {template.rating}
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="flex-1">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="code">Code Preview</TabsTrigger>
            <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
            <TabsTrigger value="documentation">Documentation</TabsTrigger>
          </TabsList>

          <div className="mt-4 max-h-[60vh] overflow-hidden">
            <TabsContent value="overview" className="space-y-4">
              <ScrollArea className="h-[50vh]">
                <div className="space-y-4 pr-4">
                  {/* Template Info */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Template Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center text-sm">
                            <Package className="h-4 w-4 mr-2 text-muted-foreground" />
                            <span className="font-medium">Category:</span>
                            <Badge variant="outline" className="ml-2">{template.category}</Badge>
                          </div>
                          <div className="flex items-center text-sm">
                            <Code2 className="h-4 w-4 mr-2 text-muted-foreground" />
                            <span className="font-medium">Language:</span>
                            <Badge variant="outline" className="ml-2">{template.language}</Badge>
                          </div>
                          <div className="flex items-center text-sm">
                            <Settings className="h-4 w-4 mr-2 text-muted-foreground" />
                            <span className="font-medium">Framework:</span>
                            <Badge variant="outline" className="ml-2">{template.framework}</Badge>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center text-sm">
                            <User className="h-4 w-4 mr-2 text-muted-foreground" />
                            <span className="font-medium">Author:</span>
                            <span className="ml-2">{template.author}</span>
                          </div>
                          <div className="flex items-center text-sm">
                            <Package className="h-4 w-4 mr-2 text-muted-foreground" />
                            <span className="font-medium">Version:</span>
                            <span className="ml-2">{template.version}</span>
                          </div>
                          <div className="flex items-center text-sm">
                            <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                            <span className="font-medium">Updated:</span>
                            <span className="ml-2">{new Date(template.lastUpdated).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Features */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Features</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {template.features.map((feature) => (
                          <div key={feature} className="flex items-center text-sm">
                            <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                            {feature}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tags */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Tags</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {template.tags.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Usage Stats */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Usage Statistics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-primary">
                            {template.usageStats.total.toLocaleString()}
                          </div>
                          <div className="text-sm text-muted-foreground">Total Downloads</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-primary">
                            {template.usageStats.monthly.toLocaleString()}
                          </div>
                          <div className="text-sm text-muted-foreground">This Month</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-primary">
                            {template.rating}
                          </div>
                          <div className="text-sm text-muted-foreground">Rating</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Installation */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Quick Start</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          Use this command to create a new project with this template:
                        </p>
                        <div className="flex items-center space-x-2">
                          <code className="flex-1 bg-muted p-2 rounded text-sm font-mono">
                            {installCommand}
                          </code>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(installCommand)}
                          >
                            {copied ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="code" className="space-y-4">
              <ScrollArea className="h-[50vh]">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Code Preview</CardTitle>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(template.codePreview)}
                      >
                        {copied ? (
                          <CheckCircle className="h-4 w-4 mr-2" />
                        ) : (
                          <Copy className="h-4 w-4 mr-2" />
                        )}
                        Copy
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm font-mono">
                      <code>{template.codePreview}</code>
                    </pre>
                  </CardContent>
                </Card>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="dependencies" className="space-y-4">
              <ScrollArea className="h-[50vh]">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Dependencies</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {template.dependencies.map((dep) => (
                        <div key={dep} className="flex items-center justify-between p-2 border rounded">
                          <code className="text-sm font-mono">{dep}</code>
                          <Button size="sm" variant="ghost">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="documentation" className="space-y-4">
              <ScrollArea className="h-[50vh]">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Documentation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap text-sm">
                        {template.documentation}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>

        <Separator />

        <div className="flex items-center justify-between pt-4">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Download className="h-4 w-4" />
            <span>{template.downloads.toLocaleString()} downloads</span>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={onCustomize}>
              <Settings className="h-4 w-4 mr-2" />
              Customize
            </Button>
            <Button>
              <Download className="h-4 w-4 mr-2" />
              Use Template
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}