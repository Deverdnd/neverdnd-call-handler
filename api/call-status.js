const { createClient } = require('@supabase/supabase-js')
const { notifyBusinessOwner, sendSMS } = require('../lib/sms')
const logger = require('../lib/logger')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed')
  }

  const callSid = req.body.CallSid
  const callStatus = req.body.CallStatus
  const duration = req.body.CallDuration
  const from = req.body.From
  const to = req.body.To

  logger.info('Call status update', { callSid, callStatus, duration })

  // Only send notification when call is completed
  if (callStatus === 'completed') {
    try {
      // Get the call record
      const { data: call } = await supabase
        .from('calls')
        .select('*')
        .eq('call_sid', callSid)
        .single()

      // Get business
      const { data: business } = await supabase
        .from('businesses')
        .select('*')
        .eq('phone_number', to)
        .single()

      if (business && business.notification_phone && business.notify_on_call) {
        // Send SMS notification
        const message = `🔔 Call Completed

Business: ${business.name}
Caller: ${from.slice(-4)} (ends in)
Duration: ${duration}s
Time: ${new Date().toLocaleTimeString()}

${call?.summary || 'No summary available'}

View: https://admin-nu-flame.vercel.app`

        await sendSMS(business.notification_phone, message)
      }
    } catch (error) {
      logger.error('Error in call status handler', error)
    }
  }

  res.status(200).send('OK')
}
