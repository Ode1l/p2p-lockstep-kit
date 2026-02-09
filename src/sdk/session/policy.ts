// Retry Policy (policy): backoff scheduling and cancellation for register/resume attempts.
// Responsibilities:
// - Apply exponential backoff with jitter.
// - Cancel and replace inflight retries when a new attempt starts.
export type BackoffOptions = {
  baseDelayMs?: number;
  maxDelayMs?: number;
  multiplier?: number;
  jitter?: number;
};

export type RegisterPolicy = {
  run: (
    url: string,
    options: {
      register: (url: string) => Promise<{ peerId: string }>;
      onSuccess: (peerId: string) => void;
      onFailure: (error: unknown) => void;
      onRetry: (delayMs: number, error: unknown) => void;
      shouldRetry?: (error: unknown) => boolean;
    },
  ) => Promise<void>;
};

const applyBackoff = (attempt: number, options?: BackoffOptions) => {
  const base = options?.baseDelayMs ?? 500;
  const max = options?.maxDelayMs ?? 8000;
  const mult = options?.multiplier ?? 2;
  const jitter = options?.jitter ?? 0.2;
  const raw = Math.min(max, base * Math.pow(mult, Math.max(0, attempt)));
  const delta = raw * jitter;
  return Math.max(0, raw + (Math.random() * 2 - 1) * delta);
};

export const createRegisterPolicy = (backoffOptions?: BackoffOptions): RegisterPolicy => {
  let token = 0;
  let retryTimer: number | null = null;
  let attempt = 0;

  const run: RegisterPolicy["run"] = async (url, options) => {
    token += 1;
    const current = token;
    if (retryTimer) {
      window.clearTimeout(retryTimer);
      retryTimer = null;
    }
    try {
      const result = await options.register(url);
      if (current !== token) {
        return;
      }
      attempt = 0;
      options.onSuccess(result.peerId);
    } catch (err) {
      if (current !== token) {
        return;
      }
      if (options.shouldRetry && !options.shouldRetry(err)) {
        options.onFailure(err);
        return;
      }
      options.onFailure(err);
      const delay = applyBackoff(attempt, backoffOptions);
      options.onRetry(delay, err);
      attempt += 1;
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        void run(url, options);
      }, delay);
    }
  };

  return { run };
};
