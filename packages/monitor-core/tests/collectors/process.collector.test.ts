// --- FILE: tests/collectors/process.collector.test.ts ---
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProcessCollector } from '../../src/collectors/process.collector.js';
import { mockPsOutput } from '../mocks/system.mock.js';

const mockSafeExec = vi.fn();

vi.mock('../../src/utils/platform.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/utils/platform.js')>();
  return {
    ...actual,
    safeExec: (...args: Parameters<typeof actual.safeExec>) => mockSafeExec(...args),
  };
});

describe('ProcessCollector', () => {
  beforeEach(() => {
    mockSafeExec.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should parse ps output on Linux', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux' });

    mockSafeExec.mockResolvedValue(mockPsOutput.split('\n').slice(1).join('\n'));

    const collector = new ProcessCollector(5);
    const result = await collector.collect();

    expect(result.available).toBe(true);
    expect(result.topByCpu.length).toBeGreaterThan(0);
    expect(result.topByCpu[0]?.name).toContain('node');

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('should parse ps on macOS', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'darwin' });

    mockSafeExec.mockResolvedValue(
      'USER PID %CPU %MEM      VSZ    RSS   TT  STAT STARTED      TIME COMMAND\n' +
        'root 100 25.0  5.0  200000 100000   ??  S    10:00AM   0:05.00 node\n',
    );

    const collector = new ProcessCollector(5);
    const result = await collector.collect();

    expect(result.available).toBe(true);
    expect(result.topByCpu[0]?.name).toBe('node');

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('should parse tasklist on Windows', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });

    mockSafeExec.mockResolvedValue(
      '"Image Name","PID","Session Name","Mem Usage"\n"node.exe","4242","Console","204800"\n',
    );

    const collector = new ProcessCollector(5);
    const result = await collector.collect();

    expect(result.available).toBe(true);
    expect(result.topByMemory[0]?.name).toBe('node.exe');

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('should return empty when ps fails', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux' });

    mockSafeExec.mockResolvedValue('');

    const collector = new ProcessCollector();
    const result = await collector.collect();

    expect(result.available).toBe(false);

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });
});
