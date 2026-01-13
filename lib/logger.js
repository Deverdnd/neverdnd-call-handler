// Secure logging utility that masks sensitive data

function maskPhoneNumber(phone) {
  if (!phone) return 'N/A'
  // Show only last 4 digits: +1234567890 -> +******7890
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length > 4) {
    return '+' + '*'.repeat(cleaned.length - 4) + cleaned.slice(-4)
  }
  return '+****'
}

function maskEmail(email) {
  if (!email) return 'N/A'
  const [local, domain] = email.split('@')
  if (!domain) return '***@***'
  return local.substring(0, 2) + '***@' + domain
}

function maskSensitiveData(data) {
  if (typeof data === 'string') {
    // Check if it looks like a phone number
    if (/^\+?\d{10,15}$/.test(data)) {
      return maskPhoneNumber(data)
    }
    // Check if it looks like an email
    if (/@/.test(data)) {
      return maskEmail(data)
    }
    return data
  }
  
  if (typeof data === 'object' && data !== null) {
    const masked = {}
    for (const key in data) {
      if (key.toLowerCase().includes('phone') || key === 'From' || key === 'To') {
        masked[key] = maskPhoneNumber(data[key])
      } else if (key.toLowerCase().includes('email')) {
        masked[key] = maskEmail(data[key])
      } else if (key.toLowerCase().includes('password') || key.toLowerCase().includes('secret')) {
        masked[key] = '***REDACTED***'
      } else {
        masked[key] = data[key]
      }
    }
    return masked
  }
  
  return data
}

function secureLog(level, message, data) {
  const timestamp = new Date().toISOString()
  const maskedData = data ? maskSensitiveData(data) : null
  
  const logEntry = {
    timestamp,
    level,
    message,
    ...(maskedData && { data: maskedData })
  }
  
  console.log(JSON.stringify(logEntry))
}

module.exports = {
  info: (message, data) => secureLog('INFO', message, data),
  warn: (message, data) => secureLog('WARN', message, data),
  error: (message, data) => secureLog('ERROR', message, data),
  maskPhoneNumber,
  maskEmail
}
