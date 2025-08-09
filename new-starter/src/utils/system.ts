import os from 'node:os';
import { execa, type Options } from 'execa';
import which from 'which';
import { formatError } from '../types/errors';


export async function executeShellScript(
  scriptPath: string,
  options?: Options
): Promise<void> {
  try {
    await execa('bash', [scriptPath], {
      ...options,
      shell: true,
      stdio: 'inherit',
    });
  } catch (error) {
    const errorMessage = formatError(error, 'Script execution failed');
    throw new Error(errorMessage);
  }
}

export async function checkCommand(command: string): Promise<boolean> {
  try {
    await which(command);
    return true;
  } catch {
    return false;
  }
}

export function getOS(): 'macos' | 'linux' | 'windows' {
  const platform = os.platform();
  
  switch (platform) {
    case 'darwin': {
      return 'macos';
    }
    case 'linux': {
      return 'linux';
    }
    case 'win32': {
      return 'windows';
    }
    default: {
      throw new Error(`Unsupported platform: ${platform}`);
    }
  }
}

export async function runCommand(
  command: string,
  args: string[] = []
): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execa(command, args);
    return { stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Command failed: ${errorMessage}`);
  }
}

export function isRoot(): boolean {
  return process.getuid ? process.getuid() === 0 : false;
}

export function getHomeDirectory(): string {
  return os.homedir();
}

export function getTempDirectory(): string {
  return os.tmpdir();
}