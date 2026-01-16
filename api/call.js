const { createClient } = require('@supabase/supabase-js')
const { checkRateLimit } = require('../lib/rateLimit')
const { shouldRouteToAI } = require('../lib/business-hours')
const logger = require('../lib/logger')

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Cache for AI config (refresh every 30 seconds for quick updates)
// Last updated: 2026-01-16 01:10 UTC
let configCache = new Map()
let configLastFetch = new Map()
const CONFIG_CACHE_TTL = 30 * 1000 // 30 seconds

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
        greeting: "Hi! Thanks for calling Never D N D. How can I help you today?",
        business_info: "We are available 24/7.",
        tone: "professional"
      }
    }
    
    configCache.set(cacheKey, config)
    configLastFetch.set(cacheKey, now)
    return config
  } catch (error) {
    console.error('Error fetching AI config:', error)
    return {
      greeting: "Hi! Thanks for calling. How can I help you today?",
      business_info: "We are available to help you.",
      tone: "professional"
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

  // Rate limiting by phone number
  const rateLimit = checkRateLimit(from)
  if (!rateLimit.allowed) {
    logger.warn('Rate limit exceeded', { from, callSid })
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">We're sorry, but you've made too many calls in a short time. Please try again later.</Say>
  <Hangup/>
</Response>`
    res.setHeader('Content-Type', 'text/xml')
    return res.status(429).send(twiml)
  }

  logger.info('Incoming call', { callSid, from, to, remainingRequests: rateLimit.remaining })
  
  // Get business configuration
  let business = null
  try {
    const { data: businessData } = await supabase
      .from('businesses')
      .select('*')
      .eq('phone_number', to)
      .single()
    
    business = businessData
    logger.info('Business found', { businessName: business?.name, aiMode: business?.ai_routing_mode })
  } catch (error) {
    logger.warn('No business found for number', { to })
  }
  
  // TEMPORARY: Force AI routing for debugging
  logger.info('FORCING AI ROUTING FOR DEBUGGING')
  const shouldForward = false; // Force to false for testing
  
  // Check if we should route to AI or forward to business
  if (shouldForward) {
    // Forward to business phone
    logger.info('Forwarding to business phone', { forwardTo: business.forward_number })
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${to}">${business.forward_number}</Dial>
</Response>`
    
    res.setHeader('Content-Type', 'text/xml')
    return res.status(200).send(twiml)
  }
  
  // Otherwise, route to AI
  logger.info('Routing to AI', { business: business?.name || 'default', businessId: business?.id, toNumber: to })
  
  // Get AI configuration based on the number being called
  const config = await getAIConfig(to)
  logger.info('AI Config loaded', { greeting: config?.greeting, businessInfo: config?.business_info })
  const greeting = config.greeting || "Hi! Thanks for calling. How can I help you today?"
  
  const baseUrl = `https://${req.headers.host}`
  
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${greeting}</Say>
  <Gather input="speech" timeout="5" speechTimeout="auto" action="${baseUrl}/api/conversation?CallSid=${callSid}&To=${encodeURIComponent(to)}">
    <Say voice="Polly.Joanna">I'm listening...</Say>
  </Gather>
  <Say voice="Polly.Joanna">Sorry, I didn't hear anything. Goodbye!</Say>
  <Hangup/>
</Response>`

  res.setHeader('Content-Type', 'text/xml')
  res.status(200).send(twiml)
}
