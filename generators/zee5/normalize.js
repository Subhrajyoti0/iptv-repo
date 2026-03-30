export function normalizeProgrammes(programmes) {
  const seen = new Set()

  return programmes
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    .filter(p => {
      if (!p.start_time || !p.end_time) return false

      const start = Date.parse(p.start_time)
      const end = Date.parse(p.end_time)
      if (end <= start) return false

      const key = `${start}-${end}-${p.title}`
      if (seen.has(key)) return false
      seen.add(key)

      return true
    })
    .map(p => ({
      title: p.title,
      desc: p.description || '',
      start: new Date(p.start_time),
      stop: new Date(p.end_time),
      categories: (p.genres || []).map(g => g.value),
    }))
}
