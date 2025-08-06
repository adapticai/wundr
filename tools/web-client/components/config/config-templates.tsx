'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { configTemplates } from '@/lib/contexts/config/default-config';
import { useConfigTemplates } from '@/hooks/config/use-config';

export function ConfigTemplates() {
  const { applyTemplate } = useConfigTemplates();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Configuration Templates</h3>
        <p className="text-sm text-muted-foreground">
          Quick start with pre-configured setups for common project types
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {configTemplates.map((template) => (
          <Card key={template.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applyTemplate(template)}
                >
                  Apply
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {template.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
              
              {/* Preview of what the template changes */}
              <div className="mt-3 text-xs text-muted-foreground">
                <p className="font-medium mb-1">Includes configuration for:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {Object.keys(template.config).map((section) => (
                    <li key={section} className="capitalize">
                      {section.replace(/([A-Z])/g, ' $1').trim()} settings
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}