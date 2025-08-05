/**
 * Node.js specific type enhancements and extensions
 * Provides additional typing for Node.js features used in the toolkit
 */

// Enhanced child_process types
declare module 'child_process' {
  interface ExecOptions {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    encoding?: BufferEncoding;
    shell?: string;
    timeout?: number;
    maxBuffer?: number;
    killSignal?: NodeJS.Signals;
    uid?: number;
    gid?: number;
    windowsHide?: boolean;
  }

  interface ExecSyncOptions extends ExecOptions {
    input?: string | Buffer | Uint8Array;
    stdio?: 'pipe' | 'ignore' | 'inherit' | Array<'pipe' | 'ipc' | 'ignore' | 'inherit' | NodeJS.WriteStream | NodeJS.ReadStream | null | undefined>;
  }

  function execSync(command: string, options?: ExecSyncOptions): Buffer | string;
}

// Enhanced fs types for promises
declare module 'fs/promises' {
  import { Stats, BigIntStats } from 'fs';

  interface FileHandle {
    appendFile(data: string | Uint8Array, options?: { encoding?: BufferEncoding; mode?: number; flag?: string }): Promise<void>;
    chmod(mode: number): Promise<void>;
    chown(uid: number, gid: number): Promise<void>;
    close(): Promise<void>;
    datasync(): Promise<void>;
    fd: number;
    read<T extends ArrayBufferView>(buffer: T, offset?: number, length?: number, position?: number): Promise<{ bytesRead: number; buffer: T }>;
    readFile(options?: { encoding?: BufferEncoding; flag?: string } | BufferEncoding): Promise<string | Buffer>;
    readv(buffers: ArrayBufferView[], position?: number): Promise<{ bytesRead: number; buffers: ArrayBufferView[] }>;
    stat(options?: { bigint?: false }): Promise<Stats>;
    stat(options: { bigint: true }): Promise<BigIntStats>;
    sync(): Promise<void>;
    truncate(len?: number): Promise<void>;
    utimes(atime: string | number | Date, mtime: string | number | Date): Promise<void>;
    write(buffer: Uint8Array | string, offset?: number, length?: number, position?: number): Promise<{ bytesWritten: number; buffer: string | Uint8Array }>;
    writeFile(data: string | Uint8Array, options?: { encoding?: BufferEncoding; mode?: number; flag?: string } | BufferEncoding): Promise<void>;
    writev(buffers: ArrayBufferView[], position?: number): Promise<{ bytesWritten: number; buffers: ArrayBufferView[] }>;
  }

  function access(path: string, mode?: number): Promise<void>;
  function appendFile(path: string, data: string | Uint8Array, options?: { encoding?: BufferEncoding; mode?: number; flag?: string } | BufferEncoding): Promise<void>;
  function chmod(path: string, mode: number): Promise<void>;
  function chown(path: string, uid: number, gid: number): Promise<void>;
  function copyFile(src: string, dest: string, flags?: number): Promise<void>;
  function cp(source: string, destination: string, opts?: { dereference?: boolean; errorOnExist?: boolean; filter?: (source: string, destination: string) => boolean; force?: boolean; preserveTimestamps?: boolean; recursive?: boolean }): Promise<void>;
  function lchmod(path: string, mode: number): Promise<void>;
  function lchown(path: string, uid: number, gid: number): Promise<void>;
  function lutimes(path: string, atime: string | number | Date, mtime: string | number | Date): Promise<void>;
  function link(existingPath: string, newPath: string): Promise<void>;
  function lstat(path: string, options?: { bigint?: false }): Promise<Stats>;
  function lstat(path: string, options: { bigint: true }): Promise<BigIntStats>;
  function mkdir(path: string, options?: { recursive?: boolean; mode?: number } | number): Promise<string | undefined>;
  function mkdtemp(prefix: string, options?: { encoding?: BufferEncoding } | BufferEncoding): Promise<string>;
  function open(path: string, flags?: string | number, mode?: number): Promise<FileHandle>;
  function opendir(path: string): Promise<any>;
  function readdir(path: string, options?: { encoding?: BufferEncoding; withFileTypes?: false } | BufferEncoding): Promise<string[]>;
  function readFile(path: string, options?: { encoding?: BufferEncoding; flag?: string } | BufferEncoding): Promise<string | Buffer>;
  function readlink(path: string, options?: { encoding?: BufferEncoding } | BufferEncoding): Promise<string>;
  function realpath(path: string, options?: { encoding?: BufferEncoding } | BufferEncoding): Promise<string>;
  function rename(oldPath: string, newPath: string): Promise<void>;
  function rmdir(path: string, options?: { maxRetries?: number; recursive?: boolean; retryDelay?: number }): Promise<void>;
  function rm(path: string, options?: { force?: boolean; maxRetries?: number; recursive?: boolean; retryDelay?: number }): Promise<void>;
  function stat(path: string, options?: { bigint?: false }): Promise<Stats>;
  function stat(path: string, options: { bigint: true }): Promise<BigIntStats>;
  function symlink(target: string, path: string, type?: string): Promise<void>;
  function truncate(path: string, len?: number): Promise<void>;
  function unlink(path: string): Promise<void>;
  function utimes(path: string, atime: string | number | Date, mtime: string | number | Date): Promise<void>;
  function writeFile(file: string, data: string | Uint8Array, options?: { encoding?: BufferEncoding; mode?: number; flag?: string } | BufferEncoding): Promise<void>;
}

// Enhanced path utilities
declare module 'path' {
  namespace path {
    interface ParsedPath {
      root: string;
      dir: string;
      base: string;
      ext: string;
      name: string;
    }

    const sep: string;
    const delimiter: string;
    const posix: path.PlatformPath;
    const win32: path.PlatformPath;

    interface PlatformPath {
      normalize(path: string): string;
      join(...paths: string[]): string;
      resolve(...pathSegments: string[]): string;
      isAbsolute(path: string): boolean;
      relative(from: string, to: string): string;
      dirname(path: string): string;
      basename(path: string, ext?: string): string;
      extname(path: string): string;
      format(pathObject: Partial<ParsedPath>): string;
      parse(path: string): ParsedPath;
      sep: string;
      delimiter: string;
    }
  }

  function normalize(path: string): string;
  function join(...paths: string[]): string;
  function resolve(...pathSegments: string[]): string;
  function isAbsolute(path: string): boolean;
  function relative(from: string, to: string): string;
  function dirname(path: string): string;
  function basename(path: string, ext?: string): string;
  function extname(path: string): string;
  function format(pathObject: Partial<path.ParsedPath>): string;
  function parse(path: string): path.ParsedPath;
  
  export = path;
}

// Enhanced util types
declare module 'util' {
  interface InspectOptions {
    showHidden?: boolean;
    depth?: number | null;
    colors?: boolean;
    customInspect?: boolean;
    showProxy?: boolean;
    maxArrayLength?: number | null;
    maxStringLength?: number | null;
    breakLength?: number;
    compact?: boolean | number;
    sorted?: boolean | ((a: string, b: string) => number);
    getters?: boolean | 'get' | 'set';
  }

  function inspect(object: any, options?: InspectOptions): string;
  function format(f: any, ...args: any[]): string;
  function debuglog(section: string): (data: string, ...args: any[]) => void;
  function isDeepStrictEqual(val1: any, val2: any): boolean;
  function callbackify<TReturn>(fn: () => Promise<TReturn>): (callback: (err: NodeJS.ErrnoException | null, result: TReturn) => void) => void;
  function promisify<TCustom extends Function>(fn: CustomPromisify<TCustom>): TCustom;

  interface CustomPromisify<TCustom extends Function> extends Function {
    __promisify__: TCustom;
  }

  namespace types {
    function isAnyArrayBuffer(object: any): object is ArrayBufferLike;
    function isArgumentsObject(object: any): object is IArguments;
    function isArrayBuffer(object: any): object is ArrayBuffer;
    function isAsyncFunction(object: any): boolean;
    function isBooleanObject(object: any): object is Boolean;
    function isBoxedPrimitive(object: any): object is String | Number | BigInt | Boolean | Symbol;
    function isDataView(object: any): object is DataView;
    function isDate(object: any): object is Date;
    function isExternal(object: any): boolean;
    function isFloat32Array(object: any): object is Float32Array;
    function isFloat64Array(object: any): object is Float64Array;
    function isGeneratorFunction(object: any): object is GeneratorFunction;
    function isGeneratorObject(object: any): object is Generator;
    function isInt8Array(object: any): object is Int8Array;
    function isInt16Array(object: any): object is Int16Array;
    function isInt32Array(object: any): object is Int32Array;
    function isMap(object: any): object is Map<any, any>;
    function isMapIterator(object: any): boolean;
    function isModuleNamespaceObject(value: any): boolean;
    function isNativeError(object: any): object is Error;
    function isNumberObject(object: any): object is Number;
    function isPromise(object: any): object is Promise<any>;
    function isProxy(object: any): boolean;
    function isRegExp(object: any): object is RegExp;
    function isSet(object: any): object is Set<any>;
    function isSetIterator(object: any): boolean;
    function isSharedArrayBuffer(object: any): object is SharedArrayBuffer;
    function isStringObject(object: any): object is String;
    function isSymbolObject(object: any): object is Symbol;
    function isTypedArray(object: any): object is NodeJS.TypedArray;
    function isUint8Array(object: any): object is Uint8Array;
    function isUint8ClampedArray(object: any): object is Uint8ClampedArray;
    function isUint16Array(object: any): object is Uint16Array;
    function isUint32Array(object: any): object is Uint32Array;
    function isWeakMap(object: any): object is WeakMap<any, any>;
    function isWeakSet(object: any): object is WeakSet<any>;
    function isWebAssemblyCompiledModule(object: any): boolean;
  }
}

// OS utilities
declare module 'os' {
  interface CpuInfo {
    model: string;
    speed: number;
    times: {
      user: number;
      nice: number;
      sys: number;
      idle: number;
      irq: number;
    };
  }

  interface NetworkInterfaceInfo {
    address: string;
    netmask: string;
    family: 'IPv4' | 'IPv6';
    mac: string;
    internal: boolean;
    cidr: string | null;
    scopeid?: number;
  }

  function arch(): string;
  function cpus(): CpuInfo[];
  function endianness(): 'BE' | 'LE';
  function freemem(): number;
  function getPriority(pid?: number): number;
  function homedir(): string;
  function hostname(): string;
  function loadavg(): number[];
  function networkInterfaces(): { [index: string]: NetworkInterfaceInfo[] };
  function platform(): NodeJS.Platform;
  function release(): string;
  function setPriority(priority: number): void;
  function setPriority(pid: number, priority: number): void;
  function tmpdir(): string;
  function totalmem(): number;
  function type(): string;
  function uptime(): number;
  function userInfo(options?: { encoding: BufferEncoding }): { username: string; uid: number; gid: number; shell: string; homedir: string };
  function version(): string;
  
  const EOL: string;
  const constants: {
    UV_UDP_REUSEADDR: number;
    dlopen: {
      RTLD_LAZY: number;
      RTLD_NOW: number;
      RTLD_GLOBAL: number;
      RTLD_LOCAL: number;
      РТLD_DEEPBIND: number;
    };
    errno: {
      E2BIG: number;
      EACCES: number;
      EADDRINUSE: number;
      EADDRNOTAVAIL: number;
      EAFNOSUPPORT: number;
      EAGAIN: number;
      EALREADY: number;
      EBADF: number;
      EBADMSG: number;
      EBUSY: number;
      ECANCELED: number;
      ECHILD: number;
      ECONNABORTED: number;
      ECONNREFUSED: number;
      ECONNRESET: number;
      EDEADLK: number;
      EDESTADDRREQ: number;
      EDOM: number;
      EDQUOT: number;
      EEXIST: number;
      EFAULT: number;
      EFBIG: number;
      EHOSTUNREACH: number;
      EIDRM: number;
      EILSEQ: number;
      EINPROGRESS: number;
      EINTR: number;
      EINVAL: number;
      EIO: number;
      EISCONN: number;
      EISDIR: number;
      ELOOP: number;
      EMFILE: number;
      EMLINK: number;
      EMSGSIZE: number;
      EMULTIHOP: number;
      ENAMETOOLONG: number;
      ENETDOWN: number;
      ENETRESET: number;
      ENETUNREACH: number;
      ENFILE: number;
      ENOBUFS: number;
      ENODATA: number;
      ENODEV: number;
      ENOENT: number;
      ENOEXEC: number;
      ENOLCK: number;
      ENOLINK: number;
      ENOMEM: number;
      ENOMSG: number;
      ENOPROTOOPT: number;
      ENOSPC: number;
      ENOSR: number;
      ENOSTR: number;
      ENOSYS: number;
      ENOTCONN: number;
      ENOTDIR: number;
      ENOTEMPTY: number;
      ENOTSOCK: number;
      ENOTSUP: number;
      ENOTTY: number;
      ENXIO: number;
      EOPNOTSUPP: number;
      EOVERFLOW: number;
      EPERM: number;
      EPIPE: number;
      EPROTO: number;
      EPROTONOSUPPORT: number;
      EPROTOTYPE: number;
      ERANGE: number;
      EROFS: number;
      ESPIPE: number;
      ESRCH: number;
      ESTALE: number;
      ETIME: number;
      ETIMEDOUT: number;
      ETXTBSY: number;
      EWOULDBLOCK: number;
      EXDEV: number;
      WSAEINTR: number;
      WSAEBADF: number;
      WSAEACCES: number;
      WSAEFAULT: number;
      WSAEINVAL: number;
      WSAEMFILE: number;
      WSAEWOULDBLOCK: number;
      WSAEINPROGRESS: number;
      WSAEALREADY: number;
      WSAENOTSOCK: number;
      WSAEDESTADDRREQ: number;
      WSAEMSGSIZE: number;
      WSAEPROTOTYPE: number;
      WSAENOPROTOOPT: number;
      WSAEPROTONOSUPPORT: number;
      WSAESOCKTNOSUPPORT: number;
      WSAEOPNOTSUPP: number;
      WSAEPFNOSUPPORT: number;
      WSAEAFNOSUPPORT: number;
      WSAEADDRINUSE: number;
      WSAEADDRNOTAVAIL: number;
      WSAENETDOWN: number;
      WSAENETUNREACH: number;
      WSAENETRESET: number;
      WSAECONNABORTED: number;
      WSAECONNRESET: number;
      WSAENOBUFS: number;
      WSAEISCONN: number;
      WSAENOTCONN: number;
      WSAESHUTDOWN: number;
      WSAETOOMANYREFS: number;
      WSAETIMEDOUT: number;
      WSAECONNREFUSED: number;
      WSAELOOP: number;
      WSAENAMETOOLONG: number;
      WSAEHOSTDOWN: number;
      WSAEHOSTUNREACH: number;
      WSAENOTEMPTY: number;
      WSAEPROCLIM: number;
      WSAEUSERS: number;
      WSAEDQUOT: number;
      WSAESTALE: number;
      WSAEREMOTE: number;
      WSASYSNOTREADY: number;
      WSAVERNOTSUPPORTED: number;
      WSANOTINITIALISED: number;
      WSAEDISCON: number;
      WSAENOMORE: number;
      WSAECANCELLED: number;
      WSAEINVALIDPROCTABLE: number;
      WSAEINVALIDPROVIDER: number;
      WSAEPROVIDERFAILEDINIT: number;
      WSASYSCALLFAILURE: number;
      WSASERVICE_NOT_FOUND: number;
      WSATYPE_NOT_FOUND: number;
      WSA_E_NO_MORE: number;
      WSA_E_CANCELLED: number;
      WSAEREFUSED: number;
    };
    priority: {
      PRIORITY_LOW: number;
      PRIORITY_BELOW_NORMAL: number;
      PRIORITY_NORMAL: number;
      PRIORITY_ABOVE_NORMAL: number;
      PRIORITY_HIGH: number;
      PRIORITY_HIGHEST: number;
    };
  };
}