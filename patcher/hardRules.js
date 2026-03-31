export function hardReject(a, b) {
  // Brand mismatch = reject
  if (a.brand && b.brand && a.brand !== b.brand) return true

  // Language mismatch = reject
  if (a.language && b.language && a.language !== b.language) return true

  // Genre mismatch = reject
  if (a.genre !== b.genre) return true

  return false
}
``
