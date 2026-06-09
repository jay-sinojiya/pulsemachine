// --- FILE: tests/container.test.ts ---
import { describe, it, expect } from 'vitest';
import { Container } from '../src/container.js';

describe('Container', () => {
  it('should register and resolve singleton', () => {
    const container = new Container();
    const token = Container.createToken<{ value: string }>('test');
    let callCount = 0;

    container.register(token, () => {
      callCount++;
      return { value: 'hello' };
    });

    const a = container.resolve(token);
    const b = container.resolve(token);

    expect(a).toBe(b);
    expect(callCount).toBe(1);
    expect(a.value).toBe('hello');
  });

  it('should register transient factories', () => {
    const container = new Container();
    const token = Container.createToken<{ id: number }>('transient');
    let id = 0;

    container.register(
      token,
      () => {
        id++;
        return { id };
      },
      false,
    );

    const a = container.resolve(token);
    const b = container.resolve(token);

    expect(a.id).toBe(1);
    expect(b.id).toBe(2);
  });

  it('should throw when resolving unregistered token', () => {
    const container = new Container();
    const token = Container.createToken('missing');

    expect(() => container.resolve(token)).toThrow('No registration found');
  });

  it('should unregister and clear', () => {
    const container = new Container();
    const token = Container.createToken<string>('clearable');

    container.register(token, () => 'test');
    expect(container.has(token)).toBe(true);

    container.unregister(token);
    expect(container.has(token)).toBe(false);

    container.register(token, () => 'test');
    container.clear();
    expect(container.has(token)).toBe(false);
  });
});
