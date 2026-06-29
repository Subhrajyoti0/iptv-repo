import fs from "fs";

import { loadAllSources } from "./sources.js";
import { normalizeJio, normalizeZee, normalizeIPTV } from "./normalize.js";
import { findBest } from "./matcher.js";
import { resolveMatch } from "./resolver.js";
import { saveReview } from "./review.js";

const OUT_FILE = "output/unified_channels.json";

export async function runUnifiedPatcher() {
  const sources = loadAllSources();

  const jio = sources.jio.map(normalizeJio).filter(ch => ch.name);
  const zee = sources.zee.map(normalizeZee).filter(ch => ch.name);
  const iptv = sources.iptv.map(normalizeIPTV).filter(ch => ch.name);

  console.log(`📦 Jio channels : ${jio.length}`);
  console.log(`📦 Zee channels : ${zee.length}`);
  console.log(`📦 IPTV entries : ${iptv.length}`);

  const final = [];
  const review = [];

  for (const j of jio) {
    const jioToIptv = findBest(j, iptv, 0.84);
    const jioToZee = findBest(j, zee, 0.78);

    const result = resolveMatch({
      jio: j,
      zee,
      iptv,
      jioToIptv,
      jioToZee
    });

    if (result.status === "matched") {
      final.push(result.channel);
    } else {
      review.push(result);
    }
  }

  fs.mkdirSync("output", { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(final, null, 2));
  saveReview(review, "output/review.json");

  console.log(`✅ Unified channels: ${final.length}`);
  console.log(`⚠️ Review required : ${review.length}`);
  console.log(`✅ ${OUT_FILE}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runUnifiedPatcher().catch(err => {
    console.error("❌ Unified patcher failed:", err);
    process.exit(1);
  });
}
