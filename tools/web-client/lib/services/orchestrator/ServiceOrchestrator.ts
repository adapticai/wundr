export interface Service {
  id: string;
  name: string;
  type: 'api' | 'worker' | 'scheduler' | 'processor' | 'monitor';
  status: 'idle' | 'running' | 'error' | 'stopped';
  config: ServiceConfig;
  metrics: ServiceMetrics;
  dependencies: string[];
  createdAt: Date;
  lastActivity: Date;
}

export interface ServiceConfig {
  endpoint?: string;
  interval?: number;
  maxRetries?: number;
  timeout?: number;
  concurrency?: number;
  autoStart?: boolean;
  [key: string]: any;
}

export interface ServiceMetrics {
  requests: number;
  errors: number;
  avgResponseTime: number;
  uptime: number;
  lastError?: string;
  lastErrorAt?: Date;
}

export interface ServiceTask {
  id: string;
  serviceId: string;
  type: string;
  payload: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export class ServiceOrchestrator {
  private services: Map<string, Service> = new Map();
  private tasks: Map<string, ServiceTask> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private baseUrl: string;

  constructor(baseUrl = '/api/services') {
    this.baseUrl = baseUrl;
    this.initializeDefaultServices();
  }

  private initializeDefaultServices() {
    const defaults: Service[] = [
      {
        id: 'analysis-worker',
        name: 'Analysis Worker',
        type: 'worker',
        status: 'idle',
        config: {
          concurrency: 5,
          timeout: 30000,
          autoStart: true,
        },
        metrics: {
          requests: 0,
          errors: 0,
          avgResponseTime: 0,
          uptime: 0,
        },
        dependencies: [],
        createdAt: new Date(),
        lastActivity: new Date(),
      },
      {
        id: 'report-scheduler',
        name: 'Report Scheduler',
        type: 'scheduler',
        status: 'idle',
        config: {
          interval: 3600000, // 1 hour
          autoStart: false,
        },
        metrics: {
          requests: 0,
          errors: 0,
          avgResponseTime: 0,
          uptime: 0,
        },
        dependencies: ['analysis-worker'],
        createdAt: new Date(),
        lastActivity: new Date(),
      },
    ];

    defaults.forEach(s => this.services.set(s.id, s));
  }

  async getServices(): Promise<Service[]> {
    try {
      const response = await fetch(this.baseUrl);
      if (!response.ok) throw new Error('Failed to fetch services');
      return await response.json();
    } catch {
      return Array.from(this.services.values());
    }
  }

  async getService(id: string): Promise<Service | null> {
    try {
      const response = await fetch(`${this.baseUrl}/${id}`);
      if (!response.ok) throw new Error('Failed to fetch service');
      return await response.json();
    } catch {
      return this.services.get(id) || null;
    }
  }

  async registerService(service: Partial<Service>): Promise<Service> {
    const newService: Service = {
      id: service.id || `service-${Date.now()}`,
      name: service.name || 'Unnamed Service',
      type: service.type || 'worker',
      status: 'idle',
      config: service.config || {},
      metrics: {
        requests: 0,
        errors: 0,
        avgResponseTime: 0,
        uptime: 0,
      },
      dependencies: service.dependencies || [],
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newService),
      });
      if (!response.ok) throw new Error('Failed to register service');
      const registered = await response.json();
      this.services.set(registered.id, registered);
      return registered;
    } catch {
      this.services.set(newService.id, newService);
      if (newService.config.autoStart) {
        await this.startService(newService.id);
      }
      return newService;
    }
  }

  async startService(id: string): Promise<boolean> {
    const service = await this.getService(id);
    if (!service) return false;

    // Check dependencies
    for (const depId of service.dependencies) {
      const dep = await this.getService(depId);
      if (!dep || dep.status !== 'running') {
        await this.startService(depId);
      }
    }

    service.status = 'running';
    service.lastActivity = new Date();
    this.services.set(id, service);

    // Start scheduled tasks
    if (service.type === 'scheduler' && service.config.interval) {
      const interval = setInterval(() => {
        this.executeScheduledTask(id);
      }, service.config.interval);
      this.intervals.set(id, interval);
    }

    return true;
  }

  async stopService(id: string): Promise<boolean> {
    const service = await this.getService(id);
    if (!service) return false;

    service.status = 'stopped';
    service.lastActivity = new Date();
    this.services.set(id, service);

    // Clear intervals
    const interval = this.intervals.get(id);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(id);
    }

    // Stop dependent services
    const dependents = Array.from(this.services.values()).filter(s =>
      s.dependencies.includes(id)
    );

    for (const dependent of dependents) {
      await this.stopService(dependent.id);
    }

    return true;
  }

  async restartService(id: string): Promise<boolean> {
    await this.stopService(id);
    await new Promise(resolve => setTimeout(resolve, 1000));
    return await this.startService(id);
  }

  async executeTask(
    serviceId: string,
    taskType: string,
    payload: any
  ): Promise<ServiceTask> {
    const service = await this.getService(serviceId);
    if (!service || service.status !== 'running') {
      throw new Error(`Service ${serviceId} is not available`);
    }

    const task: ServiceTask = {
      id: `task-${Date.now()}`,
      serviceId,
      type: taskType,
      payload,
      status: 'pending',
      createdAt: new Date(),
    };

    this.tasks.set(task.id, task);

    // Simulate task execution
    setTimeout(() => this.processTask(task.id), 100);

    return task;
  }

  private async processTask(taskId: string) {
    const task = this.tasks.get(taskId);
    if (!task) return;

    const service = this.services.get(task.serviceId);
    if (!service) return;

    task.status = 'running';
    task.startedAt = new Date();

    try {
      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));

      task.status = 'completed';
      task.result = { success: true, data: 'Task completed' };

      // Update metrics
      service.metrics.requests++;
      const duration = Date.now() - task.startedAt.getTime();
      service.metrics.avgResponseTime =
        (service.metrics.avgResponseTime * (service.metrics.requests - 1) +
          duration) /
        service.metrics.requests;
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';

      service.metrics.errors++;
      service.metrics.lastError = task.error;
      service.metrics.lastErrorAt = new Date();
    }

    task.completedAt = new Date();
    service.lastActivity = new Date();

    this.tasks.set(taskId, task);
    this.services.set(service.id, service);
  }

  private async executeScheduledTask(serviceId: string) {
    const service = this.services.get(serviceId);
    if (!service || service.status !== 'running') return;

    await this.executeTask(serviceId, 'scheduled', {
      timestamp: new Date(),
      config: service.config,
    });
  }

  async getServiceMetrics(id: string): Promise<ServiceMetrics | null> {
    const service = await this.getService(id);
    return service ? service.metrics : null;
  }

  async getServiceTasks(serviceId: string): Promise<ServiceTask[]> {
    return Array.from(this.tasks.values())
      .filter(t => t.serviceId === serviceId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getTask(taskId: string): Promise<ServiceTask | null> {
    return this.tasks.get(taskId) || null;
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    services: Array<{ id: string; status: string }>;
  }> {
    const services = Array.from(this.services.values());
    const serviceStatuses = services.map(s => ({
      id: s.id,
      status: s.status,
    }));

    const healthy = services.every(s => s.status !== 'error');

    return { healthy, services: serviceStatuses };
  }

  async orchestrate(workflow: {
    name: string;
    steps: Array<{ serviceId: string; taskType: string; payload: any }>;
  }): Promise<{ success: boolean; results: any[] }> {
    const results: any[] = [];

    for (const step of workflow.steps) {
      try {
        const task = await this.executeTask(
          step.serviceId,
          step.taskType,
          step.payload
        );

        // Wait for task completion
        let attempts = 0;
        while (task.status === 'pending' || task.status === 'running') {
          await new Promise(resolve => setTimeout(resolve, 100));
          const updated = await this.getTask(task.id);
          if (updated) Object.assign(task, updated);

          if (++attempts > 100) {
            throw new Error('Task timeout');
          }
        }

        if (task.status === 'failed') {
          throw new Error(task.error || 'Task failed');
        }

        results.push(task.result);
      } catch (error) {
        return {
          success: false,
          results: [
            ...results,
            { error: error instanceof Error ? error.message : 'Unknown error' },
          ],
        };
      }
    }

    return { success: true, results };
  }

  async getSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Array<{ id: string; status: string; uptime: number }>;
    totalMemory: number;
    usedMemory: number;
    cpuUsage: number;
  }> {
    const services = Array.from(this.services.values());
    const healthyServices = services.filter(s => s.status === 'running');
    const totalServices = services.length;

    const status =
      totalServices === 0
        ? 'unhealthy'
        : healthyServices.length === totalServices
          ? 'healthy'
          : healthyServices.length > totalServices * 0.5
            ? 'degraded'
            : 'unhealthy';

    return {
      status,
      services: services.map(s => ({
        id: s.id,
        status: s.status,
        uptime: Date.now() - s.createdAt.getTime(),
      })),
      totalMemory: 1024, // Mock values
      usedMemory: 512,
      cpuUsage: Math.random() * 100,
    };
  }

  async getMetrics(): Promise<{
    servicesRunning: number;
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    avgResponseTime: number;
    uptime: number;
  }> {
    const services = Array.from(this.services.values());
    const tasks = Array.from(this.tasks.values());
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const failedTasks = tasks.filter(t => t.status === 'failed');

    const avgResponseTime =
      services.length > 0
        ? services.reduce((sum, s) => sum + s.metrics.avgResponseTime, 0) /
          services.length
        : 0;

    return {
      servicesRunning: services.filter(s => s.status === 'running').length,
      totalTasks: tasks.length,
      completedTasks: completedTasks.length,
      failedTasks: failedTasks.length,
      avgResponseTime,
      uptime: Date.now() - (services[0]?.createdAt.getTime() || Date.now()),
    };
  }

  async getAllInstances(): Promise<Service[]> {
    return Array.from(this.services.values());
  }

  async getAllServices(): Promise<Service[]> {
    return this.getServices();
  }

  // Note: startService method already exists above
  // Note: registerService method already exists above

  cleanup() {
    // Clear all intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();

    // Clear old tasks
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
    const oldTasks = Array.from(this.tasks.values()).filter(
      t => t.completedAt && t.completedAt.getTime() < cutoff
    );

    oldTasks.forEach(t => this.tasks.delete(t.id));
  }
}

export const serviceOrchestrator = new ServiceOrchestrator();
