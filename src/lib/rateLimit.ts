export interface RateLimitState {
  lastRequestAt: number;
  requestCount: number;
}

export class RewriteQuota {
  private state: RateLimitState = { lastRequestAt: 0, requestCount: 0 };

  canProceed(): boolean {
    const now = Date.now();
    const elapsed = now - this.state.lastRequestAt;

    if (elapsed > 1000) {
      this.state = { lastRequestAt: now, requestCount: 1 };
      return true;
    }

    if (this.state.requestCount >= 3) {
      return false;
    }

    this.state.requestCount += 1;
    return true;
  }
}
