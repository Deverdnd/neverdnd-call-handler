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
    // Get business info based on phone number
    const { data: business } = await supabase
      .from('businesses')
      .select('id, name, phone_number')
      .eq('phone_number', callData.toNumber)
      .single()
    
    if (!business) {
      console.log('No business found for', callData.toNumber)
      return
    }
    
    // Get business owner contact (for now, we'll use a notification number if available)
    // In production, add a notification_phone field to businesses table
    
    // Format the notification
    const message = `🔔 New Call Alert!

Business: ${business.name}
From: ${callData.fromNumber}
Duration: ${callData.duration || 'In progress'}
Time: ${new Date().toLocaleTimeString()}

Summary: ${callData.summary || 'Call just received'}

View details: https://admin-nu-flame.vercel.app`
    
    // For now, send to admin (you)
    // TODO: Add notification_phone field to businesses table
    const adminPhone = '+16059061778' // Replace with your actual number
    
    await sendSMS(adminPhone, message)
    
  } catch (error) {
    console.error('Error sending notification:', error)
  }
}

module.exports = {
  sendSMS,
  notifyBusinessOwner
}
