// --- FILE: tests/utils/ringbuffer.test.ts ---
import { describe, it, expect } from 'vitest';
import { RingBuffer } from '../../src/utils/ringbuffer.js';

describe('RingBuffer', () => {
  it('should store items up to capacity', () => {
    const buffer = new RingBuffer<number>(3);
    buffer.push(1);
    buffer.push(2);
    buffer.push(3);

    expect(buffer.size()).toBe(3);
    expect(buffer.toArray()).toEqual([1, 2, 3]);
    expect(buffer.peekLatest()).toBe(3);
  });

  it('should overwrite oldest items when full', () => {
    const buffer = new RingBuffer<number>(3);
    buffer.push(1);
    buffer.push(2);
    buffer.push(3);
    buffer.push(4);

    expect(buffer.toArray()).toEqual([2, 3, 4]);
    expect(buffer.peekLatest()).toBe(4);
  });

  it('should clear all items', () => {
    const buffer = new RingBuffer<string>(5);
    buffer.push('a');
    buffer.push('b');
    buffer.clear();

    expect(buffer.size()).toBe(0);
    expect(buffer.peekLatest()).toBeUndefined();
  });

  it('should throw on invalid capacity', () => {
    expect(() => new RingBuffer(0)).toThrow('capacity must be greater than 0');
  });
});
