async function withFallbackKey(fn, apiKey, allKeys, ...args) {
  const keys = [apiKey, ...(allKeys || []).filter(k => k !== apiKey)];
  let lastError;
  for (const key of keys) {
    try {
      return await fn(...args, key);
    } catch (e) {
      if (!e.message?.includes('Rate limit') && !e.message?.includes('rate_limit')) throw e;
      lastError = e;
    }
  }
  throw lastError;
}
