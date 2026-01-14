const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || '+16053075572'

async function sendSMS(to, message) {
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`
    
    const params = new URLSearchParams({
      To: to,
      From: TWILIO_PHONE_NUMBER,
      Body: message
    })
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    })
    
    if (response.ok) {
      console.log('✅ SMS sent successfully to', to)
      return true
    } else {
      const error = await response.text()
      console.error('❌ SMS failed:', error)
      return false
    }
  } catch (error) {
    console.error('❌ SMS error:', error)
    return false
  }
}

async function notifyBusinessOwner(callData) {
  try {
    // Get business info with SMS settings
    const { data: business } = await supabase
      .from('businesses')
      .select('*')
      .eq('phone_number', callData.toNumber)
      .single()
    
    if (!business) {
      console.log('No business found for', callData.toNumber)
      return
    }
    
    // Check if notifications are enabled
    if (!business.notify_on_call || !business.notification_phone) {
      console.log('Notifications disabled or no notification phone set')
      return
    }
    
    // Format call data
    const duration = callData.duration ? formatDuration(callData.duration) : 'In progress'
    const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const callerMasked = maskPhoneNumber(callData.fromNumber)
    
    // Build SMS message based on template
    let message = ''
    const template = business.sms_template || 'standard'
    
    switch (template) {
      case 'minimal':
        message = buildMinimalTemplate(business, {
          callerMasked,
          duration,
          summary: callData.summary
        })
        break
        
      case 'detailed':
        message = buildDetailedTemplate(business, {
          callerMasked,
          duration,
          time,
          date,
          summary: callData.summary,
          transcript: callData.transcript
        })
        break
        
      case 'custom':
        message = buildCustomTemplate(business, {
          business_name: business.name,
          caller_number: callerMasked,
          duration,
          time,
          date,
          summary: callData.summary,
          dashboard_link: 'https://admin-nu-flame.vercel.app',
          transcript: callData.transcript
        })
        break
        
      case 'standard':
      default:
        message = buildStandardTemplate(business, {
          callerMasked,
          duration,
          time,
          summary: callData.summary
        })
        break
    }
    
    // Send SMS
    await sendSMS(business.notification_phone, message)
    console.log(`✅ Notification sent to ${business.notification_phone}`)
    
  } catch (error) {
    console.error('Error sending notification:', error)
  }
}

function maskPhoneNumber(phone) {
  // Mask phone number: +16055551234 -> +******1234
  if (phone && phone.length > 4) {
    return '+******' + phone.slice(-4)
  }
  return phone
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${secs}s`
}

function buildStandardTemplate(business, data) {
  let parts = []
  
  parts.push('🔔 New Call Alert!')
  parts.push('')
  
  if (business.sms_include_business_name !== false) {
    parts.push(`Business: ${business.name}`)
  }
  
  if (business.sms_include_caller_number !== false) {
    parts.push(`From: ${data.callerMasked}`)
  }
  
  if (business.sms_include_duration !== false) {
    parts.push(`Duration: ${data.duration}`)
  }
  
  if (business.sms_include_time !== false) {
    parts.push(`Time: ${data.time}`)
  }
  
  if (business.sms_include_summary !== false && data.summary) {
    parts.push('')
    parts.push(`Summary: ${data.summary}`)
  }
  
  if (business.sms_include_dashboard_link !== false) {
    parts.push('')
    parts.push('View: https://admin-nu-flame.vercel.app')
  }
  
  return parts.join('\n')
}

function buildMinimalTemplate(business, data) {
  let parts = []
  
  parts.push(`📞 Call from ${data.callerMasked}`)
  
  if (business.sms_include_duration !== false) {
    parts.push(`Duration: ${data.duration}`)
  }
  
  if (business.sms_include_summary !== false && data.summary) {
    parts.push(data.summary)
  }
  
  return parts.join('\n')
}

function buildDetailedTemplate(business, data) {
  let parts = []
  
  parts.push(`🔔 NEW CALL - ${business.name}`)
  parts.push('')
  
  if (business.sms_include_caller_number !== false) {
    parts.push(`Caller: ${data.callerMasked}`)
  }
  
  if (business.sms_include_duration !== false) {
    parts.push(`Duration: ${data.duration}`)
  }
  
  if (business.sms_include_time !== false) {
    parts.push(`Time: ${data.time}`)
    parts.push(`Date: ${data.date}`)
  }
  
  if (business.sms_include_summary !== false && data.summary) {
    parts.push('')
    parts.push('What they said:')
    parts.push(data.summary)
  }
  
  if (business.sms_include_transcript && data.transcript) {
    parts.push('')
    parts.push('Transcript:')
    parts.push(data.transcript.substring(0, 200) + '...') // Limit length
  }
  
  if (business.sms_include_dashboard_link !== false) {
    parts.push('')
    parts.push('Dashboard: https://admin-nu-flame.vercel.app')
  }
  
  return parts.join('\n')
}

function buildCustomTemplate(business, data) {
  let template = business.custom_sms_template || buildStandardTemplate(business, data)
  
  // Replace all variables
  template = template.replace(/{business_name}/g, data.business_name)
  template = template.replace(/{caller_number}/g, data.caller_number)
  template = template.replace(/{duration}/g, data.duration)
  template = template.replace(/{time}/g, data.time)
  template = template.replace(/{date}/g, data.date)
  template = template.replace(/{summary}/g, data.summary || 'No summary available')
  template = template.replace(/{dashboard_link}/g, data.dashboard_link)
  template = template.replace(/{transcript}/g, data.transcript ? data.transcript.substring(0, 200) + '...' : '')
  
  return template
}

module.exports = {
  sendSMS,
  notifyBusinessOwner
}
