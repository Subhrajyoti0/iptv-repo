import { ProxyAgent, setGlobalDispatcher, fetch } from "undici";

// Global failsafe: prevents internal Node crypto layers from rejecting self-signed public proxy certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

let proxyInitPromise = null;

// Spoof a modern Windows Chrome browser to bypass WAF Bot-Detection WAFs
export const WAF_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1"
};

export async function initIndianProxy() {
  if (proxyInitPromise) return proxyInitPromise;

  proxyInitPromise = (async () => {
    const apiUrl = "https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&proxy_format=protocolipport&format=text&protocol=http&country=in";
    
    console.log("🌐 Fetching live proxies from the Indian registry...");
    try {
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error(`ProxyScrape API Error: ${res.status}`);
      
      const text = await res.text();
      let proxies = text.split("\n")
        .map(p => p.trim())
        .filter(Boolean)
        .map(p => p.includes("://") ? p : `http://${p}`);

      if (proxies.length === 0) {
        console.warn("⚠️ Public proxy directory returned zero entries.");
        return false;
      }

      // 50 proxies to maximize our chances against WAF IP-bans
      const candidates = proxies.slice(0, 50);
      console.log(`🔄 Racing ${candidates.length} proxies against the JioTV WAF in parallel...`);

      const testProxy = async (proxyUrl) => {
        // Native undici configuration for strict timeouts and TLS bypass
        const agent = new ProxyAgent({ 
          uri: proxyUrl, 
          connectTimeout: 8000,   // Max time to establish TCP socket
          headersTimeout: 10000,  // Max time waiting for WAF to clear headers
          bodyTimeout: 10000,     // Max time to download response
          requestTls: { rejectUnauthorized: false },
          proxyTls: { rejectUnauthorized: false }
        });
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);

        try {
          // WORST CASE FIX: We test directly against JioTV to ensure the WAF doesn't block the IP
          const testRes = await fetch("https://jiotv.com/", {
            dispatcher: agent,
            signal: controller.signal,
            headers: WAF_HEADERS // Bypass User-Agent fingerprinting
          });
          
          clearTimeout(timeout);

          // Only accept proxies that Jio explicitly allows (200 OK)
          if (testRes.ok) {
            return { agent, proxyUrl };
          }
          throw new Error(`Jio_WAF_Rejected_${testRes.status}`);
        } catch (err) {
          clearTimeout(timeout);
          const trueError = err.cause ? (err.cause.message || err.cause.code) : err.message;
          throw new Error(trueError);
        }
      };

      // The first proxy to bypass the WAF and load JioTV wins
      const winner = await Promise.any(candidates.map(p => testProxy(p)));
      
      console.log(`\n✅ WAF BYPASS SUCCESS! Routed network through: [${winner.proxyUrl}]`);
      
      // Lock this verified proxy globally for the rest of the Node process
      setGlobalDispatcher(winner.agent);
      return true;

    } catch (aggregateError) {
      console.error("\n❌ All parallel proxy verification paths failed WAF/Network checks.");
      
      if (aggregateError.errors) {
        const uniqueErrors = [...new Set(aggregateError.errors.map(e => e.message))];
        console.log("🔍 Troubleshooting Connection Diagnostics:");
        uniqueErrors.forEach(err => console.log(`   -> Dropped due to: ${err}`));
      }
    }
    
    console.warn("⚠️ Pipeline falling back to clear system execution context (Likely to hit 450 Geo-block).");
    return false;
  })();

  return proxyInitPromise;
  }
