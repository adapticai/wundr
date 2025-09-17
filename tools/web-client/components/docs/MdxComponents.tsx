'use client';

import React from 'react';
import type { PreProps, CodeProps, HeadingProps, LinkProps, TableProps, TableCellProps, BlockquoteProps, ListProps } from '@/types/mdx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info, 
  Copy,
  ExternalLink,
  Lightbulb,
  Zap,
  Shield,
  Code,
  FileText
} from 'lucide-react';

// Custom MDX components for enhanced documentation
export const mdxComponents = {
  // Enhanced code blocks with copy functionality
  pre: ({ children, className, ...props }: PreProps) => (
    <div className="relative group">
      <pre 
        className={`bg-muted p-4 rounded-lg overflow-x-auto text-sm ${className || ''}`}
        {...props}
      >
        {children}
      </pre>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          const code = children?.props?.children || '';
          navigator.clipboard.writeText(code);
        }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  ),

  // Inline code with better styling
  code: ({ children, className, ...props }: CodeProps) => (
    <code 
      className={`bg-muted px-1.5 py-0.5 rounded text-sm font-mono ${className || ''}`}
      {...props}
    >
      {children}
    </code>
  ),

  // Custom callout components
  Callout: ({ type = 'info', children, title }: { type?: string; children: React.ReactNode; title?: string }) => {
    const icons = {
      info: <Info className="h-5 w-5" />,
      warning: <AlertTriangle className="h-5 w-5" />,
      error: <XCircle className="h-5 w-5" />,
      success: <CheckCircle className="h-5 w-5" />,
      tip: <Lightbulb className="h-5 w-5" />,
      security: <Shield className="h-5 w-5" />
    };

    const variants = {
      info: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100',
      warning: 'border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-100',
      error: 'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100',
      success: 'border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100',
      tip: 'border-purple-200 bg-purple-50 text-purple-900 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-100',
      security: 'border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-100'
    };

    return (
      <Alert className={`my-4 ${variants[type as keyof typeof variants] || variants.info}`}>
        <div className="flex gap-2">
          {icons[type as keyof typeof icons] || icons.info}
          <div className="flex-1">
            {title && <h4 className="font-semibold mb-1">{title}</h4>}
            <AlertDescription className="[&>p]:mb-0">
              {children}
            </AlertDescription>
          </div>
        </div>
      </Alert>
    );
  },

  // API reference component
  ApiReference: ({ name, type, signature, description, properties, examples }: {
    name: string;
    type: string;
    signature?: string;
    description: string;
    properties?: Array<{ name: string; type: string; description: string; required?: boolean }>;
    examples?: string[];
  }) => (
    <Card className="my-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code className="h-5 w-5" />
          <code className="text-lg">{name}</code>
          <Badge variant="outline">{type}</Badge>
        </CardTitle>
        <p className="text-muted-foreground">{description}</p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {signature && (
          <div>
            <h4 className="font-semibold mb-2">Signature</h4>
            <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
              <code>{signature}</code>
            </pre>
          </div>
        )}
        
        {properties && properties.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2">Properties</h4>
            <div className="space-y-2">
              {properties.map((prop) => (
                <div key={prop.name} className="flex items-start gap-3">
                  <code className="font-mono text-primary">{prop.name}</code>
                  {!prop.required && <Badge variant="outline" className="text-xs">optional</Badge>}
                  <div className="flex-1">
                    <code className="text-xs text-muted-foreground">{prop.type}</code>
                    {prop.description && <p className="text-sm mt-1">{prop.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {examples && examples.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2">Examples</h4>
            <div className="space-y-2">
              {examples.map((example, index) => (
                <pre key={index} className="bg-muted p-3 rounded text-sm overflow-x-auto">
                  <code>{example}</code>
                </pre>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  ),

  // Before/After comparison
  BeforeAfter: ({ before, after, title }: { before: string; after: string; title?: string }) => (
    <div className="my-6">
      {title && <h4 className="font-semibold mb-3">{title}</h4>}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium">Before</span>
          </div>
          <pre className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-3 rounded text-sm overflow-x-auto">
            <code>{before}</code>
          </pre>
        </div>
        
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium">After</span>
          </div>
          <pre className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-3 rounded text-sm overflow-x-auto">
            <code>{after}</code>
          </pre>
        </div>
      </div>
    </div>
  ),

  // Do/Don't patterns
  DosDonts: ({ dos, donts }: { dos?: string[]; donts?: string[] }) => (
    <div className="my-6 grid md:grid-cols-2 gap-4">
      {dos && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span className="font-semibold text-green-700 dark:text-green-400">Do</span>
          </div>
          {dos.map((item, index) => (
            <div key={index} className="flex gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm">{item}</span>
            </div>
          ))}
        </div>
      )}
      
      {donts && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <XCircle className="h-5 w-5 text-red-500" />
            <span className="font-semibold text-red-700 dark:text-red-400">Don't</span>
          </div>
          {donts.map((item, index) => (
            <div key={index} className="flex gap-2">
              <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm">{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  ),

  // Feature showcase
  FeatureShowcase: ({ features }: { features: Array<{ icon: string; title: string; description: string }> }) => (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 my-6">
      {features.map((feature, index) => (
        <Card key={index} className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <h4 className="font-semibold">{feature.title}</h4>
          </div>
          <p className="text-sm text-muted-foreground">{feature.description}</p>
        </Card>
      ))}
    </div>
  ),

  // Quick links
  QuickLinks: ({ links }: { links: Array<{ title: string; description: string; href: string }> }) => (
    <div className="grid md:grid-cols-2 gap-4 my-6">
      {links.map((link, index) => (
        <Card key={index} className="p-4 hover:shadow-md transition-shadow">
          <a href={link.href} className="block group">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold group-hover:text-primary">{link.title}</h4>
              <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">{link.description}</p>
          </a>
        </Card>
      ))}
    </div>
  ),

  // Progress tracker
  ProgressTracker: ({ steps, currentStep = 0 }: { steps: string[]; currentStep?: number }) => (
    <div className="my-6">
      <div className="space-y-4">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center gap-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
              index <= currentStep 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground'
            }`}>
              {index < currentStep ? '✓' : index + 1}
            </div>
            <span className={index <= currentStep ? 'font-medium' : 'text-muted-foreground'}>
              {step}
            </span>
          </div>
        ))}
      </div>
    </div>
  ),

  // Separator with custom styling
  hr: () => <Separator className="my-8" />,

  // Enhanced headings with anchors
  h1: ({ children, id }: HeadingProps) => (
    <h1 id={id} className="text-3xl font-bold tracking-tight mb-6 scroll-mt-20">
      {children}
    </h1>
  ),
  h2: ({ children, id }: HeadingProps) => (
    <h2 id={id} className="text-2xl font-semibold tracking-tight mb-4 mt-8 scroll-mt-20">
      {children}
    </h2>
  ),
  h3: ({ children, id }: HeadingProps) => (
    <h3 id={id} className="text-xl font-semibold mb-3 mt-6 scroll-mt-20">
      {children}
    </h3>
  ),

  // Enhanced links
  a: ({ href, children, ...props }: LinkProps) => (
    <a 
      href={href} 
      className="text-primary hover:text-primary/80 underline underline-offset-4"
      {...props}
    >
      {children}
    </a>
  ),

  // Enhanced tables
  table: ({ children }: TableProps) => (
    <div className="overflow-x-auto my-6">
      <table className="w-full border-collapse border border-border">
        {children}
      </table>
    </div>
  ),
  th: ({ children }: TableCellProps) => (
    <th className="border border-border bg-muted p-3 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }: TableCellProps) => (
    <td className="border border-border p-3">
      {children}
    </td>
  ),

  // Enhanced blockquotes
  blockquote: ({ children }: BlockquoteProps) => (
    <blockquote className="border-l-4 border-primary pl-4 py-2 my-4 bg-muted/30 italic">
      {children}
    </blockquote>
  ),

  // Enhanced lists
  ul: ({ children }: ListProps) => (
    <ul className="list-disc list-inside space-y-1 my-4 ml-4">
      {children}
    </ul>
  ),
  ol: ({ children }: ListProps) => (
    <ol className="list-decimal list-inside space-y-1 my-4 ml-4">
      {children}
    </ol>
  )
};

export default mdxComponents;