type Lease = {
  owner: symbol;
  expiresAt: number;
  timer: NodeJS.Timeout;
};

export class LeaseMutex {
  private lease: Lease | null = null;

  // Acquire the lock, or throw an error if the lock is occupied
  acquire(ttlMs: number): symbol {
    const requester = Symbol("lease-owner");
    const now = Date.now();

    if (!this.lease || this.lease.expiresAt <= now) {
      this.clearTimer();
      this.lease = {
        owner: requester,
        expiresAt: now + ttlMs,
        timer: setTimeout(() => {
          // Auto-expire the lock
          this.clearTimer();
          this.lease = null;
          console.log("Releasing LeaseMutex lock due to expiry")
        }, ttlMs),
      };
      console.log("LeaseMutex lock acquired by owner");
      return requester;
    }

    throw new Error("Lock is still occupied");
  }

  release(owner: symbol) {
    if (!this.lease || this.lease.owner !== owner) return;
    this.clearTimer();
    this.lease = null;
    console.log("LeaseMutex lock released by owner");
  }

  private clearTimer() {
    if (this.lease?.timer) clearTimeout(this.lease.timer);
  }
}
