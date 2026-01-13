const OpenAI = require('openai')

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

async function generateAIResponse(userMessage, businessConfig, conversationHistory = []) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.log('⚠️  No OpenAI API key, using fallback')
      return generateFallbackResponse(userMessage, businessConfig)
    }

    // Build system prompt from business configuration
    const systemPrompt = `You are an AI phone assistant for ${businessConfig.business_info || 'a business'}.

Your personality: ${businessConfig.tone || 'professional'}

Business Information:
${businessConfig.business_info}

Additional Instructions:
${businessConfig.additional_instructions || 'None'}

Rules:
1. Keep responses under 50 words
2. Be helpful and friendly
3. If you don't know something, say you'll have someone call back
4. Never make up information
5. Stay on topic - you're a phone assistant`

    // Build conversation messages
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ]

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Fast and cost-effective
      messages: messages,
      max_tokens: 150,
      temperature: 0.7
    })

    return completion.choices[0].message.content
  } catch (error) {
    console.error('❌ OpenAI API error:', error)
    return generateFallbackResponse(userMessage, businessConfig)
  }
}

function generateFallbackResponse(userMessage, businessConfig) {
  const lowerMessage = userMessage.toLowerCase()
  
  if (lowerMessage.includes('hours') || lowerMessage.includes('open')) {
    return businessConfig.business_info || "I can help you with that. Let me get someone to call you back with our hours."
  }
  
  if (lowerMessage.includes('appointment') || lowerMessage.includes('schedule') || lowerMessage.includes('book')) {
    return "I'd be happy to help you schedule an appointment. Can I get your name and phone number?"
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
