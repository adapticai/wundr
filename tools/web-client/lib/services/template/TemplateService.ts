export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
  variables: TemplateVariable[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  defaultValue?: any;
  required: boolean;
  description?: string;
}

export class TemplateService {
  private templates: Map<string, Template> = new Map();
  private baseUrl: string;

  constructor(baseUrl = '/api/templates') {
    this.baseUrl = baseUrl;
    this.initializeDefaultTemplates();
  }

  private initializeDefaultTemplates() {
    const defaults: Template[] = [
      {
        id: 'react-component',
        name: 'React Component',
        description: 'Basic React functional component',
        category: 'react',
        content: `import React from 'react'\n\ninterface {{name}}Props {\n  {{props}}\n}\n\nexport function {{name}}({ {{propNames}} }: {{name}}Props) {\n  return (\n    <div>{{content}}</div>\n  )\n}`,
        variables: [
          { name: 'name', type: 'string', required: true },
          { name: 'props', type: 'string', required: false },
          { name: 'propNames', type: 'string', required: false },
          {
            name: 'content',
            type: 'string',
            defaultValue: 'Component content',
            required: false,
          },
        ],
        metadata: { language: 'typescript', framework: 'react' },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    defaults.forEach(t => this.templates.set(t.id, t));
  }

  async getTemplates(): Promise<Template[]> {
    try {
      const response = await fetch(this.baseUrl);
      if (!response.ok) throw new Error('Failed to fetch templates');
      const templates = await response.json();
      return templates;
    } catch {
      return Array.from(this.templates.values());
    }
  }

  async getTemplate(id: string): Promise<Template | null> {
    try {
      const response = await fetch(`${this.baseUrl}/${id}`);
      if (!response.ok) throw new Error('Failed to fetch template');
      return await response.json();
    } catch {
      return this.templates.get(id) || null;
    }
  }

  async createTemplate(template: Partial<Template>): Promise<Template> {
    const newTemplate: Template = {
      id: template.id || `template-${Date.now()}`,
      name: template.name || 'Untitled Template',
      description: template.description || '',
      category: template.category || 'general',
      content: template.content || '',
      variables: template.variables || [],
      metadata: template.metadata || {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate),
      });
      if (!response.ok) throw new Error('Failed to create template');
      return await response.json();
    } catch {
      this.templates.set(newTemplate.id, newTemplate);
      return newTemplate;
    }
  }

  async updateTemplate(
    id: string,
    updates: Partial<Template>
  ): Promise<Template | null> {
    const existing = await this.getTemplate(id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date(),
    };

    try {
      const response = await fetch(`${this.baseUrl}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update template');
      return await response.json();
    } catch {
      this.templates.set(id, updated);
      return updated;
    }
  }

  async deleteTemplate(id: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete template');
      return true;
    } catch {
      return this.templates.delete(id);
    }
  }

  renderTemplate(template: Template, variables: Record<string, any>): string {
    let content = template.content;

    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      content = content.replace(regex, String(value));
    });

    // Remove any unreplaced variables
    content = content.replace(/{{[^}]+}}/g, '');

    return content;
  }

  validateVariables(
    template: Template,
    variables: Record<string, any>
  ): string[] {
    const errors: string[] = [];

    template.variables.forEach(v => {
      if (v.required && !(v.name in variables)) {
        errors.push(`Required variable '${v.name}' is missing`);
      }

      if (v.name in variables) {
        const value = variables[v.name];
        const actualType = Array.isArray(value) ? 'array' : typeof value;

        if (actualType !== v.type && v.type !== 'object') {
          errors.push(
            `Variable '${v.name}' should be ${v.type} but got ${actualType}`
          );
        }
      }
    });

    return errors;
  }

  getTemplatesByCategory(category: string): Template[] {
    return Array.from(this.templates.values()).filter(
      t => t.category === category
    );
  }

  searchTemplates(query: string): Template[] {
    const lowQuery = query.toLowerCase();
    return Array.from(this.templates.values()).filter(
      t =>
        t.name.toLowerCase().includes(lowQuery) ||
        t.description.toLowerCase().includes(lowQuery) ||
        t.category.toLowerCase().includes(lowQuery)
    );
  }

  async recordUsage(
    templateId: string,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    const template = await this.getTemplate(templateId);
    if (!template) return false;

    // Record usage in template metadata
    const updatedTemplate = {
      ...template,
      metadata: {
        ...template.metadata,
        usageCount: (template.metadata.usageCount || 0) + 1,
        lastUsed: new Date().toISOString(),
        lastUsageMetadata: metadata,
      },
      updatedAt: new Date(),
    };

    try {
      await this.updateTemplate(templateId, updatedTemplate);
      return true;
    } catch {
      // Update local cache
      this.templates.set(templateId, updatedTemplate);
      return true;
    }
  }

  validateParameters(
    template: Template,
    parameters: Record<string, any>
  ): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check required variables
    template.variables.forEach(variable => {
      if (variable.required && !(variable.name in parameters)) {
        errors.push(`Required parameter '${variable.name}' is missing`);
      }

      if (variable.name in parameters) {
        const value = parameters[variable.name];
        const actualType = Array.isArray(value) ? 'array' : typeof value;

        // Type validation
        if (actualType !== variable.type && variable.type !== 'object') {
          errors.push(
            `Parameter '${variable.name}' should be ${variable.type} but got ${actualType}`
          );
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export const templateService = new TemplateService();
