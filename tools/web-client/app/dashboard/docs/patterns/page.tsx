import React from 'react';
import { DocsLayout } from '@/components/docs/DocsLayout';
import { MarkdownRenderer } from '@/components/markdown/MarkdownRenderer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Code, FileText, GitBranch, Package, Shield, Zap } from 'lucide-react';

// Pattern categories and examples
const patternCategories = [
  {
    id: 'architecture',
    title: 'Architecture Patterns',
    description: 'Best practices for structuring your application',
    icon: Package,
    patterns: [
      {
        title: 'Modular Monolith',
        description: 'Organize your application into well-defined modules with clear boundaries',
        code: `// modules/user/index.ts
export interface UserModule {
  services: {
    userService: UserService;
    authService: AuthService;
  };
  repositories: {
    userRepository: UserRepository;
  };
  controllers: {
    userController: UserController;
  };
}

// Dependency injection setup
export function createUserModule(db: Database): UserModule {
  const userRepository = new UserRepository(db);
  const userService = new UserService(userRepository);
  const authService = new AuthService(userRepository);
  const userController = new UserController(userService, authService);
  
  return {
    services: { userService, authService },
    repositories: { userRepository },
    controllers: { userController }
  };
}`,
        language: 'typescript'
      },
      {
        title: 'Clean Architecture',
        description: 'Separate business logic from infrastructure concerns',
        code: `// domain/entities/User.ts
export class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly name: string
  ) {}
}

// application/use-cases/CreateUser.ts
export class CreateUserUseCase {
  constructor(
    private userRepository: UserRepository,
    private emailService: EmailService
  ) {}
  
  async execute(input: CreateUserInput): Promise<User> {
    const user = new User(
      generateId(),
      input.email,
      input.name
    );
    
    await this.userRepository.save(user);
    await this.emailService.sendWelcome(user);
    
    return user;
  }
}`,
        language: 'typescript'
      }
    ]
  },
  {
    id: 'performance',
    title: 'Performance Patterns',
    description: 'Optimize your application for speed and efficiency',
    icon: Zap,
    patterns: [
      {
        title: 'Lazy Loading',
        description: 'Load components and modules only when needed',
        code: `// React lazy loading
const Dashboard = lazy(() => import('./Dashboard'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </Suspense>
  );
}

// Module lazy loading
async function loadAnalyticsModule() {
  const { AnalyticsModule } = await import('./modules/analytics');
  return new AnalyticsModule();
}`,
        language: 'typescript'
      },
      {
        title: 'Memoization',
        description: 'Cache expensive computations',
        code: `// React memoization
const ExpensiveComponent = memo(({ data }) => {
  const processedData = useMemo(
    () => processComplexData(data),
    [data]
  );
  
  const handleClick = useCallback(
    (id: string) => {
      console.log('Clicked:', id);
    },
    []
  );
  
  return <DataGrid data={processedData} onClick={handleClick} />;
});

// Function memoization
const memoize = <T extends (...args: any[]) => any>(fn: T): T => {
  const cache = new Map();
  
  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
};`,
        language: 'typescript'
      }
    ]
  },
  {
    id: 'security',
    title: 'Security Patterns',
    description: 'Protect your application from common vulnerabilities',
    icon: Shield,
    patterns: [
      {
        title: 'Input Validation',
        description: 'Validate and sanitize all user inputs',
        code: `// Using Zod for validation
import { z } from 'zod';

const UserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
  age: z.number().min(18).max(120)
});

export function validateUser(input: unknown) {
  try {
    return UserSchema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(error.errors);
    }
    throw error;
  }
}

// SQL injection prevention
export async function getUser(id: string) {
  // Use parameterized queries
  const query = 'SELECT * FROM users WHERE id = $1';
  const result = await db.query(query, [id]);
  return result.rows[0];
}`,
        language: 'typescript'
      }
    ]
  },
  {
    id: 'testing',
    title: 'Testing Patterns',
    description: 'Write maintainable and effective tests',
    icon: FileText,
    patterns: [
      {
        title: 'Test Pyramid',
        description: 'Balance unit, integration, and E2E tests',
        code: `// Unit test
describe('UserService', () => {
  it('should create a user', async () => {
    const mockRepo = { save: jest.fn() };
    const service = new UserService(mockRepo);
    
    const user = await service.create({
      email: 'test@example.com',
      name: 'Test User'
    });
    
    expect(mockRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'test@example.com'
      })
    );
  });
});

// Integration test
describe('User API', () => {
  it('should create user via API', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ email: 'test@example.com', name: 'Test' })
      .expect(201);
      
    expect(response.body).toMatchObject({
      id: expect.any(String),
      email: 'test@example.com'
    });
  });
});`,
        language: 'typescript'
      }
    ]
  },
  {
    id: 'git',
    title: 'Git Patterns',
    description: 'Best practices for version control',
    icon: GitBranch,
    patterns: [
      {
        title: 'Conventional Commits',
        description: 'Standardize your commit messages',
        code: `# Format: <type>(<scope>): <subject>

feat(auth): add OAuth2 integration
fix(api): handle null response in user endpoint
docs(readme): update installation instructions
refactor(dashboard): extract chart component
test(user): add integration tests for registration
chore(deps): upgrade React to v18

# Breaking changes
feat(api)!: change user endpoint response format

# With body and footer
fix(payment): prevent duplicate charges

Customers were being charged twice when clicking 
submit button multiple times.

Fixes #123`,
        language: 'bash'
      }
    ]
  }
];

export default function PatternsPage() {
  const [selectedCategory, setSelectedCategory] = React.useState('architecture');
  const currentCategory = patternCategories.find(cat => cat.id === selectedCategory);

  return (
    <DocsLayout>
      <div className="max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">Development Patterns</h1>
          <p className="text-muted-foreground">
            Best practices and patterns for building maintainable applications
          </p>
        </div>

        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="grid grid-cols-5 w-full mb-8">
            {patternCategories.map((category) => (
              <TabsTrigger key={category.id} value={category.id} className="flex items-center gap-2">
                <category.icon className="h-4 w-4" />
                <span className="hidden md:inline">{category.title}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {patternCategories.map((category) => (
            <TabsContent key={category.id} value={category.id}>
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <category.icon className="h-5 w-5" />
                      {category.title}
                    </CardTitle>
                    <CardDescription>{category.description}</CardDescription>
                  </CardHeader>
                </Card>

                {category.patterns.map((pattern, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <CardTitle className="text-xl">{pattern.title}</CardTitle>
                      <CardDescription>{pattern.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="relative">
                        <Badge className="absolute top-2 right-2" variant="secondary">
                          {pattern.language}
                        </Badge>
                        <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                          <code className="text-sm">{pattern.code}</code>
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </DocsLayout>
  );
}