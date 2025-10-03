type Lease = {
  owner: symbol;
  expiresAt: number;
  timer: NodeJS.Timeout;
};

export class LeaseMutex {
  private lease: Lease | null = null;

  // Acquire a lease; resolves when you own it or rejects if the lock is occupied
  async acquire(ttlMs: number): Promise<symbol> {
    const requester = Symbol("lease-owner");
    const now = Date.now();

    // Stale or free: take ownership
    if (!this.lease || this.lease.expiresAt <= now) {
      this.clearTimer();
      this.lease = {
        owner: requester,
        expiresAt: now + ttlMs,
        timer: setTimeout(() => {
          // Auto-expire: just null the lease (stale), allowing override
          this.clearTimer();
          this.lease = null;
        }, ttlMs),
      };
      return requester;
    }

    throw new Error("Lock is still occupied");
  }

  // Release if you’re the owner
  release(owner: symbol) {
    if (!this.lease || this.lease.owner !== owner) return;
    this.clearTimer();
    this.lease = null;
  }

  private clearTimer() {
    if (this.lease?.timer) clearTimeout(this.lease.timer);
  }
}
