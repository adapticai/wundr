"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  BookOpen, 
  Code2, 
  Play, 
  Settings, 
  Lightbulb, 
  AlertTriangle, 
  CheckCircle,
  ExternalLink,
  Download,
  GitBranch
} from "lucide-react";

export function TemplateDocumentation() {
  const quickStartGuide = `# Service Templates Quick Start Guide

## Overview

Service templates provide pre-configured, production-ready boilerplates for building modern web services. Each template includes:

- 🏗️ **Architecture** - Well-structured codebase following best practices
- 🔒 **Security** - Built-in authentication, validation, and security headers
- 📊 **Monitoring** - Health checks, logging, and performance metrics
- 🧪 **Testing** - Unit tests and testing infrastructure
- 🚀 **Deployment** - Docker and Kubernetes configurations

## Getting Started

### 1. Browse Templates

Navigate to the Template Gallery to explore available service templates. Filter by:
- **Category**: API, Microservice, Serverless, Real-time
- **Language**: TypeScript, JavaScript, Python, Go
- **Difficulty**: Beginner, Intermediate, Advanced

### 2. Preview Template

Click the "Preview" button to:
- View code structure and examples
- Check dependencies and requirements
- Read documentation and setup instructions
- See usage statistics and ratings

### 3. Customize Template

Use the customizer to:
- Configure project settings (name, description, author)
- Enable/disable features (auth, database, caching)
- Set up database connections
- Configure authentication strategies
- Choose deployment options

### 4. Generate Code

The code generator will:
- Create a complete project structure
- Generate configuration files
- Set up package.json with dependencies
- Create Docker and deployment files
- Generate tests and documentation

## Template Categories

### API Templates
- **REST API**: Full-featured REST API with Express.js
- **GraphQL**: Apollo Server with type-safe resolvers
- **API Gateway**: Microservices API gateway

### Microservice Templates
- **Basic Microservice**: Lightweight service with Fastify
- **Event-Driven**: Service with message queues
- **CQRS**: Command Query Responsibility Segregation

### Serverless Templates
- **AWS Lambda**: Serverless functions with API Gateway
- **Vercel Functions**: Edge functions for Vercel
- **Netlify Functions**: JAMstack serverless functions

### Real-time Templates
- **WebSocket Service**: Real-time communication with Socket.io
- **Chat Service**: Multi-room chat application
- **Notification Service**: Push notification system

## Best Practices

### Code Organization
\`\`\`
src/
├── controllers/     # Request handlers
├── services/        # Business logic
├── models/         # Data models
├── middleware/     # Express middleware
├── routes/         # API routes
├── config/         # Configuration
├── utils/          # Utility functions
└── types/          # TypeScript types
\`\`\`

### Environment Configuration
Always use environment variables for:
- Database connections
- API keys and secrets
- Service URLs
- Feature flags

### Error Handling
Templates include:
- Global error handling middleware
- Structured error responses
- Proper HTTP status codes
- Error logging and monitoring

### Security
Built-in security features:
- Helmet.js for security headers
- CORS configuration
- Rate limiting
- Input validation
- JWT authentication

## Troubleshooting

### Common Issues

**Port Already in Use**
\`\`\`bash
# Find and kill process using port 3000
lsof -ti:3000 | xargs kill -9
\`\`\`

**Database Connection Failed**
- Check database is running
- Verify connection string
- Ensure network accessibility
- Check credentials

**Module Not Found**
\`\`\`bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
\`\`\`

### Getting Help

1. Check template documentation
2. Search GitHub issues
3. Join our Discord community
4. Submit bug reports

## Advanced Usage

### Custom Templates
Create your own templates by:
1. Following the template structure
2. Adding metadata configuration
3. Creating customization options
4. Writing documentation
5. Submitting for review

### CI/CD Integration
Templates include:
- GitHub Actions workflows
- Docker multi-stage builds
- Automated testing
- Deployment scripts

### Monitoring and Observability
- Health check endpoints
- Prometheus metrics
- Structured logging
- Error tracking

## Contributing

We welcome contributions to our template library:
- Bug fixes and improvements
- New template categories
- Documentation updates
- Feature suggestions

See our [Contributing Guide](https://github.com/wundr/templates/blob/main/CONTRIBUTING.md) for details.`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BookOpen className="h-5 w-5 mr-2" />
            Service Templates Documentation
          </CardTitle>
          <CardDescription>
            Complete guide to using and customizing service templates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="guide" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="guide">Quick Start</TabsTrigger>
              <TabsTrigger value="examples">Examples</TabsTrigger>
              <TabsTrigger value="api">API Reference</TabsTrigger>
              <TabsTrigger value="faq">FAQ</TabsTrigger>
            </TabsList>

            <TabsContent value="guide" className="space-y-4">
              <ScrollArea className="h-[600px]">
                <div className="prose prose-sm max-w-none pr-4">
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed">
                    {quickStartGuide}
                  </pre>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="examples" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <Code2 className="h-4 w-4 mr-2" />
                      REST API Example
                    </CardTitle>
                    <CardDescription>
                      Complete REST API with authentication and database
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">Express.js</Badge>
                      <Badge variant="outline">TypeScript</Badge>
                      <Badge variant="outline">MongoDB</Badge>
                      <Badge variant="outline">JWT</Badge>
                    </div>
                    <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                      <code>{`// Example endpoint
app.post('/api/users', validateUser, async (req, res) => {
  try {
    const user = await User.create(req.body);
    const token = generateToken(user.id);
    res.status(201).json({ user, token });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});`}</code>
                    </pre>
                    <div className="flex space-x-2">
                      <Button size="sm">
                        <Play className="h-4 w-4 mr-2" />
                        Try Demo
                      </Button>
                      <Button size="sm" variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Use Template
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <Code2 className="h-4 w-4 mr-2" />
                      GraphQL Example
                    </CardTitle>
                    <CardDescription>
                      Type-safe GraphQL server with Apollo
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">Apollo Server</Badge>
                      <Badge variant="outline">TypeScript</Badge>
                      <Badge variant="outline">TypeGraphQL</Badge>
                      <Badge variant="outline">Prisma</Badge>
                    </div>
                    <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                      <code>{`@Resolver(User)
export class UserResolver {
  @Query(() => [User])
  async users(): Promise<User[]> {
    return await this.userService.getAll();
  }

  @Mutation(() => User)
  async createUser(@Arg("data") userData: CreateUserInput): Promise<User> {
    return await this.userService.create(userData);
  }
}`}</code>
                    </pre>
                    <div className="flex space-x-2">
                      <Button size="sm">
                        <Play className="h-4 w-4 mr-2" />
                        Try Demo
                      </Button>
                      <Button size="sm" variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Use Template
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <Code2 className="h-4 w-4 mr-2" />
                      Serverless Example
                    </CardTitle>
                    <CardDescription>
                      AWS Lambda function with API Gateway
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">AWS Lambda</Badge>
                      <Badge variant="outline">TypeScript</Badge>
                      <Badge variant="outline">API Gateway</Badge>
                      <Badge variant="outline">DynamoDB</Badge>
                    </div>
                    <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                      <code>{`export const handler = async (event: APIGatewayEvent) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const result = await processRequest(body);
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};`}</code>
                    </pre>
                    <div className="flex space-x-2">
                      <Button size="sm">
                        <Play className="h-4 w-4 mr-2" />
                        Try Demo
                      </Button>
                      <Button size="sm" variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Use Template
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <Code2 className="h-4 w-4 mr-2" />
                      WebSocket Example
                    </CardTitle>
                    <CardDescription>
                      Real-time service with Socket.io
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">Socket.io</Badge>
                      <Badge variant="outline">TypeScript</Badge>
                      <Badge variant="outline">Redis</Badge>
                      <Badge variant="outline">Express</Badge>
                    </div>
                    <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                      <code>{`io.on('connection', (socket) => {
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    socket.to(roomId).emit('user-joined', {
      id: socket.id,
      timestamp: new Date()
    });
  });

  socket.on('message', (data) => {
    socket.to(data.roomId).emit('message', {
      ...data,
      id: socket.id,
      timestamp: new Date()
    });
  });
});`}</code>
                    </pre>
                    <div className="flex space-x-2">
                      <Button size="sm">
                        <Play className="h-4 w-4 mr-2" />
                        Try Demo
                      </Button>
                      <Button size="sm" variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Use Template
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="api" className="space-y-4">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Template CLI Commands</CardTitle>
                    <CardDescription>
                      Command-line interface for working with templates
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div>
                        <code className="bg-muted p-2 rounded text-sm block">
                          npx create-wundr-service@latest --template=rest-api-express
                        </code>
                        <p className="text-sm text-muted-foreground mt-1">
                          Create a new service from a template
                        </p>
                      </div>
                      <div>
                        <code className="bg-muted p-2 rounded text-sm block">
                          wundr template list --category=api
                        </code>
                        <p className="text-sm text-muted-foreground mt-1">
                          List available templates by category
                        </p>
                      </div>
                      <div>
                        <code className="bg-muted p-2 rounded text-sm block">
                          wundr template info rest-api-express
                        </code>
                        <p className="text-sm text-muted-foreground mt-1">
                          Get detailed information about a template
                        </p>
                      </div>
                      <div>
                        <code className="bg-muted p-2 rounded text-sm block">
                          wundr template update
                        </code>
                        <p className="text-sm text-muted-foreground mt-1">
                          Update templates to latest versions
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Configuration Options</CardTitle>
                    <CardDescription>
                      Available configuration options for templates
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
                      <code>{`{
  "projectName": "my-service",
  "packageName": "@myorg/my-service",
  "description": "My awesome service",
  "author": "John Doe",
  "version": "1.0.0",
  "features": {
    "authentication": true,
    "database": true,
    "validation": true,
    "logging": true,
    "testing": true,
    "docker": false,
    "monitoring": false
  },
  "database": {
    "type": "mongodb",
    "host": "localhost",
    "port": "27017",
    "name": "myapp"
  },
  "authentication": {
    "strategy": "jwt",
    "provider": "local",
    "tokenExpiry": "7d"
  }
}`}</code>
                    </pre>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Template Structure</CardTitle>
                    <CardDescription>
                      Standard template directory structure
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
                      <code>{`template/
├── template.json           # Template metadata
├── README.md              # Template documentation
├── src/                   # Source code templates
│   ├── index.ts.hbs      # Handlebars templates
│   ├── routes/
│   ├── models/
│   └── config/
├── tests/                 # Test templates
├── docs/                  # Documentation
├── .gitignore.hbs        # Git ignore template
├── package.json.hbs      # Package.json template
└── Dockerfile.hbs        # Docker template`}</code>
                    </pre>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="faq" className="space-y-4">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <Lightbulb className="h-5 w-5 mr-2" />
                      Frequently Asked Questions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-semibold flex items-center mb-2">
                          <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                          How do I customize a template?
                        </h3>
                        <p className="text-sm text-muted-foreground ml-6">
                          Use the Template Customizer in the dashboard to configure features, database settings, 
                          authentication, and deployment options before generating your code.
                        </p>
                      </div>

                      <div>
                        <h3 className="font-semibold flex items-center mb-2">
                          <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                          Can I use templates with existing projects?
                        </h3>
                        <p className="text-sm text-muted-foreground ml-6">
                          Templates are designed for new projects. For existing projects, you can use individual 
                          components or patterns from templates as reference.
                        </p>
                      </div>

                      <div>
                        <h3 className="font-semibold flex items-center mb-2">
                          <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                          How often are templates updated?
                        </h3>
                        <p className="text-sm text-muted-foreground ml-6">
                          Templates are updated regularly to include security patches, dependency updates, 
                          and new features. Check the template version and last updated date.
                        </p>
                      </div>

                      <div>
                        <h3 className="font-semibold flex items-center mb-2">
                          <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                          What if I encounter issues with a template?
                        </h3>
                        <p className="text-sm text-muted-foreground ml-6">
                          Check the troubleshooting section, search our GitHub issues, or join our Discord 
                          community for help. You can also submit bug reports.
                        </p>
                      </div>

                      <div>
                        <h3 className="font-semibold flex items-center mb-2">
                          <AlertTriangle className="h-4 w-4 mr-2 text-yellow-600" />
                          Are templates production-ready?
                        </h3>
                        <p className="text-sm text-muted-foreground ml-6">
                          Yes, templates include production best practices, but you should review and test 
                          the generated code before deploying to production environments.
                        </p>
                      </div>

                      <div>
                        <h3 className="font-semibold flex items-center mb-2">
                          <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                          How do I contribute a new template?
                        </h3>
                        <p className="text-sm text-muted-foreground ml-6">
                          Follow our template contribution guidelines on GitHub. Include proper documentation, 
                          tests, and examples. All templates go through a review process.
                        </p>
                      </div>

                      <div>
                        <h3 className="font-semibold flex items-center mb-2">
                          <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                          Can I create private templates?
                        </h3>
                        <p className="text-sm text-muted-foreground ml-6">
                          Enterprise plans include private template repositories. Contact us for custom 
                          template development and private hosting options.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Need More Help?</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Button variant="outline" className="h-20 flex flex-col space-y-2">
                        <ExternalLink className="h-5 w-5" />
                        <span className="text-sm">Documentation</span>
                      </Button>
                      <Button variant="outline" className="h-20 flex flex-col space-y-2">
                        <GitBranch className="h-5 w-5" />
                        <span className="text-sm">GitHub Issues</span>
                      </Button>
                      <Button variant="outline" className="h-20 flex flex-col space-y-2">
                        <Settings className="h-5 w-5" />
                        <span className="text-sm">Discord Community</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}