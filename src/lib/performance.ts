import { RewriteQuota } from './rateLimit';
import { debounce } from './debounce';

export function createThrottleGuard() {
  const quota = new RewriteQuota();

  return {
    canRewrite: () => quota.canProceed(),
    debounced: debounce(() => undefined, 250),
  };
}
