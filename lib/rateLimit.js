// Simple in-memory rate limiter
const requestCounts = new Map()
const RATE_LIMIT_WINDOW = 60000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10 // 10 requests per minute per IP

function cleanupOldEntries() {
  const now = Date.now()
  for (const [key, data] of requestCounts.entries()) {
    if (now - data.windowStart > RATE_LIMIT_WINDOW) {
      requestCounts.delete(key)
    }
  }
}

function checkRateLimit(identifier) {
  cleanupOldEntries()
  
  const now = Date.now()
  const record = requestCounts.get(identifier)
  
  if (!record) {
    requestCounts.set(identifier, {
      count: 1,
      windowStart: now
    })
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1 }
  }
  
  if (now - record.windowStart > RATE_LIMIT_WINDOW) {
    requestCounts.set(identifier, {
      count: 1,
      windowStart: now
    })
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1 }
  }
  
  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return { 
      allowed: false, 
      remaining: 0,
      resetIn: RATE_LIMIT_WINDOW - (now - record.windowStart)
    }
  }
  
  record.count++
  return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - record.count }
}

module.exports = { checkRateLimit }
