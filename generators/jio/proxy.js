import { ProxyAgent, setGlobalDispatcher, fetch } from "undici";

let proxyInitPromise = null;

/**
 * Automatically discovers, verifies, and attaches a live Indian HTTP proxy.
 * Uses a promise cache to guarantee the search loop runs exactly once per process.
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

      console.log(`🔄 Discovered ${proxies.length} candidates. Verifying tunnel health...`);
      
      // Test the top 15 freshest entries to keep performance fast
      const testPool = proxies.slice(0, 15);

      for (const proxy of testPool) {
        const proxyUrl = `http://${proxy}`;
        const agent = new ProxyAgent({ uri: proxyUrl, requestTimeout: 10000 });

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 4000); // 4s strict connection gate

          const testRes = await fetch("https://www.google.com", {
            dispatcher: agent,
            signal: controller.signal
          });

          clearTimeout(timeout);

          if (testRes.ok) {
            console.log(`✅ Validated working Indian proxy route: [${proxyUrl}]`);
            setGlobalDispatcher(agent);
            return true;
          }
        } catch {
          // Silent catch: continue testing next proxy in queue
        }
      }
      console.warn("❌ All online public proxy options failed validation rules.");
    } catch (err) {
      console.warn(`⚠️ Proxy auto-discovery subsystem error: ${err.message}`);
    }
    
    console.warn("⚠️ Pipeline falling back to clear execution context.");
    return false;
  })();

  return proxyInitPromise;
}
