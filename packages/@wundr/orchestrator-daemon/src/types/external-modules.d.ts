/**
 * Ambient module declarations for optional external dependencies.
 *
 * These adapters dynamically import these modules at runtime. The declarations
 * here provide minimal type information so TypeScript does not error on the
 * dynamic import() calls. The adapters use their own "Like" interfaces for
 * structural typing, so the shapes declared here are intentionally loose.
 */

declare module 'discord.js' {
  export class Client {
    constructor(opts: any);
    on(event: string, cb: (...args: any[]) => void): this;
  }
  export const GatewayIntentBits: Record<string, number>;
  export const Partials: Record<string, number>;
}

declare module 'telegraf' {
  export class Telegraf {
    constructor(token: string, opts?: any);
    launch(opts?: any): Promise<void>;
    stop(reason?: string): void;
    on(event: string, cb: (...args: any[]) => void): void;
    telegram: any;
  }
}

declare module '@wundr/slack-agent' {
  export class SlackUserAgent {
    constructor(opts: any);
  }
}
