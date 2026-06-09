// --- FILE: tests/collectors/network.collector.test.ts ---
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFile } from 'fs/promises';
import { NetworkCollector } from '../../src/collectors/network.collector.js';
import { mockProcNetDev } from '../mocks/system.mock.js';

const mockSafeExec = vi.fn();

vi.mock('../../src/utils/platform.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/utils/platform.js')>();
  return {
    ...actual,
    safeExec: (...args: Parameters<typeof actual.safeExec>) => mockSafeExec(...args),
  };
});

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

describe('NetworkCollector', () => {
  beforeEach(() => {
    mockSafeExec.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should parse /proc/net/dev on Linux', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux' });

    vi.mocked(readFile).mockResolvedValue(mockProcNetDev);

    const collector = new NetworkCollector();
    const result = await collector.collect();

    expect(result.available).toBe(true);
    expect(result.interfaces.some((i) => i.interface === 'eth0')).toBe(true);

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('should compute rates on second sample', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux' });

    vi.mocked(readFile).mockResolvedValue(mockProcNetDev);

    const collector = new NetworkCollector();
    await collector.collect();

    const updatedNetDev = mockProcNetDev.replace('1000000', '2000000').replace('2000000', '4000000');
    vi.mocked(readFile).mockResolvedValue(updatedNetDev);

    const result = await collector.collect();
    const eth0 = result.interfaces.find((i) => i.interface === 'eth0');

    expect(eth0?.rxBytesPerSec).toBeGreaterThanOrEqual(0);

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('should use PowerShell on Windows', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });

    mockSafeExec.mockResolvedValue(
      'Name : Ethernet\n' +
        'ReceivedBytes : 1000000\n' +
        'SentBytes : 2000000\n' +
        'ReceivedUnicastPackets : 100\n' +
        'SentUnicastPackets : 200\n' +
        'ReceivedPacketErrors : 0\n' +
        'OutboundPacketErrors : 0\n' +
        'ReceivedDiscardedPackets : 0\n' +
        'OutboundDiscardedPackets : 0\n' +
        'LinkSpeed : 1000000000\n',
    );

    const collector = new NetworkCollector();
    const result = await collector.collect();

    expect(result.interfaces.length).toBeGreaterThan(0);

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('should use netstat on macOS', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'darwin' });

    mockSafeExec.mockResolvedValue(
      'Name  Mtu   Network       Address            Ipkts Ierrs     Ibytes    Opkts Oerrs     Obytes  Coll\n' +
        'en0   1500  <Link#4>      aa:bb:cc:dd:ee:ff  1000  0         50000     800   0         90000   0\n',
    );

    const collector = new NetworkCollector();
    const result = await collector.collect();

    expect(result.interfaces.length).toBeGreaterThan(0);

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });
});
