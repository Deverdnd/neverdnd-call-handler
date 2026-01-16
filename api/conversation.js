const { createClient } = require('@supabase/supabase-js')
const { generateAIResponse } = require('../lib/ai')
const { canUseScheduling } = require('../lib/subscriptions')
const { processAppointmentScheduling } = require('../lib/appointment-handler')
const logger = require('../lib/logger')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// ALWAYS fetch fresh config - NO CACHING to prevent stale data
// Store conversation history per call
const conversationHistory = new Map()

async function getAIConfig(toNumber) {
  try {
    logger.info('[Conversation] Fetching AI config', { toNumber })
    
    const { data: businessData, error: businessError } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('phone_number', toNumber)
      .single()
    
    if (businessError) {
      logger.warn('[Conversation] Business lookup failed', { toNumber, error: businessError.message })
    }
    
    let config
    if (businessData) {
      logger.info('[Conversation] Business found', { businessId: businessData.id })
      
      const { data, error } = await supabase
        .from('ai_config')
        .select('*')
        .eq('business_id', businessData.id)
        .single()
      
      if (error) {
        logger.warn('[Conversation] Config lookup failed', { error: error.message })
      } else if (data) {
        logger.info('[Conversation] Business config loaded')
        config = data
      }
    }
    
    if (!config) {
      logger.info('[Conversation] Loading default config')
      const { data } = await supabase
        .from('ai_config')
        .select('*')
        .is('business_id', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      config = data || {
        greeting: "Hi! Thanks for calling. How can I help you today?",
        business_info: "We are available to help you.",
        tone: "professional",
        additional_instructions: ""
      }
    }
    
    return config
  } catch (error) {
    logger.error('[Conversation] Error fetching config', { error: error.message })
    return {
      greeting: "Hi! Thanks for calling. How can I help you today?",
      business_info: "We are available to help you.",
      tone: "professional",
      additional_instructions: ""
    }
  }
}
        .select('*')
        .is('business_id', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      config = data || {
        business_info: "We are available to help you.",
        tone: "professional",
        additional_instructions: ""
      }
    }
    
    configCache.set(cacheKey, config)
    configLastFetch.set(cacheKey, now)
    return config
  } catch (error) {
    console.error('Error fetching AI config:', error)
    return {
      business_info: "We are available to help you.",
      tone: "professional",
      additional_instructions: ""
    }
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed')
  }

  const callSid = req.body.CallSid || req.query.CallSid
  const userSaid = req.body.SpeechResult || 'nothing'
  const toNumber = req.query.To || req.body.To
  const fromNumber = req.body.From || req.query.From
  
  logger.info('User spoke', { callSid, userSaid })
  
  const config = await getAIConfig(toNumber)
  
  // Get business ID and check scheduling capability
  let businessId = null
  let hasScheduling = false
  
  try {
    const { data: businessData } = await supabase
      .from('businesses')
      .select('id')
      .eq('phone_number', toNumber)
      .single()
    
    if (businessData) {
      businessId = businessData.id
      hasScheduling = await canUseScheduling(businessId)
      logger.info('Business scheduling capability', { businessId, hasScheduling })
    }
  } catch (error) {
    logger.warn('Could not determine business scheduling capability', { error: error.message })
  }
  
  // Get conversation history for this call
  if (!conversationHistory.has(callSid)) {
    conversationHistory.set(callSid, [])
  }
  const history = conversationHistory.get(callSid)
  
  // Generate AI response with scheduling awareness
  const response = await generateAIResponse(userSaid, config, history, hasScheduling)
  
  // Check if response contains appointment scheduling
  let finalResponse = response
  if (hasScheduling && businessId) {
    const appointmentResult = await processAppointmentScheduling(
      callSid,
      businessId,
      response,
      fromNumber
    )
    
    if (appointmentResult && appointmentResult.success) {
      // Replace the scheduling block with confirmation message
      finalResponse = response.replace(/SCHEDULE_APPOINTMENT[\s\S]*?END_APPOINTMENT/g, '')
      finalResponse += ' ' + appointmentResult.confirmationMessage
      logger.info('Appointment scheduled successfully', { 
        callSid, 
        appointmentId: appointmentResult.appointmentId 
      })
    }
  }
  
  // Update conversation history
  history.push(
    { role: 'user', content: userSaid },
    { role: 'assistant', content: finalResponse }
  )
  
  // Keep only last 10 exchanges
  if (history.length > 20) {
    history.splice(0, history.length - 20)
  }
  
  logger.info('AI responded', { callSid })
  
  const baseUrl = `https://${req.headers.host}`
  
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${finalResponse}</Say>
  <Gather input="speech" timeout="5" speechTimeout="auto" action="${baseUrl}/api/conversation?CallSid=${callSid}&To=${encodeURIComponent(toNumber || '')}&From=${encodeURIComponent(fromNumber || '')}">
    <Say voice="Polly.Joanna">I'm listening...</Say>
  </Gather>
  <Say voice="Polly.Joanna">Thanks for calling! Have a great day!</Say>
  <Hangup/>
</Response>`

  res.setHeader('Content-Type', 'text/xml')
  res.status(200).send(twiml)
}

// Export for cleanup
module.exports.conversationHistory = conversationHistory
