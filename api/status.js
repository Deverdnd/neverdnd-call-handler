const { createClient } = require('@supabase/supabase-js')
const { sendSMS } = require('../lib/sms')

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// In-memory store for active calls
const activeCalls = new Map()

// Generate AI summary
async function generateSummary(transcript) {
  try {
    if (!process.env.OPENAI_API_KEY || !transcript || transcript.length < 10) {
      return 'No conversation recorded'
    }

    const OpenAI = require('openai')
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Summarize this phone call in 1-2 sentences. Focus on the caller's needs."
        },
        { role: "user", content: `Summarize:\n\n${transcript}` }
      ],
      max_tokens: 100
    })

    return completion.choices[0].message.content
  } catch (error) {
    console.error('Error generating summary:', error)
    return 'Summary generation failed'
  }
}

module.exports = async (req, res) => {
  try {
    const callSid = req.body.CallSid
    const callStatus = req.body.CallStatus
    const callDuration = req.body.CallDuration || '0'
    const from = req.body.From
    const to = req.body.To
    const recordingUrl = req.body.RecordingUrl || null
    
    console.log('📊 Call status webhook:', {
      callSid,
      status: callStatus,
      duration: callDuration,
      from,
      to
    })
    
    // When call is completed, save to database
    if (callStatus === 'completed') {
      console.log('💾 Call completed, saving to database...')
      
      // Get conversation from memory if available
      const callData = activeCalls.get(callSid) || {}
      const transcriptText = callData.transcriptText || 'No transcript available'
      
      // Generate AI summary
      console.log('🤖 Generating AI summary...')
      const summary = await generateSummary(transcriptText)
      console.log('✅ Summary generated:', summary)
      
      // Get business ID for this phone number
      let businessId = null
      try {
        const { data: businessData } = await supabase
          .from('businesses')
          .select('id')
          .eq('phone_number', to)
          .single()
        
        if (businessData) {
          businessId = businessData.id
          console.log('✅ Found business ID:', businessId)
        }
      } catch (err) {
        console.warn('⚠️  No business found for number:', to)
      }
      
      // Save to database
      console.log('💾 Inserting into database...')
      const { data, error } = await supabase
        .from('calls')
        .insert({
          from_number: from,
          to_number: to,
          status: callStatus,
          duration: parseInt(callDuration),
          transcript: transcriptText,
          summary: summary,
          recording_url: recordingUrl,
          business_id: businessId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
      
      if (error) {
        console.error('❌ Database error:', error)
      } else {
        console.log('✅ Call saved to database! ID:', data[0]?.id)
        
        // Send SMS notification to business owner
        try {
          const { data: business } = await supabase
            .from('businesses')
            .select('name, notification_phone, notify_on_call')
            .eq('phone_number', to)
            .single()
          
          if (business && business.notification_phone && business.notify_on_call) {
            const minutes = Math.floor(parseInt(callDuration) / 60)
            const seconds = parseInt(callDuration) % 60
            const durationText = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
            
            const smsMessage = `📞 New Call - ${business.name}

From: ***${from.slice(-4)}
Duration: ${durationText}
Time: ${new Date().toLocaleTimeString()}

Summary: ${summary}

View details: https://admin-nu-flame.vercel.app`
            
            await sendSMS(business.notification_phone, smsMessage)
            console.log('✅ SMS notification sent')
          }
        } catch (smsError) {
          console.error('⚠️  SMS notification failed:', smsError)
          // Don't fail the whole request if SMS fails
        }
      }
      
      // Clean up memory
      activeCalls.delete(callSid)
    }
    
    res.status(200).send('OK')
  } catch (error) {
    console.error('❌ Error in status webhook:', error)
    res.status(200).send('OK') // Still return OK to Twilio
  }
}

// Export activeCalls so other functions can use it
module.exports.activeCalls = activeCalls
