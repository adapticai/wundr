/**
 * Seed Script for isla@adaptic.ai
 *
 * Creates a fully populated workspace with:
 * - Organization: Adaptic AI
 * - Workspace with channels, integrations, deployments
 * - Orchestrators (AI agents)
 * - Tasks, workflows, and more
 *
 * This script is idempotent - safe to run multiple times.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🚀 Starting workspace population for isla@adaptic.ai...\n');

  // 1. Find or create user
  console.log('👤 Finding/creating user...');
  let user = await prisma.user.findUnique({
    where: { email: 'isla@adaptic.ai' }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'isla@adaptic.ai',
        name: 'Isla Roselli',
        displayName: 'Isla',
        status: 'ACTIVE',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=isla',
        bio: 'Founder & CEO at Adaptic AI',
        preferences: {
          theme: 'dark',
          notifications: true,
          emailDigest: 'daily'
        }
      }
    });
    console.log(`  ✅ Created user: ${user.email}`);
  } else {
    // Update user status to ACTIVE
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        status: 'ACTIVE',
        name: user.name || 'Isla Roselli',
        displayName: user.displayName || 'Isla'
      }
    });
    console.log(`  ✅ Found existing user: ${user.email}`);
  }

  // 2. Create Organization
  console.log('\n🏢 Creating organization...');
  const organization = await prisma.organization.upsert({
    where: { slug: 'adaptic-ai' },
    update: {},
    create: {
      name: 'Adaptic AI',
      slug: 'adaptic-ai',
      description: 'AI-powered automation and orchestration platform',
      settings: {
        features: ['orchestrators', 'deployments', 'integrations'],
        plan: 'enterprise',
        maxWorkspaces: 10
      }
    }
  });
  console.log(`  ✅ Organization: ${organization.name}`);

  // 3. Add user as organization owner
  console.log('\n👥 Adding user to organization...');
  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: user.id
      }
    },
    update: { role: 'OWNER' },
    create: {
      organizationId: organization.id,
      userId: user.id,
      role: 'OWNER'
    }
  });
  console.log(`  ✅ User added as OWNER`);

  // 4. Create Disciplines
  console.log('\n🎯 Creating disciplines...');
  const disciplines = await Promise.all([
    prisma.discipline.upsert({
      where: { organizationId_name: { organizationId: organization.id, name: 'Engineering' } },
      update: {},
      create: {
        name: 'Engineering',
        description: 'Software development, DevOps, and infrastructure',
        color: '#3B82F6',
        icon: 'code',
        organizationId: organization.id
      }
    }),
    prisma.discipline.upsert({
      where: { organizationId_name: { organizationId: organization.id, name: 'Product' } },
      update: {},
      create: {
        name: 'Product',
        description: 'Product management and strategy',
        color: '#10B981',
        icon: 'lightbulb',
        organizationId: organization.id
      }
    }),
    prisma.discipline.upsert({
      where: { organizationId_name: { organizationId: organization.id, name: 'Design' } },
      update: {},
      create: {
        name: 'Design',
        description: 'UX/UI design and user research',
        color: '#F59E0B',
        icon: 'palette',
        organizationId: organization.id
      }
    }),
    prisma.discipline.upsert({
      where: { organizationId_name: { organizationId: organization.id, name: 'Data Science' } },
      update: {},
      create: {
        name: 'Data Science',
        description: 'Machine learning and data analytics',
        color: '#8B5CF6',
        icon: 'chart-bar',
        organizationId: organization.id
      }
    }),
    prisma.discipline.upsert({
      where: { organizationId_name: { organizationId: organization.id, name: 'Operations' } },
      update: {},
      create: {
        name: 'Operations',
        description: 'Business operations and customer success',
        color: '#EF4444',
        icon: 'cog',
        organizationId: organization.id
      }
    })
  ]);
  console.log(`  ✅ Created ${disciplines.length} disciplines`);

  // 5. Create Workspace
  console.log('\n🏠 Creating workspace...');
  const workspace = await prisma.workspace.upsert({
    where: {
      organizationId_slug: {
        organizationId: organization.id,
        slug: 'main-workspace'
      }
    },
    update: {},
    create: {
      name: 'Main Workspace',
      slug: 'main-workspace',
      description: 'Primary workspace for Adaptic AI team',
      visibility: 'PRIVATE',
      organizationId: organization.id,
      settings: {
        features: ['channels', 'orchestrators', 'deployments', 'integrations', 'agents'],
        defaultChannelId: null,
        allowGuestAccess: false
      }
    }
  });
  console.log(`  ✅ Workspace: ${workspace.name}`);

  // 6. Add user to workspace
  console.log('\n👥 Adding user to workspace...');
  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id
      }
    },
    update: { role: 'OWNER' },
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: 'OWNER'
    }
  });
  console.log(`  ✅ User added to workspace as OWNER`);

  // 7. Create Channels
  console.log('\n💬 Creating channels...');
  const channelsData = [
    { name: 'general', slug: 'general', description: 'General team discussions and announcements', type: 'PUBLIC' as const },
    { name: 'engineering', slug: 'engineering', description: 'Engineering team coordination and technical discussions', type: 'PUBLIC' as const },
    { name: 'product', slug: 'product', description: 'Product updates, roadmap, and feature discussions', type: 'PUBLIC' as const },
    { name: 'design', slug: 'design', description: 'Design reviews, UI/UX discussions, and assets', type: 'PUBLIC' as const },
    { name: 'data-science', slug: 'data-science', description: 'ML models, analytics, and data discussions', type: 'PUBLIC' as const },
    { name: 'random', slug: 'random', description: 'Off-topic conversations and fun stuff', type: 'PUBLIC' as const },
    { name: 'announcements', slug: 'announcements', description: 'Important company announcements', type: 'PUBLIC' as const },
    { name: 'leadership', slug: 'leadership', description: 'Executive team discussions', type: 'PRIVATE' as const },
    { name: 'orchestrator-logs', slug: 'orchestrator-logs', description: 'Automated logs from orchestrators', type: 'PUBLIC' as const },
    { name: 'deployments', slug: 'deployments', description: 'Deployment notifications and status updates', type: 'PUBLIC' as const }
  ];

  const channels = await Promise.all(
    channelsData.map(channelData =>
      prisma.channel.upsert({
        where: {
          workspaceId_slug: {
            workspaceId: workspace.id,
            slug: channelData.slug
          }
        },
        update: {},
        create: {
          ...channelData,
          workspaceId: workspace.id,
          createdById: user.id,
          settings: { notifications: 'all' }
        }
      })
    )
  );
  console.log(`  ✅ Created ${channels.length} channels`);

  // 8. Add user to channels
  console.log('\n👥 Adding user to channels...');
  await Promise.all(
    channels.map(channel =>
      prisma.channelMember.upsert({
        where: {
          channelId_userId: {
            channelId: channel.id,
            userId: user.id
          }
        },
        update: {},
        create: {
          channelId: channel.id,
          userId: user.id,
          role: 'OWNER'
        }
      })
    )
  );
  console.log(`  ✅ User added to all channels`);

  // 9. Create Orchestrator Users (AI users that back orchestrators)
  console.log('\n🤖 Creating orchestrator users...');
  const orchestratorUsersData = [
    {
      email: 'alice-engineer@adaptic.ai',
      name: 'Alice',
      displayName: 'Alice (Engineering)',
      discipline: 'Engineering',
      role: 'Senior Software Engineer'
    },
    {
      email: 'bob-product@adaptic.ai',
      name: 'Bob',
      displayName: 'Bob (Product)',
      discipline: 'Product',
      role: 'Product Manager'
    },
    {
      email: 'carol-design@adaptic.ai',
      name: 'Carol',
      displayName: 'Carol (Design)',
      discipline: 'Design',
      role: 'UX Designer'
    },
    {
      email: 'dave-data@adaptic.ai',
      name: 'Dave',
      displayName: 'Dave (Data Science)',
      discipline: 'Data Science',
      role: 'ML Engineer'
    },
    {
      email: 'eve-ops@adaptic.ai',
      name: 'Eve',
      displayName: 'Eve (Operations)',
      discipline: 'Operations',
      role: 'Operations Lead'
    }
  ];

  const orchestratorUsers = await Promise.all(
    orchestratorUsersData.map(async (orchData) => {
      const orchUser = await prisma.user.upsert({
        where: { email: orchData.email },
        update: {
          isOrchestrator: true,
          orchestratorConfig: {
            model: 'claude-3-5-sonnet',
            temperature: 0.7,
            maxTokens: 4096
          }
        },
        create: {
          email: orchData.email,
          name: orchData.name,
          displayName: orchData.displayName,
          status: 'ACTIVE',
          isOrchestrator: true,
          orchestratorConfig: {
            model: 'claude-3-5-sonnet',
            temperature: 0.7,
            maxTokens: 4096
          },
          avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${orchData.name.toLowerCase()}`
        }
      });
      return { ...orchUser, discipline: orchData.discipline, role: orchData.role };
    })
  );
  console.log(`  ✅ Created ${orchestratorUsers.length} orchestrator users`);

  // 10. Create Orchestrator records
  console.log('\n🤖 Creating orchestrators...');
  const orchestrators = await Promise.all(
    orchestratorUsers.map(async (orchUser) => {
      const discipline = disciplines.find(d => d.name === orchUser.discipline);
      return prisma.orchestrator.upsert({
        where: { userId: orchUser.id },
        update: {
          status: 'ONLINE',
          discipline: orchUser.discipline,
          role: orchUser.role
        },
        create: {
          userId: orchUser.id,
          organizationId: organization.id,
          workspaceId: workspace.id,
          disciplineId: discipline?.id,
          discipline: orchUser.discipline,
          role: orchUser.role,
          status: 'ONLINE',
          capabilities: [
            'task_execution',
            'code_review',
            'documentation',
            'communication'
          ]
        }
      });
    })
  );
  console.log(`  ✅ Created ${orchestrators.length} orchestrators`);

  // 11. Add orchestrator users to organization and workspace
  console.log('\n👥 Adding orchestrators to organization and workspace...');
  await Promise.all(
    orchestratorUsers.map(async (orchUser) => {
      await prisma.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: organization.id,
            userId: orchUser.id
          }
        },
        update: {},
        create: {
          organizationId: organization.id,
          userId: orchUser.id,
          role: 'MEMBER'
        }
      });
      await prisma.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: workspace.id,
            userId: orchUser.id
          }
        },
        update: {},
        create: {
          workspaceId: workspace.id,
          userId: orchUser.id,
          role: 'MEMBER'
        }
      });
    })
  );
  console.log(`  ✅ Orchestrators added to organization and workspace`);

  // 12. Create Messages in channels (only if no messages exist)
  console.log('\n💬 Creating sample messages...');
  const generalChannel = channels.find(c => c.slug === 'general');
  const engineeringChannel = channels.find(c => c.slug === 'engineering');

  const existingMessageCount = await prisma.message.count({
    where: {
      channel: {
        workspaceId: workspace.id
      }
    }
  });

  if (generalChannel && engineeringChannel && existingMessageCount === 0) {
    const messagesData = [
      { channel: generalChannel, author: user, content: 'Welcome to Adaptic AI! 🎉 This workspace is now fully set up and ready for use.' },
      { channel: generalChannel, author: orchestratorUsers[0], content: 'Hello everyone! I\'m Alice, your engineering orchestrator. Ready to help with any technical tasks.' },
      { channel: generalChannel, author: orchestratorUsers[1], content: 'Hi team! Bob here - I\'ll be handling product management tasks. Let me know how I can help!' },
      { channel: engineeringChannel, author: user, content: 'Let\'s discuss our next sprint priorities.' },
      { channel: engineeringChannel, author: orchestratorUsers[0], content: 'I\'ve analyzed the backlog and here are my recommendations for the sprint:\n1. API performance optimization\n2. Database migration\n3. Frontend component refactoring' },
      { channel: engineeringChannel, author: orchestratorUsers[3], content: 'From a data perspective, we should also consider implementing better logging for ML model performance tracking.' }
    ];

    await Promise.all(
      messagesData.map((msg, index) =>
        prisma.message.create({
          data: {
            content: msg.content,
            type: 'TEXT',
            channelId: msg.channel.id,
            authorId: msg.author.id,
            createdAt: new Date(Date.now() - (messagesData.length - index) * 60000)
          }
        })
      )
    );
    console.log(`  ✅ Created ${messagesData.length} sample messages`);
  } else {
    console.log(`  ⏭️ Messages already exist, skipping`);
  }

  // 13. Create Tasks (only if no tasks exist)
  console.log('\n📋 Creating tasks...');
  const aliceOrchestrator = orchestrators.find(o => o.discipline === 'Engineering');
  const bobOrchestrator = orchestrators.find(o => o.discipline === 'Product');

  const existingTaskCount = await prisma.task.count({
    where: { workspaceId: workspace.id }
  });

  if (aliceOrchestrator && bobOrchestrator && existingTaskCount === 0) {
    const tasksData = [
      { title: 'Implement user authentication API', description: 'Build OAuth2 authentication endpoints', priority: 'HIGH' as const, status: 'IN_PROGRESS' as const, orchestratorId: aliceOrchestrator.id },
      { title: 'Database schema optimization', description: 'Optimize queries and add proper indexes', priority: 'MEDIUM' as const, status: 'TODO' as const, orchestratorId: aliceOrchestrator.id },
      { title: 'API documentation', description: 'Generate OpenAPI docs for all endpoints', priority: 'LOW' as const, status: 'TODO' as const, orchestratorId: aliceOrchestrator.id },
      { title: 'Product roadmap Q1', description: 'Define product roadmap for Q1 2025', priority: 'CRITICAL' as const, status: 'DONE' as const, orchestratorId: bobOrchestrator.id },
      { title: 'User feedback analysis', description: 'Analyze user feedback from last month', priority: 'HIGH' as const, status: 'IN_PROGRESS' as const, orchestratorId: bobOrchestrator.id },
      { title: 'Feature prioritization', description: 'Prioritize features based on user impact', priority: 'MEDIUM' as const, status: 'TODO' as const, orchestratorId: bobOrchestrator.id }
    ];

    await Promise.all(
      tasksData.map(taskData =>
        prisma.task.create({
          data: {
            ...taskData,
            workspaceId: workspace.id,
            createdById: user.id,
            tags: ['q1-2025', 'priority'],
            metadata: { source: 'seed' }
          }
        })
      )
    );
    console.log(`  ✅ Created ${tasksData.length} tasks`);
  } else {
    console.log(`  ⏭️ Tasks already exist, skipping`);
  }

  // 14. Create Integrations (only if none exist)
  console.log('\n🔗 Creating integrations...');
  const existingIntegrationCount = await prisma.integration.count({
    where: { workspaceId: workspace.id }
  });

  const integrationsData = [
    { name: 'GitHub', provider: 'GITHUB' as const, status: 'ACTIVE' as const, config: { repo: 'adaptic-ai/main', webhooks: true } },
    { name: 'Slack', provider: 'SLACK' as const, status: 'ACTIVE' as const, config: { workspace: 'adaptic-ai', channels: ['#general', '#engineering'] } },
    { name: 'Linear', provider: 'LINEAR' as const, status: 'PENDING' as const, config: { teamId: 'adaptic' } },
    { name: 'Notion', provider: 'NOTION' as const, status: 'ACTIVE' as const, config: { workspace: 'Adaptic AI', pages: ['Roadmap', 'Wiki'] } }
  ];

  if (existingIntegrationCount === 0) {
    await Promise.all(
      integrationsData.map(integrationData =>
        prisma.integration.create({
          data: {
            ...integrationData,
            workspaceId: workspace.id,
            connectedBy: user.id,
            connectedAt: integrationData.status === 'ACTIVE' ? new Date() : null,
            syncEnabled: integrationData.status === 'ACTIVE'
          }
        })
      )
    );
    console.log(`  ✅ Created ${integrationsData.length} integrations`);
  } else {
    console.log(`  ⏭️ Integrations already exist, skipping`);
  }

  // 15. Create Deployments (only if none exist)
  console.log('\n🚀 Creating deployments...');
  const existingDeploymentCount = await prisma.deployment.count({
    where: { workspaceId: workspace.id }
  });

  const deploymentsData = [
    {
      name: 'API Server',
      type: 'SERVICE' as const,
      status: 'ACTIVE' as const,
      environment: 'PRODUCTION' as const,
      version: '2.3.1',
      url: 'https://api.adaptic.ai',
      commitHash: 'abc123def456',
      branch: 'main'
    },
    {
      name: 'Web App',
      type: 'SERVICE' as const,
      status: 'ACTIVE' as const,
      environment: 'PRODUCTION' as const,
      version: '1.8.0',
      url: 'https://app.adaptic.ai',
      commitHash: 'def456ghi789',
      branch: 'main'
    },
    {
      name: 'ML Pipeline',
      type: 'SERVICE' as const,
      status: 'ACTIVE' as const,
      environment: 'STAGING' as const,
      version: '0.5.2',
      url: 'https://ml-staging.adaptic.ai',
      commitHash: 'ghi789jkl012',
      branch: 'develop'
    },
    {
      name: 'Alice Agent',
      type: 'AGENT' as const,
      status: 'ACTIVE' as const,
      environment: 'PRODUCTION' as const,
      version: '1.0.0'
    },
    {
      name: 'Bob Agent',
      type: 'AGENT' as const,
      status: 'ACTIVE' as const,
      environment: 'PRODUCTION' as const,
      version: '1.0.0'
    },
    {
      name: 'Data Sync Workflow',
      type: 'WORKFLOW' as const,
      status: 'ACTIVE' as const,
      environment: 'PRODUCTION' as const,
      version: '0.2.0'
    }
  ];

  let deployments: any[] = [];
  if (existingDeploymentCount === 0) {
    deployments = await Promise.all(
      deploymentsData.map(deploymentData =>
        prisma.deployment.create({
          data: {
            ...deploymentData,
            workspaceId: workspace.id,
            createdById: user.id,
            startedAt: new Date(Date.now() - 86400000),
            completedAt: new Date(Date.now() - 86000000),
            deployedAt: new Date(Date.now() - 85000000),
            duration: 400,
            config: { autoScaling: true, replicas: 2 },
            health: { status: 'healthy', lastCheck: new Date().toISOString() },
            stats: { requests: 15000, errors: 12, latency: 45 }
          }
        })
      )
    );
    console.log(`  ✅ Created ${deployments.length} deployments`);
  } else {
    deployments = await prisma.deployment.findMany({
      where: { workspaceId: workspace.id }
    });
    console.log(`  ⏭️ Deployments already exist, skipping`);
  }

  // 16. Create Deployment Logs (only if API deployment has no logs)
  console.log('\n📝 Creating deployment logs...');
  const apiDeployment = deployments.find(d => d.name === 'API Server');
  if (apiDeployment) {
    const existingLogCount = await prisma.deploymentLog.count({
      where: { deploymentId: apiDeployment.id }
    });

    if (existingLogCount === 0) {
      const logsData = [
        { level: 'INFO' as const, message: 'Starting deployment process...' },
        { level: 'INFO' as const, message: 'Pulling latest code from repository' },
        { level: 'INFO' as const, message: 'Installing dependencies...' },
        { level: 'INFO' as const, message: 'Running build command: npm run build' },
        { level: 'INFO' as const, message: 'Build completed successfully' },
        { level: 'INFO' as const, message: 'Running database migrations' },
        { level: 'WARN' as const, message: 'Slow migration detected: 0003_add_indexes.sql' },
        { level: 'INFO' as const, message: 'Starting health checks' },
        { level: 'INFO' as const, message: 'All health checks passed' },
        { level: 'INFO' as const, message: 'Deployment completed successfully ✓' }
      ];

      await Promise.all(
        logsData.map((logData, index) =>
          prisma.deploymentLog.create({
            data: {
              ...logData,
              deploymentId: apiDeployment.id,
              timestamp: new Date(Date.now() - (logsData.length - index) * 10000)
            }
          })
        )
      );
      console.log(`  ✅ Created ${logsData.length} deployment logs`);
    } else {
      console.log(`  ⏭️ Deployment logs already exist, skipping`);
    }
  }

  // 17. Create Agents (only if none exist)
  console.log('\n🤖 Creating AI agents...');
  const existingAgentCount = await prisma.agent.count({
    where: { workspaceId: workspace.id }
  });

  const agentsData = [
    {
      name: 'Code Review Agent',
      type: 'CODING' as const,
      status: 'ACTIVE' as const,
      description: 'Automated code review and suggestions',
      model: 'claude-3-5-sonnet',
      temperature: 0.3,
      tools: ['code_analysis', 'git_diff', 'static_analysis'],
      systemPrompt: 'You are a code review expert. Analyze code changes and provide constructive feedback.'
    },
    {
      name: 'Research Agent',
      type: 'RESEARCH' as const,
      status: 'ACTIVE' as const,
      description: 'Research and information gathering',
      model: 'claude-3-5-sonnet',
      temperature: 0.7,
      tools: ['web_search', 'document_analysis', 'summarization'],
      systemPrompt: 'You are a research assistant. Help gather and analyze information from various sources.'
    },
    {
      name: 'QA Agent',
      type: 'QA' as const,
      status: 'ACTIVE' as const,
      description: 'Quality assurance and testing automation',
      model: 'claude-3-5-sonnet',
      temperature: 0.2,
      tools: ['test_runner', 'bug_reporter', 'coverage_analysis'],
      systemPrompt: 'You are a QA specialist. Help identify bugs, write tests, and ensure software quality.'
    },
    {
      name: 'Data Analysis Agent',
      type: 'DATA' as const,
      status: 'PAUSED' as const,
      description: 'Data analysis and visualization',
      model: 'claude-3-5-sonnet',
      temperature: 0.5,
      tools: ['sql_query', 'data_visualization', 'statistical_analysis'],
      systemPrompt: 'You are a data analyst. Help analyze data, create visualizations, and derive insights.'
    },
    {
      name: 'Support Agent',
      type: 'SUPPORT' as const,
      status: 'ACTIVE' as const,
      description: 'Customer support automation',
      model: 'claude-3-5-sonnet',
      temperature: 0.6,
      tools: ['knowledge_base', 'ticket_management', 'escalation'],
      systemPrompt: 'You are a customer support specialist. Help resolve customer issues efficiently and empathetically.'
    }
  ];

  if (existingAgentCount === 0) {
    await Promise.all(
      agentsData.map(agentData =>
        prisma.agent.create({
          data: {
            ...agentData,
            workspaceId: workspace.id,
            createdById: user.id,
            tasksCompleted: Math.floor(Math.random() * 100),
            successRate: 0.85 + Math.random() * 0.14,
            avgResponseTime: 1.5 + Math.random() * 2,
            tokensUsed: Math.floor(Math.random() * 100000),
            totalCost: Math.random() * 50,
            lastActiveAt: new Date(Date.now() - Math.random() * 86400000)
          }
        })
      )
    );
    console.log(`  ✅ Created ${agentsData.length} agents`);
  } else {
    console.log(`  ⏭️ Agents already exist, skipping`);
  }

  // 18. Create Workflows
  console.log('\n⚡ Creating workflows...');
  const workflowsData = [
    {
      name: 'New PR Review',
      description: 'Automatically review new pull requests',
      status: 'ACTIVE' as const,
      trigger: { type: 'github_pr', event: 'opened' },
      actions: [
        { type: 'code_review', agent: 'Code Review Agent' },
        { type: 'notify', channel: 'engineering' }
      ],
      tags: ['automation', 'github']
    },
    {
      name: 'Daily Standup Summary',
      description: 'Generate daily standup summary from task updates',
      status: 'ACTIVE' as const,
      trigger: { type: 'schedule', cron: '0 9 * * 1-5' },
      actions: [
        { type: 'aggregate_updates', timeRange: '24h' },
        { type: 'summarize', agent: 'Research Agent' },
        { type: 'post', channel: 'general' }
      ],
      tags: ['automation', 'daily']
    },
    {
      name: 'Deployment Notification',
      description: 'Notify team of deployment status changes',
      status: 'ACTIVE' as const,
      trigger: { type: 'deployment', event: 'status_change' },
      actions: [
        { type: 'notify', channel: 'deployments' },
        { type: 'update_status', dashboard: true }
      ],
      tags: ['automation', 'deployment']
    }
  ];

  await Promise.all(
    workflowsData.map(workflowData =>
      prisma.workflow.upsert({
        where: {
          workspaceId_name: {
            workspaceId: workspace.id,
            name: workflowData.name
          }
        },
        update: {},
        create: {
          ...workflowData,
          workspaceId: workspace.id,
          createdBy: user.id,
          executionCount: Math.floor(Math.random() * 50),
          successCount: Math.floor(Math.random() * 45),
          failureCount: Math.floor(Math.random() * 5)
        }
      })
    )
  );
  console.log(`  ✅ Created ${workflowsData.length} workflows`);

  // 19. Create Webhooks (only if none exist)
  console.log('\n🔔 Creating webhooks...');
  const existingWebhookCount = await prisma.webhook.count({
    where: { workspaceId: workspace.id }
  });

  const webhooksData = [
    {
      name: 'GitHub Events',
      url: 'https://api.adaptic.ai/webhooks/github',
      events: ['push', 'pull_request', 'issues'],
      status: 'ACTIVE' as const
    },
    {
      name: 'Slack Events',
      url: 'https://api.adaptic.ai/webhooks/slack',
      events: ['message', 'reaction', 'channel_created'],
      status: 'ACTIVE' as const
    },
    {
      name: 'External Integration',
      url: 'https://external-service.example.com/callback',
      events: ['deployment.completed', 'task.completed'],
      status: 'INACTIVE' as const
    }
  ];

  if (existingWebhookCount === 0) {
    await Promise.all(
      webhooksData.map(webhookData =>
        prisma.webhook.create({
          data: {
            ...webhookData,
            workspaceId: workspace.id,
            createdById: user.id,
            secret: `whsec_${Math.random().toString(36).substring(2, 15)}`
          }
        })
      )
    );
    console.log(`  ✅ Created ${webhooksData.length} webhooks`);
  } else {
    console.log(`  ⏭️ Webhooks already exist, skipping`);
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ WORKSPACE POPULATION COMPLETE');
  console.log('='.repeat(60));
  console.log(`
📊 Summary:
  - User: ${user.email}
  - Organization: ${organization.name} (${organization.slug})
  - Workspace: ${workspace.name} (${workspace.slug})
  - Channels: ${channels.length}
  - Orchestrators: ${orchestrators.length}
  - Disciplines: ${disciplines.length}
  - Integrations: ${integrationsData.length}
  - Deployments: ${deploymentsData.length}
  - Agents: ${agentsData.length}
  - Workflows: ${workflowsData.length}
  - Webhooks: ${webhooksData.length}

🌐 Access the workspace at:
  http://localhost:3000/${workspace.slug}
`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('❌ Seed failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
