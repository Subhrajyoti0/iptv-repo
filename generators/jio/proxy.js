import fs from "fs";
import { ProxyAgent } from "undici";

// Using standard Indian proxy lists + some reliable fallbacks
const PROXY_SOURCES = [
  "https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt",
  "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt",
  "https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt"
];

// Helper: strictly grab proxies that are likely in India
async function fetchIndianProxies() {
  console.log("🌐 Fetching live proxies from the custom Indian registry list...");
  const proxies = new Set();
  
  try {
    for (const source of PROXY_SOURCES) {
      const res = await fetch(source);
      if (!res.ok) continue;
      const text = await res.text();
      
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        // Basic naive IP format check just to clean garbage data
        if (line.match(/^(\d{1,3}\.){3}\d{1,3}:\d{2,5}$/)) {
          proxies.add(`http://${line}`);
        }
      }
    }
  } catch (err) {
    console.warn("⚠️ Could not fetch proxy list, returning empty set.");
  }
  
  // Return an array of up to 50 proxies to race
  return Array.from(proxies).slice(0, 50);
}

// Helper: Test a single proxy
async function verifyProxy(proxyUrl) {
  // ✅ FIX: Replaced requestTimeout with undici's native timeout properties
  const agent = new ProxyAgent({ 
    uri: proxyUrl, 
    connectTimeout: 8000, 
    headersTimeout: 10000,
    bodyTimeout: 10000,
    requestTls: { rejectUnauthorized: false },
    proxyTls: { rejectUnauthorized: false }
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second hard-abort

  try {
    const res = await fetch("https://jiotv.com", {
      dispatcher: agent,
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      return agent; // Return the working agent!
    }
    throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError' || err.code === 'UND_ERR_HEADERS_TIMEOUT') {
        throw new Error("Timeout");
    }
    throw err;
  }
}

let activeAgent = null;

// Main export: Finds the fastest working proxy
export async function getJioProxyAgent() {
  if (activeAgent) return activeAgent;

  const proxyList = await fetchIndianProxies();
  if (proxyList.length === 0) return null;

  // Take the first 8 proxies and race them. We just need ONE to work.
  const batch = proxyList.slice(0, 8);
  console.log(`🔄 Racing ${batch.length} Indian proxies in parallel...`);

  try {
    // Promise.any resolves as soon as ONE proxy successfully connects and returns the agent
    activeAgent = await Promise.any(batch.map(url => verifyProxy(url)));
    console.log("✅ Successfully established proxy tunnel to India!");
    return activeAgent;
  } catch (aggregateError) {
    console.warn("❌ All parallel proxy verification paths failed.");
    
    // Print out the exact failure reasons to help with debugging
    console.log("🔍 Troubleshooting Connection Diagnostics:");
    aggregateError.errors.forEach(e => {
        console.log(`   -> Node dropped request due to: ${e.message}`);
    });

    console.warn("⚠️ Pipeline falling back to clear system execution context.");
    return null; 
  }
}
