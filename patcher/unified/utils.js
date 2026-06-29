export function clean(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/&/g, "and")
    .replace(/\b(hd|sd|uhd|fhd|4k)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function compact(value = "") {
  return clean(value).replace(/\s+/g, "");
}

export function tokenSet(value = "") {
  return new Set(clean(value).split(/\s+/).filter(Boolean));
}

export function jaccard(a, b) {
  const A = tokenSet(a);
  const B = tokenSet(b);

  if (!A.size || !B.size) return 0;

  const inter = [...A].filter(x => B.has(x)).length;
  const union = new Set([...A, ...B]).size;

  return inter / union;
}

export function similarity(a, b) {
  const ca = compact(a);
  const cb = compact(b);

  if (!ca || !cb) return 0;
  if (ca === cb) return 1;

  let score = 0;

  if (ca.includes(cb) || cb.includes(ca)) {
    score = Math.max(score, 0.82);
  }

  score = Math.max(score, jaccard(a, b));

  return score;
}

export function ensureDir(pathname, fs) {
  const dir = pathname.split("/").slice(0, -1).join("/");
  if (dir) fs.mkdirSync(dir, { recursive: true });
}
