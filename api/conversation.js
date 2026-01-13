const { createClient } = require('@supabase/supabase-js')

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Cache for AI config
let configCache = null
let configLastFetch = 0
const CONFIG_CACHE_TTL = 5 * 60 * 1000

async function getAIConfig() {
  const now = Date.now()
  if (configCache && (now - configLastFetch) < CONFIG_CACHE_TTL) {
    return configCache
  }
  
  try {
    const { data, error } = await supabase
      .from('ai_config')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    if (error) throw error
    
    configCache = data
    configLastFetch = now
    return data
  } catch (error) {
    console.error('Error fetching AI config:', error)
    return {
      greeting: "Hi!",
      business_info: "We are available 24/7.",
      tone: "professional",
      additional_instructions: ""
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
  
  console.log('🗣️  CallSid:', callSid, 'User said:', userSaid)
  
  // Get AI configuration
  const config = await getAIConfig()
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
  <Gather input="speech" timeout="5" speechTimeout="auto" action="${baseUrl}/api/conversation?CallSid=${callSid}">
    <Say voice="Polly.Joanna">I'm still listening...</Say>
  </Gather>
  <Say voice="Polly.Joanna">Thanks for calling! Have a great day!</Say>
  <Hangup/>
</Response>`

  res.setHeader('Content-Type', 'text/xml')
  res.status(200).send(twiml)
}
