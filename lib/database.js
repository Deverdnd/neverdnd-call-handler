const { createClient } = require('@supabase/supabase-js')

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('⚠️  Missing Supabase credentials in environment variables')
}

const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * Log a call to the database
 * @param {Object} callData - Call information from Twilio
 * @returns {Promise<Object>} - Created call record
 */
async function logCall(callData) {
  try {
    const { data, error } = await supabase
      .from('calls')
      .insert({
        from_number: callData.from,
        to_number: callData.to,
        status: callData.status,
        duration: callData.duration,
        transcript: callData.transcript,
        summary: callData.summary,
        recording_url: callData.recordingUrl,
        business_id: callData.businessId || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Error logging call to database:', error)
      return null
    }

    console.log('✅ Call logged to database:', data.id)
    return data
  } catch (error) {
    console.error('❌ Exception logging call:', error)
    return null
  }
}

/**
 * Update an existing call record
 * @param {string} callSid - Twilio call SID
 * @param {Object} updates - Fields to update
 */
async function updateCall(callSid, updates) {
  try {
    const { data, error } = await supabase
      .from('calls')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('from_number', callSid) // We'll track by from_number initially
      .select()
      .single()

    if (error) {
      console.error('❌ Error updating call:', error)
      return null
    }

    console.log('✅ Call updated:', data.id)
    return data
  } catch (error) {
    console.error('❌ Exception updating call:', error)
    return null
  }
}

/**
 * Generate AI summary of conversation
 * @param {string} transcript - Full conversation transcript
 * @returns {Promise<string>} - Generated summary
 */
async function generateSummary(transcript) {
  try {
    const OpenAI = require('openai')
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })

    if (!process.env.OPENAI_API_KEY) {
      console.log('⚠️  OpenAI API key not set, skipping summary generation')
      return 'Summary generation disabled'
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that summarizes phone call transcripts in 1-2 sentences. Focus on the caller's needs and any action items."
        },
        {
          role: "user",
          content: `Summarize this call transcript:\n\n${transcript}`
        }
      ],
      max_tokens: 100
    })

    const summary = completion.choices[0].message.content
    console.log('✅ Generated AI summary:', summary)
    return summary
  } catch (error) {
    console.error('❌ Error generating summary:', error)
    return 'Unable to generate summary'
  }
}

module.exports = {
  supabase,
  logCall,
  updateCall,
  generateSummary
}
