// Type declarations for optional dependencies

declare module 'node-fetch' {
  interface Response {
    buffer(): Promise<Buffer>;
    json(): Promise<any>;
    text(): Promise<string>;
  }
  
  function fetch(url: string, init?: any): Promise<Response>;
  export default fetch;
}

declare module 'sharp' {
  interface Sharp {
    resize(width: number, height: number): Sharp;
    png(): Sharp;
    toFile(filename: string): Promise<void>;
  }
  
  function sharp(input: Buffer): Sharp;
  export default sharp;
}