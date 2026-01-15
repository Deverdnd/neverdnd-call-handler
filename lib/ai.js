const OpenAI = require('openai')
const { getSchedulingSystemPrompt } = require('./appointment-handler')

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

async function generateAIResponse(userMessage, businessConfig, conversationHistory = [], canSchedule = false) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.log('⚠️  No OpenAI API key, using fallback')
      return generateFallbackResponse(userMessage, businessConfig, canSchedule)
    }

    // Build enhanced system prompt with scheduling capabilities
    const systemPrompt = getSchedulingSystemPrompt(
      businessConfig.business_name || 'our business',
      businessConfig.business_info || 'We are here to help you.',
      canSchedule,
      businessConfig.tone || 'professional',
      businessConfig.additional_instructions || ''
    )

    // Build conversation messages
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ]

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Fast and cost-effective
      messages: messages,
      max_tokens: 250, // Increased for scheduling responses
      temperature: 0.7
    })

    return completion.choices[0].message.content
  } catch (error) {
    console.error('❌ OpenAI API error:', error)
    return generateFallbackResponse(userMessage, businessConfig, canSchedule)
  }
}

function generateFallbackResponse(userMessage, businessConfig, canSchedule = false) {
  const lowerMessage = userMessage.toLowerCase()
  
  if (lowerMessage.includes('hours') || lowerMessage.includes('open')) {
    return businessConfig.business_info || "I can help you with that. Let me get someone to call you back with our hours."
  }
  
  if (lowerMessage.includes('appointment') || lowerMessage.includes('schedule') || lowerMessage.includes('book')) {
    if (canSchedule) {
      return "I can help you schedule an appointment! What service do you need?"
    } else {
      return "I'd be happy to take your information and have someone call you back to schedule. What's your name and phone number?"
    }
  }
  
  if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('how much')) {
    return "For pricing information, I'll have someone call you back. What's the best number to reach you?"
  }
  
  if (lowerMessage.includes('location') || lowerMessage.includes('address') || lowerMessage.includes('where')) {
    return businessConfig.business_info || "I'll have someone call you back with our location details."
  }
  
  if (lowerMessage.includes('thank')) {
    return "You're very welcome! Is there anything else I can help you with?"
  }
  
  if (lowerMessage.includes('bye') || lowerMessage.includes('goodbye')) {
    return "Thanks for calling! Have a great day!"
  }
  
  // Default response
  return "I understand. How else can I help you today?"
}

module.exports = {
  generateAIResponse
}
