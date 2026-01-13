module.exports = (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed')
  }

  const userSaid = req.body.SpeechResult || 'nothing'
  console.log('🗣️  User said:', userSaid)
  
  const baseUrl = `https://${req.headers.host}`
  
  // Simple keyword-based responses
  let response = "I heard you. "
  
  const lowerSaid = userSaid.toLowerCase()
  
  if (lowerSaid.includes('hours') || lowerSaid.includes('open')) {
    response = "We're open Monday through Friday, 9 AM to 5 PM. Is there anything else I can help you with?"
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
  } else {
    response = "Thanks for that. How else can I help you today?"
  }
  
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${response}</Say>
  <Gather input="speech" timeout="5" speechTimeout="auto" action="${baseUrl}/api/conversation">
    <Say voice="Polly.Joanna">I'm still listening...</Say>
  </Gather>
  <Say voice="Polly.Joanna">Thanks for calling Never D N D! Have a great day!</Say>
  <Hangup/>
</Response>`

  res.setHeader('Content-Type', 'text/xml')
  res.status(200).send(twiml)
}
