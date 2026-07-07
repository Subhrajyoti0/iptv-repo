import { ProxyAgent, setGlobalDispatcher, fetch } from "undici";

let proxyInitPromise = null;

/**
 * Automatically discovers, verifies, and attaches a live Indian HTTP proxy.
 * Uses parallel racing to find the fastest operational proxy in under 6 seconds.
 */
export async function initIndianProxy() {
  if (proxyInitPromise) return proxyInitPromise;

  proxyInitPromise = (async () => {
    console.log("🌐 Initiating automated Indian proxy discovery...");
    try {
      // Fetch plain text list of live Indian HTTP proxies
      const res = await fetch(
        "https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&country=in&protocol=http&proxy_format=ipport&format=text"
      );
      
      if (!res.ok) throw new Error(`ProxyScrape API returned status: ${res.status}`);
      
      const text = await res.text();
      const proxies = text.split("\n").map(p => p.trim()).filter(Boolean);

      if (proxies.length === 0) {
        console.warn("⚠️ Public proxy directory returned zero active Indian endpoints.");
        return false;
      }

      // Take a wider batch of 30 candidates to maximize our odds
      const candidates = proxies.slice(0, 30);
      console.log(`🔄 Testing ${candidates.length} candidates simultaneously in parallel...`);

      // Inline helper to validate a single proxy target
      const testProxy = async (proxy) => {
        const proxyUrl = `http://${proxy}`;
        const agent = new ProxyAgent({ uri: proxyUrl, requestTimeout: 12000 });
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000); // 6 second parallel limit

        try {
          // Using api.ipify.org because it doesn't block public proxies like Google does
          const testRes = await fetch("https://api.ipify.org", {
            dispatcher: agent,
            signal: controller.signal
          });
          clearTimeout(timeout);

          if (testRes.ok) {
            return { agent, proxyUrl };
          }
          throw new Error("Failed validation status check");
        } catch (err) {
          clearTimeout(timeout);
          throw err;
        }
      };

      // Promise.any returns the FIRST promise that resolves successfully.
      // The fastest working proxy wins instantly!
      const winner = await Promise.any(candidates.map(p => testProxy(p)));
      
      console.log(`✅ Validated working Indian proxy route: [${winner.proxyUrl}]`);
      setGlobalDispatcher(winner.agent);
      return true;

    } catch (err) {
      // Catches if Promise.any throws an AggregateError (meaning all 30 options failed)
      console.warn("❌ All parallel public proxy options failed validation rules.");
    }
    
    console.warn("⚠️ Pipeline falling back to clear execution context.");
    return false;
  })();

  return proxyInitPromise;
}
