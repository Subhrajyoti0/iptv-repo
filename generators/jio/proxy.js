import { ProxyAgent, setGlobalDispatcher, fetch } from "undici";

// Global failsafe flag to prevent internal crypto layers from rejecting public proxy streams
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

let proxyInitPromise = null;

/**
 * Automatically discovers, verifies, and attaches a live Indian proxy.
 * Explicitly pulls nodes that support SSL/HTTPS tunneling.
 */
export async function initIndianProxy() {
  if (proxyInitPromise) return proxyInitPromise;

  proxyInitPromise = (async () => {
    // 1. Try fetching proxies explicitly verified to support SSL tunneling first
    const apiUrl = "https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&proxy_format=protocolipport&format=text&protocol=http&country=in&ssl=yes";
    
    console.log("🌐 Fetching live proxies from the custom Indian registry list...");
    try {
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error(`ProxyScrape API returned error status: ${res.status}`);
      
      const text = await res.text();
      let proxies = text.split("\n")
        .map(p => p.trim())
        .filter(Boolean)
        .map(p => p.includes("://") ? p : `http://${p}`);

      // Fallback: If the strict SSL pool is empty, grab the wider list
      if (proxies.length === 0) {
        console.warn("⚠️ No explicit SSL proxies found in current slice. Pulling general pool...");
        const fallbackRes = await fetch("https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&proxy_format=protocolipport&format=text&protocol=http&country=in");
        if (fallbackRes.ok) {
          const fallbackText = await fallbackRes.text();
          proxies = fallbackText.split("\n")
            .map(p => p.trim())
            .filter(Boolean)
            .map(p => p.includes("://") ? p : `http://${p}`);
        }
      }

      if (proxies.length === 0) {
        console.warn("⚠️ Public proxy directory returned zero active text entries.");
        return false;
      }

      // Check up to 60 proxies across the cluster to find a fast responder
      const candidates = proxies.slice(0, 60);
      console.log(`🔄 Racing ${candidates.length} Indian proxies in parallel...`);

      const testProxy = async (proxyUrl) => {
        // Correct undici structure for handling strict SSL bypass across a proxy tunnel
        const agent = new ProxyAgent({ 
          uri: proxyUrl, 
          requestTimeout: 15000, 
          requestTls: {
            rejectUnauthorized: false
          },
          proxyTls: {
            rejectUnauthorized: false
          }
        });
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000); // 12s benchmark cap

        try {
          const testRes = await fetch("https://api.ipify.org", {
            dispatcher: agent,
            signal: controller.signal
          });
          clearTimeout(timeout);

          if (testRes.ok) {
            const verifiedIp = await testRes.text();
            return { agent, proxyUrl, verifiedIp: verifiedIp.trim() };
          }
          throw new Error(`HTTP_Status_${testRes.status}`);
        } catch (err) {
          clearTimeout(timeout);
          
          // Drill past the generic 'fetch failed' wrapper down to the true connection cause
          const trueError = err.cause ? (err.cause.message || err.cause.code || err.cause) : err.message;
          throw new Error(trueError);
        }
      };

      // First proxy to successfully resolve ipify wins the race instantly
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
      } else {
        console.error("   -> Error:", aggregateError.message || aggregateError);
      }
    }
    
    console.warn("⚠️ Pipeline falling back to clear system execution context.");
    return false;
  })();

  return proxyInitPromise;
  }
