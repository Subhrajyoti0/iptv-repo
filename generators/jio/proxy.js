import { ProxyAgent, setGlobalDispatcher, fetch } from "undici";

let proxyInitPromise = null;

/**
 * Automatically discovers, verifies, and attaches a live Indian HTTP proxy.
 * Tailored for high-latency tolerance and loose TLS handshake compliance.
 */
export async function initIndianProxy() {
  if (proxyInitPromise) return proxyInitPromise;

  proxyInitPromise = (async () => {
    const apiUrl = "https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&proxy_format=protocolipport&format=text&protocol=http&country=in";
    
    console.log("🌐 Fetching live proxies from the custom Indian registry list...");
    try {
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error(`ProxyScrape API returned error status: ${res.status}`);
      
      const text = await res.text();
      const proxies = text.split("\n")
        .map(p => p.trim())
        .filter(Boolean)
        .map(p => p.startsWith("http") ? p : `http://${p}`);

      if (proxies.length === 0) {
        console.warn("⚠️ Public proxy directory returned zero active text entries.");
        return false;
      }

      // Grab up to 50 proxies to capture both the fast 450ms nodes and the slower ones
      const candidates = proxies.slice(0, 50);
      console.log(`🔄 Racing ${candidates.length} proxies simultaneously in parallel...`);

      const testProxy = async (proxyUrl) => {
        // Relax TLS validation rules to handle public proxy certificate modifications
        const agent = new ProxyAgent({ 
          uri: proxyUrl, 
          requestTimeout: 25000, // 25-second resilience boundary for slow nodes
          connect: {
            rejectUnauthorized: false
          }
        });
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000); // 20s test window

        try {
          const testRes = await fetch("https://api.ipify.org", {
            dispatcher: agent,
            signal: controller.signal,
            // Disable strict SSL verification on the test fetch itself
            rejectUnauthorized: false
          });
          clearTimeout(timeout);

          if (testRes.ok) {
            const verifiedIp = await testRes.text();
            return { agent, proxyUrl, verifiedIp: verifiedIp.trim() };
          }
          throw new Error(`HTTP_Status_${testRes.status}`);
        } catch (err) {
          clearTimeout(timeout);
          throw new Error(err.code || err.message || "Timeout");
        }
      };

      // The fastest working node wins the race instantly
      const winner = await Promise.any(candidates.map(p => testProxy(p)));
      
      console.log(`\n✅ Success! Connected through Indian Proxy: [${winner.proxyUrl}]`);
      console.log(`📡 Verified Node Endpoint IP: ${winner.verifiedIp}`);
      
      setGlobalDispatcher(winner.agent);
      return true;

    } catch (aggregateError) {
      console.error("\n❌ All parallel proxy verification paths failed.");
      
      if (aggregateError.errors) {
        const uniqueErrors = [...new Set(aggregateError.errors.map(e => e.message))];
        console.log("🔍 Troubleshooting Connection Diagnostics:");
        uniqueErrors.forEach(err => console.log(`   -> Node dropped request due to: ${err}`));
      }
    }
    
    console.warn("⚠️ Pipeline falling back to clear system execution context.");
    return false;
  })();

  return proxyInitPromise;
}
