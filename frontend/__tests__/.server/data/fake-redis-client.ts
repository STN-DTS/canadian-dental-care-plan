import { EventEmitter } from 'node:events';
import { vi } from 'vitest';

type FakeRedisSetOptions = { PX?: number; PXAT?: number };
type FakeRedisGetExOptions = { type: 'PX'; value: number };

/**
 * In-memory test double for `node-redis` implementing TTL enforcement (`PX`/`PXAT`, `GETEX`, `PEXPIRE`)
 * and `MULTI` batching for `KeyvStore` and `session-storage` unit tests.
 */
export class FakeRedisClient extends EventEmitter {
  readonly isOpen = true;
  readonly isReady = true;
  readonly connect = vi.fn();
  readonly values = new Map<string, string>();
  readonly expiries = new Map<string, number>();
  readonly info = vi.fn().mockResolvedValue('redis_version:7.2.0');

  private isLive(key: string): boolean {
    if (!this.values.has(key)) {
      return false;
    }

    const expiresAt = this.expiries.get(key);

    if (expiresAt !== undefined && expiresAt <= Date.now()) {
      this.values.delete(key);
      this.expiries.delete(key);
      return false;
    }

    return true;
  }

  private writeValue(key: string, value: string, options?: FakeRedisSetOptions): void {
    this.values.set(key, value);

    if (options?.PXAT !== undefined) {
      this.expiries.set(key, options.PXAT);
    } else if (options?.PX !== undefined) {
      this.expiries.set(key, Date.now() + options.PX);
    } else {
      this.expiries.delete(key);
    }
  }

  private removeKey(key: string): number {
    this.expiries.delete(key);
    return this.values.delete(key) ? 1 : 0;
  }

  private applyPExpire(key: string, ms: number, mode?: 'NX' | 'XX' | 'GT' | 'LT'): number {
    if (!this.isLive(key)) {
      return 0;
    }

    const nextExpiresAt = Date.now() + ms;
    const currentExpiresAt = this.expiries.get(key);

    if (mode === 'GT' && (currentExpiresAt === undefined || nextExpiresAt <= currentExpiresAt)) {
      return 0;
    }

    this.expiries.set(key, nextExpiresAt);
    return 1;
  }

  readonly get = vi.fn(async (key: string) => await Promise.resolve(this.isLive(key) ? (this.values.get(key) ?? null) : null));
  readonly getEx = vi.fn(async (key: string, options: FakeRedisGetExOptions) => {
    if (!this.isLive(key)) {
      return await Promise.resolve(null);
    }

    this.expiries.set(key, Date.now() + options.value);
    return await Promise.resolve(this.values.get(key) ?? null);
  });
  readonly pExpire = vi.fn(async (key: string, ms: number, mode?: 'NX' | 'XX' | 'GT' | 'LT') => await Promise.resolve(this.applyPExpire(key, ms, mode)));
  readonly exists = vi.fn(async (key: string) => await Promise.resolve(this.isLive(key) ? 1 : 0));
  readonly set = vi.fn(async (key: string, value: string, options?: FakeRedisSetOptions) => {
    this.writeValue(key, value, options);
    return await Promise.resolve('OK');
  });
  readonly unlink = vi.fn(async (key: string) => await Promise.resolve(this.removeKey(key)));
  readonly multi = vi.fn(() => {
    const ops: (() => unknown)[] = [];
    const tx = {
      set: (key: string, value: string, options?: FakeRedisSetOptions) => {
        ops.push(() => {
          this.writeValue(key, value, options);
          return 'OK';
        });
        return tx;
      },
      del: (key: string) => {
        ops.push(() => this.removeKey(key));
        return tx;
      },
      unlink: (key: string) => {
        ops.push(() => this.removeKey(key));
        return tx;
      },
      pExpire: (key: string, ms: number, mode?: 'NX' | 'XX' | 'GT' | 'LT') => {
        ops.push(() => this.applyPExpire(key, ms, mode));
        return tx;
      },
      exists: (key: string) => {
        ops.push(() => (this.isLive(key) ? 1 : 0));
        return tx;
      },
      exec: async () => await Promise.resolve(ops.map((op) => op())),
    };
    return tx;
  });
}
