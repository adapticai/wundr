'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  Code2,
  Download,
  Eye,
  Star,
  Search,
  Filter,
  Settings,
  FileText,
  Database,
  Globe,
  Shield,
  Zap,
  BarChart3,
  Copy,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';
import { ServiceTemplateGallery } from '@/components/templates/ServiceTemplateGallery';
import { TemplateCustomizer } from '@/components/templates/TemplateCustomizer';
import type { ServiceTemplate as ServiceTemplateType } from '@/types/templates';
import { TemplatePreview } from '@/components/templates/TemplatePreview';
import { CodeGenerator } from '@/components/templates/CodeGenerator';
import { TemplateStats } from '@/components/templates/TemplateStats';
import { TemplateDocumentation } from '@/components/templates/TemplateDocumentation';

// Create a relaxed type for mock templates
type MockServiceTemplate = Partial<ServiceTemplateType> & {
  id: string;
  name: string;
  description: string;
  category: ServiceTemplateType['category'];
  language: string;
  framework: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  downloads?: number;
  rating?: number;
  lastUpdated?: Date;
  author?: string;
  version?: string;
  dependencies?: any[];
  features?: string[];
  codePreview?: string;
  documentation?: string;
  usageStats?: {
    downloads: number;
    stars: number;
    lastUpdated: Date;
    monthly?: number;
    total?: number;
    trending?: boolean;
  };
};

// This would be loaded from the real TemplateService
const mockTemplates: MockServiceTemplate[] = [
  {
    id: 'rest-api-express',
    name: 'REST API with Express',
    description:
      'Complete REST API template with authentication, validation, and database integration',
    category: 'api',
    language: 'TypeScript',
    framework: 'Express.js',
    difficulty: 'intermediate',
    tags: ['REST', 'Authentication', 'Database', 'Validation'],
    downloads: 15420,
    rating: 4.8,
    lastUpdated: new Date('2024-12-15'),
    author: 'Wundr Team',
    version: '2.1.0',
    dependencies: [
      { name: 'express', version: '^4.18.0', type: 'npm' },
      { name: 'mongoose', version: '^7.0.0', type: 'npm' },
      { name: 'jsonwebtoken', version: '^9.0.0', type: 'npm' },
      { name: 'joi', version: '^17.0.0', type: 'npm' },
    ],
    features: [
      'JWT Authentication',
      'Input Validation',
      'Error Handling',
      'MongoDB Integration',
    ],
    codePreview: `import express from 'express';
import { authenticateToken } from './middleware/auth';
import { validateUser } from './middleware/validation';

const app = express();

app.post('/api/users', validateUser, async (req, res) => {
  // User creation logic
});

app.get('/api/users', authenticateToken, async (req, res) => {
  // Get users logic
});`,
    documentation:
      '# REST API Template\n\nThis template provides a production-ready REST API...',
    usageStats: {
      downloads: 15420,
      stars: 342,
      lastUpdated: new Date('2024-12-15'),
      monthly: 1240,
      total: 15420,
      trending: true,
    },
  },
  {
    id: 'graphql-apollo',
    name: 'GraphQL Server with Apollo',
    description:
      'Modern GraphQL server with type-safe resolvers and real-time subscriptions',
    category: 'api',
    language: 'TypeScript',
    framework: 'Apollo Server',
    difficulty: 'advanced',
    tags: ['GraphQL', 'Apollo', 'Subscriptions', 'Type-Safe'],
    downloads: 8750,
    rating: 4.9,
    lastUpdated: new Date('2024-12-10'),
    author: 'Wundr Team',
    version: '1.8.0',
    dependencies: [
      { name: 'apollo-server-express', version: '^3.12.0', type: 'npm' },
      { name: 'graphql', version: '^16.6.0', type: 'npm' },
      { name: 'type-graphql', version: '^1.1.0', type: 'npm' },
    ],
    features: [
      'Real-time Subscriptions',
      'Type-safe Resolvers',
      'Schema Federation',
    ],
    codePreview: `@Resolver(User)
export class UserResolver {
  @Query(() => [User])
  async users(): Promise<User[]> {
    return await User.find();
  }

  @Mutation(() => User)
  async createUser(@Arg("data") userData: CreateUserInput): Promise<User> {
    return await User.create(userData);
  }
}`,
    documentation:
      '# GraphQL Apollo Template\n\nModern GraphQL implementation...',
    usageStats: {
      downloads: 8750,
      stars: 298,
      lastUpdated: new Date('2024-12-10'),
      monthly: 680,
      total: 8750,
      trending: false,
    },
  },
  {
    id: 'microservice-fastify',
    name: 'Microservice with Fastify',
    description:
      'High-performance microservice template with health checks and monitoring',
    category: 'microservice',
    language: 'TypeScript',
    framework: 'Fastify',
    difficulty: 'intermediate',
    tags: ['Microservice', 'Performance', 'Health Checks', 'Monitoring'],
    downloads: 12300,
    rating: 4.7,
    lastUpdated: new Date('2024-12-12'),
    author: 'Wundr Team',
    version: '1.5.2',
    dependencies: [
      { name: 'fastify', version: '^4.15.0', type: 'npm' },
      { name: 'prometheus-client', version: '^14.2.0', type: 'npm' },
      { name: 'pino', version: '^8.11.0', type: 'npm' },
    ],
    features: [
      'High Performance',
      'Built-in Monitoring',
      'Health Checks',
      'Logging',
    ],
    codePreview: `import fastify from 'fastify';

const server = fastify({ logger: true });

server.register(require('@fastify/helmet'));
server.register(require('@fastify/rate-limit'));

server.get('/health', async (request, reply) => {
  return { status: 'healthy', timestamp: new Date().toISOString() };
});`,
    documentation:
      '# Fastify Microservice Template\n\nOptimized for performance...',
    usageStats: {
      downloads: 12300,
      stars: 287,
      lastUpdated: new Date('2024-12-12'),
      monthly: 950,
      total: 12300,
      trending: true,
    },
  },
  {
    id: 'serverless-lambda',
    name: 'Serverless Lambda Functions',
    description:
      'AWS Lambda functions with API Gateway integration and local development setup',
    category: 'serverless',
    language: 'TypeScript',
    framework: 'AWS Lambda',
    difficulty: 'beginner',
    tags: ['Serverless', 'AWS', 'Lambda', 'API Gateway'],
    downloads: 20100,
    rating: 4.6,
    lastUpdated: new Date('2024-12-08'),
    author: 'Wundr Team',
    version: '3.0.1',
    dependencies: ['aws-lambda', 'serverless-offline'],
    features: [
      'Local Development',
      'API Gateway Integration',
      'Environment Management',
    ],
    codePreview: `export const handler = async (event: APIGatewayProxyEvent) => {
  try {
    const body = JSON.parse(event.body || '{}');
    
    // Process request
    const result = await processRequest(body);
    
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (_error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};`,
    documentation:
      '# Serverless Lambda Template\n\nAWS Lambda functions made easy...',
    usageStats: {
      downloads: 20100,
      stars: 456,
      lastUpdated: new Date('2024-12-08'),
      monthly: 1800,
      total: 20100,
      trending: false,
    },
  },
  {
    id: 'websocket-service',
    name: 'WebSocket Real-time Service',
    description:
      'Real-time communication service with WebSocket support and room management',
    category: 'real-time',
    language: 'TypeScript',
    framework: 'Socket.io',
    difficulty: 'intermediate',
    tags: ['WebSocket', 'Real-time', 'Socket.io', 'Rooms'],
    downloads: 6800,
    rating: 4.5,
    lastUpdated: new Date('2024-12-05'),
    author: 'Wundr Team',
    version: '2.3.0',
    dependencies: ['socket.io', 'redis', 'express'],
    features: [
      'Room Management',
      'Event Broadcasting',
      'Redis Adapter',
      'Authentication',
    ],
    codePreview: `io.on('connection', (socket) => {
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    socket.to(roomId).emit('user-joined', socket.id);
  });

  socket.on('message', (data) => {
    socket.to(data.roomId).emit('message', {
      id: socket.id,
      message: data.message,
      timestamp: new Date()
    });
  });
});`,
    documentation: '# WebSocket Service Template\n\nReal-time communication...',
    usageStats: {
      downloads: 6800,
      stars: 198,
      lastUpdated: new Date('2024-12-05'),
      monthly: 420,
      total: 6800,
      trending: true,
    },
  },
];

export default function ServiceTemplatesPage() {
  const [selectedTemplate, setSelectedTemplate] =
    useState<MockServiceTemplate | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [showPreview, setShowPreview] = useState(false);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [templates, setTemplates] = useState<MockServiceTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<
    MockServiceTemplate[]
  >([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [generatedCode, setGeneratedCode] = useState('');
  const [copied, setCopied] = useState(false);

  const categories = ['all', ...new Set(templates.map(t => t.category))];
  const languages = ['all', ...new Set(templates.map(t => t.language))];
  const difficulties = ['all', 'beginner', 'intermediate', 'advanced'];

  // Load templates from API
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setLoadingTemplates(true);
        const response = await fetch('/api/templates');
        if (response.ok) {
          const data = await response.json();
          const loadedTemplates = data.success
            ? data.data.map((t: any) => ({
                ...t,
                codePreview: t.content?.[Object.keys(t.content)[0]] || '',
                downloads: t.stats?.usage?.total || 0,
                rating: t.stats?.rating || 0,
                usageStats: t.stats?.usage || {
                  monthly: 0,
                  total: 0,
                  trending: false,
                },
              }))
            : mockTemplates;
          setTemplates(loadedTemplates);
        } else {
          setTemplates(mockTemplates);
        }
      } catch (_error) {
        // Error logged - details available in network tab;
        setTemplates(mockTemplates);
      } finally {
        setLoadingTemplates(false);
      }
    };

    loadTemplates();
  }, []);

  useEffect(() => {
    let filtered = templates;

    if (searchTerm) {
      filtered = filtered.filter(
        template =>
          template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          template.description
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          template.tags.some(tag =>
            tag.toLowerCase().includes(searchTerm.toLowerCase())
          )
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(
        template => template.category === selectedCategory
      );
    }

    if (selectedLanguage !== 'all') {
      filtered = filtered.filter(
        template => template.language === selectedLanguage
      );
    }

    if (selectedDifficulty !== 'all') {
      filtered = filtered.filter(
        template => template.difficulty === selectedDifficulty
      );
    }

    setFilteredTemplates(filtered);
  }, [
    templates,
    searchTerm,
    selectedCategory,
    selectedLanguage,
    selectedDifficulty,
  ]);

  const handleTemplateSelect = (template: MockServiceTemplate) => {
    setSelectedTemplate(template);
    setShowPreview(true);
  };

  const handleCustomize = (template: MockServiceTemplate) => {
    setSelectedTemplate(template);
    setShowCustomizer(true);
  };

  const handleGenerateCode = (
    template: MockServiceTemplate,
    customizations: any
  ) => {
    // Simulate code generation
    const generated = `// Generated ${template.name}
// Customizations applied: ${JSON.stringify(customizations, null, 2)}

${template.codePreview}

// Additional generated code based on customizations...
export default class ${template.name.replace(/\s+/g, '')}Service {
  constructor() {
    // Initialize service
  }
  
  // Generated methods...
}`;
    setGeneratedCode(generated);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-800';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800';
      case 'advanced':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className='flex-1 space-y-4 p-8 pt-6'>
      <div className='flex items-center justify-between space-y-2'>
        <h2 className='text-3xl font-bold tracking-tight'>Service Templates</h2>
        <div className='flex items-center space-x-2'>
          <Button variant='outline' size='sm'>
            <Download className='h-4 w-4 mr-2' />
            Export All
          </Button>
        </div>
      </div>

      <Tabs defaultValue='gallery' className='space-y-4'>
        <TabsList>
          <TabsTrigger value='gallery'>Template Gallery</TabsTrigger>
          <TabsTrigger value='stats'>Usage Statistics</TabsTrigger>
          <TabsTrigger value='documentation'>Documentation</TabsTrigger>
        </TabsList>

        <TabsContent value='gallery' className='space-y-4'>
          {/* Search and Filters */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center'>
                <Search className='h-5 w-5 mr-2' />
                Search & Filter Templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='search'>Search</Label>
                  <Input
                    id='search'
                    placeholder='Search templates...'
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className='w-full'
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='category'>Category</Label>
                  <Select
                    value={selectedCategory}
                    onValueChange={setSelectedCategory}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(category => (
                        <SelectItem key={category} value={category}>
                          {category === 'all' ? 'All Categories' : category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='language'>Language</Label>
                  <Select
                    value={selectedLanguage}
                    onValueChange={setSelectedLanguage}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map(language => (
                        <SelectItem key={language} value={language}>
                          {language === 'all' ? 'All Languages' : language}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='difficulty'>Difficulty</Label>
                  <Select
                    value={selectedDifficulty}
                    onValueChange={setSelectedDifficulty}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {difficulties.map(difficulty => (
                        <SelectItem key={difficulty} value={difficulty}>
                          {difficulty === 'all'
                            ? 'All Levels'
                            : difficulty.charAt(0).toUpperCase() +
                              difficulty.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Template Grid */}
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
            {filteredTemplates.map(template => (
              <Card
                key={template.id}
                className='group hover:shadow-lg transition-shadow'
              >
                <CardHeader>
                  <div className='flex items-start justify-between'>
                    <div className='space-y-1'>
                      <CardTitle className='text-lg'>{template.name}</CardTitle>
                      <CardDescription className='text-sm'>
                        {template.description}
                      </CardDescription>
                    </div>
                    {template.usageStats?.trending && (
                      <Badge
                        variant='secondary'
                        className='bg-orange-100 text-orange-800'
                      >
                        <Zap className='h-3 w-3 mr-1' />
                        Trending
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <div className='flex flex-wrap gap-2'>
                    <Badge variant='outline'>{template.category}</Badge>
                    <Badge variant='outline'>{template.language}</Badge>
                    <Badge className={getDifficultyColor(template.difficulty)}>
                      {template.difficulty || 'intermediate'}
                    </Badge>
                  </div>

                  <div className='flex items-center justify-between text-sm text-muted-foreground'>
                    <div className='flex items-center'>
                      <Star className='h-4 w-4 mr-1 fill-yellow-400 text-yellow-400' />
                      {template.rating}
                    </div>
                    <div className='flex items-center'>
                      <Download className='h-4 w-4 mr-1' />
                      {template.downloads?.toLocaleString() || '0'}
                    </div>
                  </div>

                  <div className='flex flex-wrap gap-1'>
                    {template.tags.slice(0, 3).map(tag => (
                      <Badge key={tag} variant='secondary' className='text-xs'>
                        {tag}
                      </Badge>
                    ))}
                    {template.tags.length > 3 && (
                      <Badge variant='secondary' className='text-xs'>
                        +{template.tags.length - 3}
                      </Badge>
                    )}
                  </div>

                  <div className='flex items-center space-x-2'>
                    <Button
                      size='sm'
                      className='flex-1'
                      onClick={() => handleTemplateSelect(template)}
                    >
                      <Eye className='h-4 w-4 mr-2' />
                      Preview
                    </Button>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => handleCustomize(template)}
                    >
                      <Settings className='h-4 w-4 mr-2' />
                      Customize
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredTemplates.length === 0 && (
            <Card>
              <CardContent className='text-center py-12'>
                <Search className='h-12 w-12 mx-auto text-muted-foreground mb-4' />
                <h3 className='text-lg font-semibold mb-2'>
                  No templates found
                </h3>
                <p className='text-muted-foreground'>
                  Try adjusting your search criteria or filters
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value='stats' className='space-y-4'>
          <TemplateStats templates={templates as any} />
        </TabsContent>

        <TabsContent value='documentation' className='space-y-4'>
          <TemplateDocumentation />
        </TabsContent>
      </Tabs>

      {/* Template Preview Dialog */}
      {showPreview && selectedTemplate && (
        <TemplatePreview
          template={selectedTemplate as any}
          open={showPreview}
          onOpenChange={setShowPreview}
          onCustomize={() => {
            setShowPreview(false);
            setShowCustomizer(true);
          }}
        />
      )}

      {/* Template Customizer Dialog */}
      {showCustomizer && selectedTemplate && (
        <TemplateCustomizer
          template={selectedTemplate as ServiceTemplateType}
          open={showCustomizer}
          onOpenChange={setShowCustomizer}
          onGenerate={customizations =>
            handleGenerateCode(selectedTemplate as any, customizations)
          }
        />
      )}

      {/* Generated Code Display */}
      {generatedCode && (
        <Card className='mt-6'>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <CardTitle className='flex items-center'>
                <Code2 className='h-5 w-5 mr-2' />
                Generated Code
              </CardTitle>
              <Button
                size='sm'
                variant='outline'
                onClick={() => copyToClipboard(generatedCode)}
              >
                {copied ? (
                  <CheckCircle className='h-4 w-4 mr-2' />
                ) : (
                  <Copy className='h-4 w-4 mr-2' />
                )}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre className='bg-muted p-4 rounded-md overflow-x-auto text-sm'>
              <code>{generatedCode}</code>
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
