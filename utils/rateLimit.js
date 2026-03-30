export function createLimiter(limit) {
  let running = 0
  const queue = []

  async function next(fn) {
    if (running >= limit) {
      await new Promise(res => queue.push(res))
    }
    running++
    try {
      return await fn()
    } finally {
      running--
      queue.shift()?.()
    }
  }

  return next
}
