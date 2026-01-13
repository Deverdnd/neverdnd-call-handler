const { createClient } = require('@supabase/supabase-js')
const { generateAIResponse } = require('../lib/ai')
const logger = require('../lib/logger')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Cache for AI config
let configCache = new Map()
let configLastFetch = new Map()
const CONFIG_CACHE_TTL = 5 * 60 * 1000

// Store conversation history per call
const conversationHistory = new Map()

async function getAIConfig(toNumber) {
  const cacheKey = toNumber || 'default'
  const now = Date.now()
  
  if (configCache.has(cacheKey) && (now - (configLastFetch.get(cacheKey) || 0)) < CONFIG_CACHE_TTL) {
    return configCache.get(cacheKey)
  }
  
  try {
    const { data: businessData } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('phone_number', toNumber)
      .single()
    
    let config
    if (businessData) {
      const { data, error } = await supabase
        .from('ai_config')
        .select('*')
        .eq('business_id', businessData.id)
        .single()
      
      if (data) {
        config = data
      }
    }
    
    if (!config) {
      const { data } = await supabase
        .from('ai_config')
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
  
  logger.info('User spoke', { callSid, userSaid })
  
  const config = await getAIConfig(toNumber)
  
  // Get conversation history for this call
  if (!conversationHistory.has(callSid)) {
    conversationHistory.set(callSid, [])
  }
  const history = conversationHistory.get(callSid)
  
  // Generate AI response using GPT-4
  const response = await generateAIResponse(userSaid, config, history)
  
  // Update conversation history
  history.push(
    { role: 'user', content: userSaid },
    { role: 'assistant', content: response }
  )
  
  // Keep only last 10 exchanges
  if (history.length > 20) {
    history.splice(0, history.length - 20)
  }
  
  logger.info('AI responded', { callSid })
  
  const baseUrl = `https://${req.headers.host}`
  
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${response}</Say>
  <Gather input="speech" timeout="5" speechTimeout="auto" action="${baseUrl}/api/conversation?CallSid=${callSid}&To=${encodeURIComponent(toNumber || '')}">
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
