const { createClient } = require('@supabase/supabase-js')

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
          business_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
      
      if (error) {
        console.error('❌ Database error:', error)
      } else {
        console.log('✅ Call saved to database! ID:', data[0]?.id)
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
