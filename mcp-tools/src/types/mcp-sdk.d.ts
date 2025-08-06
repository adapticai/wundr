// Minimal type declarations for @modelcontextprotocol/sdk
// These are temporary workarounds for the incomplete installation

declare module '@modelcontextprotocol/sdk/server/index' {
  export class Server {
    constructor(serverInfo: any, capabilities: any);
    setRequestHandler(schema: any, handler: (request: any) => Promise<any>): void;
    connect(transport: any): Promise<void>;
  }
}

declare module '@modelcontextprotocol/sdk/server/stdio' {
  export class StdioServerTransport {
    constructor();
  }
}

declare module '@modelcontextprotocol/sdk/types' {
  export const CallToolRequestSchema: any;
  export const ListToolsRequestSchema: any;
  
  export enum ErrorCode {
    MethodNotFound = -32601,
    InternalError = -32603,
  }
  
  export class McpError extends Error {
    constructor(code: ErrorCode, message: string);
  }
}