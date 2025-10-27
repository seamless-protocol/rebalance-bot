type Lease = {
    owner: symbol;
    expiresAt: number;
    timer: NodeJS.Timeout;
  };

  export class LeaseMutex {
    private lease: Lease | null = null;

    private ttlMs: number = 120000; // 2 minutes by default

    private resourceName: string;

    constructor(ttlMs: number, resourceName: string) {
      this.ttlMs = ttlMs;
      this.resourceName = resourceName;
    }

    // Acquire the lock, or throw an error if the lock is occupied
    acquire(): symbol {
      const requester = Symbol("lease-owner");
      const now = Date.now();

      if (!this.lease || this.lease.expiresAt <= now) {
        this.clearTimer();
        this.lease = {
          owner: requester,
          expiresAt: now + this.ttlMs,
          timer: setTimeout(() => {
            // Auto-expire the lock
            this.clearTimer();
            this.lease = null;
            console.log(`LeaseMutex lock for ${this.resourceName} released due to expiry`)
          }, this.ttlMs),
        };
        console.log(`LeaseMutex lock for ${this.resourceName} acquired`);
        return requester;
      }

      throw new Error(`LeaseMutex for ${this.resourceName} is occupied`);
    }

    release(owner: symbol) {
      if (!this.lease || this.lease.owner !== owner) return;
      this.clearTimer();
      this.lease = null;
      console.log(`LeaseMutex lock for ${this.resourceName} released`);
    }

    private clearTimer() {
      if (this.lease?.timer) clearTimeout(this.lease.timer);
    }
  }