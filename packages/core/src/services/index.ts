// Core services
import EventEmitter from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';

import type { WundrConfig } from '../types/index.js';

export type ServiceStatus =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'shutting_down'
  | 'stopped';

export interface CoreServiceOptions {
  config?: Partial<WundrConfig>;
  debug?: boolean;
}

export class CoreService {
  public readonly id: string;
  private status: ServiceStatus;
  private readonly config: WundrConfig;
  private readonly debug: boolean;
  private readonly emitter: EventEmitter;
  private initializedAt: Date | null;

  constructor(options: CoreServiceOptions = {}) {
    this.id = uuidv4();
    this.status = 'idle';
    this.emitter = new EventEmitter();
    this.initializedAt = null;
    this.debug = options.debug ?? false;
    this.config = {
      name: options.config?.name ?? 'wundr-core',
      version: options.config?.version ?? '1.0.0',
      ...(options.config?.description !== undefined && {
        description: options.config.description,
      }),
    };
  }

  async initialize(): Promise<void> {
    if (this.status === 'ready') {
      return;
    }

    if (this.status === 'initializing') {
      throw new Error(`CoreService (${this.id}) is already initializing`);
    }

    this.status = 'initializing';
    this.emitter.emit('initializing', { id: this.id, config: this.config });

    if (this.debug) {
      console.debug(
        `[CoreService] Initializing service "${this.config.name}" v${this.config.version}`
      );
    }

    this.initializedAt = new Date();
    this.status = 'ready';
    this.emitter.emit('ready', {
      id: this.id,
      initializedAt: this.initializedAt,
    });

    if (this.debug) {
      console.debug(
        `[CoreService] Service "${this.config.name}" ready (id=${this.id})`
      );
    }
  }

  async shutdown(): Promise<void> {
    if (this.status === 'stopped' || this.status === 'idle') {
      return;
    }

    this.status = 'shutting_down';
    this.emitter.emit('shutting_down', { id: this.id });

    if (this.debug) {
      console.debug(
        `[CoreService] Shutting down service "${this.config.name}"`
      );
    }

    this.status = 'stopped';
    this.emitter.emit('stopped', { id: this.id });
  }

  getStatus(): ServiceStatus {
    return this.status;
  }

  getConfig(): Readonly<WundrConfig> {
    return { ...this.config };
  }

  isReady(): boolean {
    return this.status === 'ready';
  }

  on(event: string, listener: (...args: unknown[]) => void): this {
    this.emitter.on(event, listener);
    return this;
  }

  off(event: string, listener: (...args: unknown[]) => void): this {
    this.emitter.off(event, listener);
    return this;
  }

  once(event: string, listener: (...args: unknown[]) => void): this {
    this.emitter.once(event, listener);
    return this;
  }
}
