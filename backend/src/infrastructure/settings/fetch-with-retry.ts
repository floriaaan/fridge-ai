/**
 * `fetch` throws only on network-level failure (DNS, ECONNREFUSED,
 * EHOSTUNREACH, ETIMEDOUT…), never on a non-2xx response — so retrying here
 * never masks an applicative 4xx/5xx, only a transient blip (e.g. a LAN
 * route not yet resolved) on the way to a self-hosted Ollama.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 2,
  delayMs = 500,
): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (error) {
    if (retries <= 0) throw error
    await new Promise((resolve) => setTimeout(resolve, delayMs))
    return fetchWithRetry(url, init, retries - 1, delayMs * 3)
  }
}
