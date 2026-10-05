export type PullProgressUpdate = { status: string; percent: number; done: boolean };

/**
 * Accumulates Ollama streaming pull progress (NDJSON lines) into an overall percent.
 * Pure helper (no dependencies) so the download progress logic can be unit tested.
 */
export function createPullProgressTracker() {
  const layers = new Map<string, { total: number; completed: number }>();
  let done = false;
  let status = 'starting';

  return {
    onLine(line: string): PullProgressUpdate | null {
      const trimmed = String(line ?? '').trim();
      if (!trimmed) {
        return null;
      }

      let data: any;
      try {
        data = JSON.parse(trimmed);
      } catch {
        return null;
      }

      if (typeof data.status === 'string' && data.status) {
        status = data.status;
      }
      if (data.status === 'success') {
        done = true;
      }

      if (data.digest) {
        const key = String(data.digest);
        const total = Number(data.total);
        const completed = Number(data.completed);
        const existing = layers.get(key);
        if (Number.isFinite(total) && total > 0) {
          layers.set(key, { total, completed: Number.isFinite(completed) ? completed : 0 });
        } else if (existing && Number.isFinite(completed)) {
          existing.completed = completed;
        }
      }

      let total = 0;
      let completed = 0;
      for (const layer of layers.values()) {
        total += layer.total;
        completed += Math.min(layer.completed, layer.total);
      }

      const percent = done
        ? 100
        : total > 0
          ? Math.min(100, Math.round((completed / total) * 100))
          : 0;

      return { status, percent, done };
    },
    isDone() {
      return done;
    },
  };
}