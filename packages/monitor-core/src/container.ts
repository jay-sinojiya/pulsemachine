// --- FILE: src/container.ts ---
import type { ContainerToken } from './types.js';

type Factory<T> = () => T;

/**
 * Lightweight dependency injection container without reflect-metadata.
 * Supports singleton registration and typed resolution.
 */
export class Container {
  private readonly factories = new Map<symbol, Factory<unknown>>();
  private readonly singletons = new Map<symbol, unknown>();

  /** Create a typed token for registration */
  static createToken<T>(name: string): ContainerToken<T> {
    return Symbol(name);
  }

  /** Register a factory. Singleton by default. */
  register<T>(token: ContainerToken<T>, factory: Factory<T>, singleton = true): void {
    if (singleton) {
      this.factories.set(token, () => {
        if (!this.singletons.has(token)) {
          this.singletons.set(token, factory());
        }
        return this.singletons.get(token);
      });
    } else {
      this.factories.set(token, factory);
    }
  }

  /** Resolve a registered dependency by token */
  resolve<T>(token: ContainerToken<T>): T {
    const factory = this.factories.get(token);
    if (!factory) {
      throw new Error(`No registration found for token: ${String(token.description ?? token)}`);
    }
    return factory() as T;
  }

  /** Check if a token is registered */
  has(token: ContainerToken<unknown>): boolean {
    return this.factories.has(token);
  }

  /** Remove a registration and its singleton instance */
  unregister(token: ContainerToken<unknown>): void {
    this.factories.delete(token);
    this.singletons.delete(token);
  }

  /** Clear all registrations */
  clear(): void {
    this.factories.clear();
    this.singletons.clear();
  }
}
