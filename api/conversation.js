const { createClient } = require('@supabase/supabase-js')

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Cache for AI config
let configCache = new Map()
let configLastFetch = new Map()
const CONFIG_CACHE_TTL = 5 * 60 * 1000

async function getAIConfig(toNumber) {
  const cacheKey = toNumber || 'default'
  const now = Date.now()
  
  if (configCache.has(cacheKey) && (now - (configLastFetch.get(cacheKey) || 0)) < CONFIG_CACHE_TTL) {
    return configCache.get(cacheKey)
  }
  
  try {
    // First, try to find business by phone number
    const { data: businessData } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('phone_number', toNumber)
      .single()
    
    let config
    if (businessData) {
      // Get business-specific config
      const { data, error } = await supabase
        .from('ai_config')
        .select('*')
        .eq('business_id', businessData.id)
        .single()
      
      if (data) {
        config = data
      }
    }
    
    // If no business-specific config, use default
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
        tone: "professional"
      }
    }
    
    configCache.set(cacheKey, config)
    configLastFetch.set(cacheKey, now)
    return config
  } catch (error) {
    console.error('Error fetching AI config:', error)
    return {
      business_info: "We are available to help you.",
      tone: "professional"
    }
  }
}

// Simplified conversation handler
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed')
  }

  const callSid = req.body.CallSid || req.query.CallSid
  const userSaid = req.body.SpeechResult || 'nothing'
  const toNumber = req.query.To || req.body.To
  
  console.log('🗣️  CallSid:', callSid, 'User said:', userSaid, 'To:', toNumber)
  
  // Get AI configuration based on the number being called
  const config = await getAIConfig(toNumber)
  const businessInfo = config.business_info || "We are available to help you."
  
  const baseUrl = `https://${req.headers.host}`
  
  // Simple keyword-based responses using business info
  let response = "I heard you. "
  
  const lowerSaid = userSaid.toLowerCase()
  
  if (lowerSaid.includes('hours') || lowerSaid.includes('open')) {
    response = businessInfo + " Is there anything else I can help you with?"
  } else if (lowerSaid.includes('appointment') || lowerSaid.includes('schedule')) {
    response = "I'd be happy to help you schedule an appointment! Let me take your information and someone will call you back. What's your name?"
  } else if (lowerSaid.includes('price') || lowerSaid.includes('cost') || lowerSaid.includes('much')) {
    response = "For pricing information, I'll have someone call you back. Can I get your phone number?"
  } else if (lowerSaid.includes('hello') || lowerSaid.includes('hi')) {
    response = "Hello! How can I help you today?"
  } else if (lowerSaid.includes('thank')) {
    response = "You're very welcome! Is there anything else I can help you with?"
  } else if (lowerSaid.includes('bye') || lowerSaid.includes('goodbye')) {
    response = "Thanks for calling! Have a wonderful day!"
  } else if (lowerSaid.includes('info') || lowerSaid.includes('about')) {
    response = businessInfo
  } else {
    response = "Thanks for that. How else can I help you today?"
  }
  
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${response}</Say>
  <Gather input="speech" timeout="5" speechTimeout="auto" action="${baseUrl}/api/conversation?CallSid=${callSid}&To=${encodeURIComponent(toNumber || '')}">
    <Say voice="Polly.Joanna">I'm still listening...</Say>
  </Gather>
  <Say voice="Polly.Joanna">Thanks for calling! Have a great day!</Say>
  <Hangup/>
</Response>`

  res.setHeader('Content-Type', 'text/xml')
  res.status(200).send(twiml)
}
