export function resolveMatch({ jio, zee, iptv, jioToIptv, jioToZee }) {
  if (jio && jioToIptv && jioToZee) {
    return {
      status: "matched",
      confidence: "high",
      source: "jio+zee+iptv",
      score: {
        iptv: jioToIptv.score,
        zee: jioToZee.score
      },
      channel: mergeChannel(jio, jioToZee.best, jioToIptv.best)
    };
  }

  if (jio && jioToIptv) {
    return {
      status: "matched",
      confidence: "high",
      source: "jio+iptv",
      score: {
        iptv: jioToIptv.score
      },
      channel: mergeChannel(jio, null, jioToIptv.best)
    };
  }

  if (jio && jioToZee) {
    return {
      status: "review",
      reason: "matched Zee metadata but no iptv-org stream target",
      score: {
        zee: jioToZee.score
      },
      data: {
        jio,
        zee: jioToZee.best
      }
    };
  }

  return {
    status: "review",
    reason: "no confident iptv-org match",
    data: {
      jio
    }
  };
}

function mergeChannel(jio, zee, iptv) {
  return {
    tvg_id: iptv?.id || null,
    name: jio?.name || zee?.name || iptv?.name,
    display_name: jio?.name || zee?.name || iptv?.name,
    source_ids: {
      jio: jio?.id || null,
      zee: zee?.id || null,
      iptv: iptv?.id || null
    },
    language: jio?.language || zee?.language || null,
    group: jio?.group || zee?.group || iptv?.group || null,
    quality: jio?.quality || zee?.quality || iptv?.quality || null,
    logo: jio?.logo || zee?.logo || null,
    url: iptv?.url || null,
    confidence_source: zee ? "jio+zee+iptv" : "jio+iptv"
  };
}
