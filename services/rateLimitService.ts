/**
 * Rate limiting service with exponential backoff for API calls
 */

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2
};

/**
 * Generic retry function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (!isRateLimitError(error) || attempt === opts.maxRetries) {
        break;
      }
      
      const delay = Math.min(
        opts.baseDelay * Math.pow(opts.backoffFactor, attempt),
        opts.maxDelay
      );
      
      console.log(`⏳ Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${opts.maxRetries + 1})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Unknown error occurred during retry');
}

/**
 * Check if error is a rate limit error
 */
function isRateLimitError(error: any): boolean {
  if (!error) return false;
  
  // Rate limit error patterns
  if (error.status === 429) return true;
  if (error.code === 'rate_limit_exceeded') return true;
  if (error.message?.includes('Rate limit')) return true;
  if (error.message?.includes('Too Many Requests')) return true;
  
  // Check response status
  if (error.response?.status === 429) return true;
  
  return false;
}

/**
 * Rate-limited wrapper for API chat completions
 * @deprecated Use withRetry directly instead
 */
export async function rateLimitedChatCompletion(
  apiClient: any,
  params: any,
  retryOptions?: Partial<RetryOptions>
): Promise<any> {
  return withRetry(
    () => apiClient.chat.completions.create(params),
    retryOptions
  );
}
