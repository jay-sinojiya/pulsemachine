// --- FILE: tests/utils/platform.test.ts ---
import { describe, it, expect } from 'vitest';
import {
  getPlatform,
  isLinux,
  isMacOS,
  isWindows,
  isSupportedPlatform,
  parseNumber,
  toPercent,
} from '../../src/utils/platform.js';

describe('platform utils', () => {
  it('should detect current platform', () => {
    expect(['linux', 'darwin', 'win32', 'unsupported']).toContain(getPlatform());
    expect(isSupportedPlatform()).toBe(
      isLinux() || isMacOS() || isWindows(),
    );
  });

  it('should parse numbers safely', () => {
    expect(parseNumber('42')).toBe(42);
    expect(parseNumber('invalid', 5)).toBe(5);
    expect(parseNumber(undefined, 10)).toBe(10);
  });

  it('should compute bounded percentages', () => {
    expect(toPercent(50, 100)).toBe(50);
    expect(toPercent(0, 0)).toBe(0);
    expect(toPercent(150, 100)).toBe(100);
    expect(toPercent(-10, 100)).toBe(0);
  });
});
