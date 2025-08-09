// Simple debug test to understand the agent selection logic
const { AgentCoordinator } = require('./dist/agents/AgentCoordinator');

async function debugTest() {
  const mockConfig = {
    maxConcurrentAgents: 20,
    spawningStrategy: 'adaptive',
    healthCheckInterval: 5000,
    autoRecovery: true,
    loadBalancing: true
  };

  const coordinator = new AgentCoordinator(mockConfig);
  await coordinator.initialize();

  // Create test agents
  const agents = [
    {
      id: 'coder-1',
      type: 'coder',
      category: 'core',
      capabilities: ['coding', 'implementation'],
      status: 'idle',
      topology: 'mesh',
      sessionId: 'test-session',
      createdAt: new Date(),
      metrics: {
        tasksCompleted: 0,
        successRate: 1,
        averageResponseTime: 0,
        healthScore: 100
      }
    },
    {
      id: 'reviewer-1',
      type: 'reviewer',
      category: 'core', 
      capabilities: ['code-review', 'quality-assurance', 'coding'],
      status: 'idle',
      topology: 'mesh',
      sessionId: 'test-session',
      createdAt: new Date(),
      metrics: {
        tasksCompleted: 0,
        successRate: 1,
        averageResponseTime: 0,
        healthScore: 100
      }
    },
    {
      id: 'tester-1',
      type: 'tester',
      category: 'core',
      capabilities: ['testing', 'validation', 'coding'],
      status: 'idle',
      topology: 'mesh', 
      sessionId: 'test-session',
      createdAt: new Date(),
      metrics: {
        tasksCompleted: 0,
        successRate: 1,
        averageResponseTime: 0,
        healthScore: 100
      }
    },
    {
      id: 'ml-dev-1',
      type: 'ml-developer',
      category: 'specialized',
      capabilities: ['machine-learning', 'data-analysis', 'coding'],
      status: 'idle',
      topology: 'mesh',
      sessionId: 'test-session',
      createdAt: new Date(),
      metrics: {
        tasksCompleted: 0,
        successRate: 1,
        averageResponseTime: 0,
        healthScore: 100
      }
    }
  ];

  // Register agents
  for (const agent of agents) {
    await coordinator.registerAgent(agent);
  }

  console.log('Registered agents:', coordinator.agents.size);

  // Create initial task
  const mockTask = {
    id: 'test-task-1',
    title: 'Test Task',
    description: 'A test coding task',
    type: 'coding',
    priority: 'medium',
    status: 'pending',
    assignedAgents: [],
    requiredCapabilities: ['coding'],
    context: {},
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // First selection - make one agent busy
  console.log('\n=== First Task Assignment ===');
  const busyAgent = await coordinator.selectAgentsForTask(mockTask);
  console.log('Selected for first task:', busyAgent.map(a => ({ id: a.id, status: a.status })));

  if (busyAgent.length > 0) {
    await coordinator.assignTask(mockTask, busyAgent);
    console.log('Agent status after assignment:', busyAgent.map(a => ({ id: a.id, status: a.status })));
  }

  // Second selection - should prefer idle agents
  console.log('\n=== Second Task Assignment ===');
  const newTask = {
    ...mockTask,
    id: 'new-task',
    requiredCapabilities: ['coding']
  };

  const selectedAgents = await coordinator.selectAgentsForTask(newTask);
  console.log('Selected for second task:', selectedAgents.map(a => ({ id: a.id, status: a.status, capabilities: a.capabilities })));
  console.log('Has idle agents:', selectedAgents.some(agent => agent.status === 'idle'));

  // Check complex task diversity
  console.log('\n=== Complex Task (Diversity Test) ===');
  const complexTask = {
    ...mockTask,
    id: 'complex-task',
    type: 'coding',
    requiredCapabilities: ['coding', 'testing', 'code-review'],
    description: 'Complex task requiring multiple skills'
  };

  const diverseAgents = await coordinator.selectAgentsForTask(complexTask);
  console.log('Selected for complex task:', diverseAgents.map(a => ({ id: a.id, status: a.status, category: a.category, capabilities: a.capabilities })));
  const categories = [...new Set(diverseAgents.map(agent => agent.category))];
  console.log('Unique categories:', categories, 'Count:', categories.length);

  await coordinator.shutdown();
}

debugTest().catch(console.error);