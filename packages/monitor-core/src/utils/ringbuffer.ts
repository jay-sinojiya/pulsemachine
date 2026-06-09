// --- FILE: src/utils/ringbuffer.ts ---

/**
 * Fixed-size circular buffer for metric history.
 * Oldest entries are overwritten when capacity is reached.
 */
export class RingBuffer<T> {
  private readonly buffer: T[];
  private head = 0;
  private tail = 0;
  private count = 0;

  constructor(private readonly capacity: number) {
    if (capacity <= 0) {
      throw new Error('RingBuffer capacity must be greater than 0');
    }
    this.buffer = new Array<T>(capacity);
  }

  /** Add an item to the buffer, evicting oldest if full */
  push(item: T): void {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;

    if (this.count < this.capacity) {
      this.count++;
    } else {
      this.head = (this.head + 1) % this.capacity;
    }
  }

  /** Get all items in insertion order (oldest first) */
  toArray(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.count; i++) {
      const index = (this.head + i) % this.capacity;
      const item = this.buffer[index];
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }

  /** Get the most recent item, or undefined if empty */
  peekLatest(): T | undefined {
    if (this.count === 0) {
      return undefined;
    }
    const index = (this.tail - 1 + this.capacity) % this.capacity;
    return this.buffer[index];
  }

  /** Current number of items stored */
  size(): number {
    return this.count;
  }

  /** Maximum capacity */
  getCapacity(): number {
    return this.capacity;
  }

  /** Clear all items */
  clear(): void {
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }
}
