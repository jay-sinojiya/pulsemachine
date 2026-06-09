// --- FILE: src/utils/platform.ts ---
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export type Platform = 'linux' | 'darwin' | 'win32' | 'unsupported';

export function getPlatform(): Platform {
  const platform = process.platform;
  if (platform === 'linux' || platform === 'darwin' || platform === 'win32') {
    return platform;
  }
  return 'unsupported';
}

export function isLinux(): boolean {
  return process.platform === 'linux';
}

export function isMacOS(): boolean {
  return process.platform === 'darwin';
}

export function isWindows(): boolean {
  return process.platform === 'win32';
}

export function isSupportedPlatform(): boolean {
  return isLinux() || isMacOS() || isWindows();
}

/**
 * Execute a shell command safely with timeout and error handling.
 * Returns stdout on success, empty string on failure.
 */
export async function safeExec(
  command: string,
  args: string[],
  timeoutMs = 5000,
): Promise<string> {
  try {
    const { stdout } = await execFileAsync(command, args, {
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    });
    return stdout;
  } catch {
    return '';
  }
}

/**
 * Read a file safely, returning null on failure.
 */
export async function safeReadFile(
  readFn: () => Promise<string>,
): Promise<string | null> {
  try {
    return await readFn();
  } catch {
    return null;
  }
}

/**
 * Parse a numeric value from a string, returning fallback on failure.
 */
export function parseNumber(value: string | undefined, fallback = 0): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Calculate percentage with bounds checking.
 */
export function toPercent(used: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  const percent = (used / total) * 100;
  return Math.min(100, Math.max(0, Math.round(percent * 100) / 100));
}
