export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function retryFetch(fn, retries = 3, delayMs = 800) {
  let lastError;

  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (i < retries - 1) {
        await sleep(delayMs * (i + 1));
      }
    }
  }

  throw lastError;
}
