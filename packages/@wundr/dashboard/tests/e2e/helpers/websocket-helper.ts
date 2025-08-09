import { Page } from '@playwright/test';

export class WebSocketHelper {
  readonly page: Page;
  private mockServer: any = null;

  constructor(page: Page) {
    this.page = page;
  }

  async setupWebSocketMock() {
    // Mock WebSocket connections
    await this.page.addInitScript(() => {
      class MockWebSocket {
        static CONNECTING = 0;
        static OPEN = 1;
        static CLOSING = 2;
        static CLOSED = 3;

        readyState = MockWebSocket.CONNECTING;
        url: string;
        protocol: string;
        onopen: ((event: Event) => void) | null = null;
        onclose: ((event: CloseEvent) => void) | null = null;
        onmessage: ((event: MessageEvent) => void) | null = null;
        onerror: ((event: Event) => void) | null = null;

        private listeners: Record<string, Function[]> = {};

        constructor(url: string, protocols?: string | string[]) {
          this.url = url;
          this.protocol = Array.isArray(protocols) ? protocols[0] : protocols || '';
          
          // Simulate connection opening
          setTimeout(() => {
            this.readyState = MockWebSocket.OPEN;
            if (this.onopen) {
              this.onopen(new Event('open'));
            }
            this.dispatchEvent('open', new Event('open'));
          }, 100);

          // Store reference for test control
          (window as any).__mockWebSocket = this;
        }

        send(data: string) {
          if (this.readyState !== MockWebSocket.OPEN) {
            throw new Error('WebSocket is not open');
          }
          console.log('Mock WebSocket send:', data);
        }

        close(code?: number, reason?: string) {
          this.readyState = MockWebSocket.CLOSING;
          setTimeout(() => {
            this.readyState = MockWebSocket.CLOSED;
            if (this.onclose) {
              this.onclose(new CloseEvent('close', { code: code || 1000, reason: reason || '' }));
            }
            this.dispatchEvent('close', new CloseEvent('close', { code: code || 1000, reason: reason || '' }));
          }, 10);
        }

        addEventListener(type: string, listener: Function) {
          if (!this.listeners[type]) {
            this.listeners[type] = [];
          }
          this.listeners[type].push(listener);
        }

        removeEventListener(type: string, listener: Function) {
          if (this.listeners[type]) {
            const index = this.listeners[type].indexOf(listener);
            if (index !== -1) {
              this.listeners[type].splice(index, 1);
            }
          }
        }

        dispatchEvent(type: string, event: Event) {
          if (this.listeners[type]) {
            this.listeners[type].forEach(listener => listener(event));
          }
        }

        // Test helper methods
        simulateMessage(data: any) {
          if (this.readyState === MockWebSocket.OPEN) {
            const event = new MessageEvent('message', { data: JSON.stringify(data) });
            if (this.onmessage) {
              this.onmessage(event);
            }
            this.dispatchEvent('message', event);
          }
        }

        simulateError() {
          const event = new Event('error');
          if (this.onerror) {
            this.onerror(event);
          }
          this.dispatchEvent('error', event);
        }
      }

      (window as any).WebSocket = MockWebSocket;
    });
  }

  async sendMockMessage(data: any) {
    await this.page.evaluate((data) => {
      const mockWs = (window as any).__mockWebSocket;
      if (mockWs) {
        mockWs.simulateMessage(data);
      }
    }, data);
  }

  async simulateWebSocketError() {
    await this.page.evaluate(() => {
      const mockWs = (window as any).__mockWebSocket;
      if (mockWs) {
        mockWs.simulateError();
      }
    });
  }

  async simulateReconnection() {
    await this.page.evaluate(() => {
      const mockWs = (window as any).__mockWebSocket;
      if (mockWs) {
        mockWs.close();
        // Simulate reconnection after delay
        setTimeout(() => {
          mockWs.readyState = 1; // OPEN
          if (mockWs.onopen) {
            mockWs.onopen(new Event('open'));
          }
        }, 1000);
      }
    });
  }

  async sendRealtimeMetrics() {
    const metricsData = {
      type: 'metrics',
      data: {
        cpu: Math.floor(Math.random() * 100),
        memory: Math.floor(Math.random() * 100),
        disk: Math.floor(Math.random() * 100),
        network: Math.floor(Math.random() * 50),
        activeConnections: Math.floor(Math.random() * 200),
        timestamp: new Date().toISOString()
      },
      timestamp: new Date(),
      id: `metrics_${Date.now()}`
    };

    await this.sendMockMessage(metricsData);
  }

  async sendBuildEvent(status: 'started' | 'completed' | 'failed', progress?: number) {
    const buildEvent = {
      type: 'build_event',
      data: {
        id: `build_${Date.now()}`,
        type: 'build',
        status,
        message: `Build ${status}`,
        progress: progress || (status === 'completed' ? 100 : Math.floor(Math.random() * 100)),
        timestamp: new Date().toISOString()
      },
      timestamp: new Date(),
      id: `build_${Date.now()}`
    };

    await this.sendMockMessage(buildEvent);
  }

  async sendDependencyUpdate(packageName: string, oldVersion: string, newVersion: string) {
    const dependencyEvent = {
      type: 'dependency_update',
      data: {
        id: `dep_${Date.now()}`,
        package: packageName,
        oldVersion,
        newVersion,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date(),
      id: `dep_${Date.now()}`
    };

    await this.sendMockMessage(dependencyEvent);
  }

  async waitForWebSocketConnection() {
    await this.page.waitForFunction(() => {
      const mockWs = (window as any).__mockWebSocket;
      return mockWs && mockWs.readyState === 1; // OPEN
    }, {}, { timeout: 10000 });
  }

  async getWebSocketState() {
    return await this.page.evaluate(() => {
      const mockWs = (window as any).__mockWebSocket;
      return {
        connected: mockWs ? mockWs.readyState === 1 : false,
        url: mockWs ? mockWs.url : null,
        readyState: mockWs ? mockWs.readyState : null
      };
    });
  }

  async startRealtimeDataStream() {
    // Send periodic updates to simulate real-time data
    const intervalId = await this.page.evaluate(() => {
      return setInterval(async () => {
        const mockWs = (window as any).__mockWebSocket;
        if (mockWs && mockWs.readyState === 1) {
          // Send metrics update
          mockWs.simulateMessage({
            type: 'metrics',
            data: {
              cpu: Math.floor(Math.random() * 100),
              memory: Math.floor(Math.random() * 100),
              buildTime: Math.floor(Math.random() * 5000),
              testCoverage: 80 + Math.floor(Math.random() * 20),
              timestamp: new Date().toISOString()
            }
          });
        }
      }, 2000);
    });

    return intervalId;
  }

  async stopRealtimeDataStream(intervalId: number) {
    await this.page.evaluate((id) => {
      clearInterval(id);
    }, intervalId);
  }
}