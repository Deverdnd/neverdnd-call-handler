const { createClient } = require('@supabase/supabase-js')

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Cache for AI config (refresh every 5 minutes)
let configCache = null
let configLastFetch = 0
const CONFIG_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

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
    // Return default config
    return {
      greeting: "Hi! Thanks for calling Never D N D, your A I phone answering service. How can I help you today?",
      business_info: "We are an AI phone answering service available 24/7.",
      tone: "professional",
      additional_instructions: ""
    }
  }
}

// Simplified call handler - just starts the call
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed')
  }

  const callSid = req.body.CallSid
  const from = req.body.From
  const to = req.body.To

  console.log('📞 Incoming call - CallSid:', callSid, 'From:', from)
  
  // Get AI configuration
  const config = await getAIConfig()
  const greeting = config.greeting || "Hi! Thanks for calling Never D N D. How can I help you today?"
  
  const baseUrl = `https://${req.headers.host}`
  
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${greeting}</Say>
  <Gather input="speech" timeout="5" speechTimeout="auto" action="${baseUrl}/api/conversation?CallSid=${callSid}">
    <Say voice="Polly.Joanna">I'm listening...</Say>
  </Gather>
  <Say voice="Polly.Joanna">Sorry, I didn't hear anything. Goodbye!</Say>
  <Hangup/>
</Response>`

  res.setHeader('Content-Type', 'text/xml')
  res.status(200).send(twiml)
}
