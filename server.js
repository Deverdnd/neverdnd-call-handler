const express = require('express')
const app = express()

app.use(express.urlencoded({ extended: true }))
app.use(express.json())

// Initial greeting endpoint
app.post('/call', (req, res) => {
  console.log('📞 Incoming call from:', req.body.From)
  
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Hi! Thanks for calling Never D N D, your A I phone answering service. I'm an A I assistant. How can I help you today?</Say>
  <Gather input="speech" timeout="5" speechTimeout="auto" action="https://neverdnd-test-call.ngrok.io/conversation">
    <Say voice="Polly.Joanna">I'm listening...</Say>
  </Gather>
  <Say voice="Polly.Joanna">Sorry, I didn't hear anything. Goodbye!</Say>
  <Hangup/>
</Response>`

  res.type('text/xml')
  res.send(twiml)
})

// Conversation endpoint
app.post('/conversation', (req, res) => {
  const userSaid = req.body.SpeechResult || 'nothing'
  console.log('🗣️  User said:', userSaid)
  
  // Simple responses based on keywords
  let response = "I heard you say: " + userSaid + ". "
  
  if (userSaid.toLowerCase().includes('hours') || userSaid.toLowerCase().includes('open')) {
    response = "We're open Monday through Friday, 9 AM to 5 PM. Is there anything else I can help you with?"
  } else if (userSaid.toLowerCase().includes('appointment') || userSaid.toLowerCase().includes('schedule')) {
    response = "I'd be happy to help you schedule an appointment! Let me take your name and phone number, and someone will call you back shortly to confirm. What's your name?"
  } else if (userSaid.toLowerCase().includes('price') || userSaid.toLowerCase().includes('cost')) {
    response = "For pricing information, I'll have someone from our team call you back. Can I get your phone number?"
  } else if (userSaid.toLowerCase().includes('hello') || userSaid.toLowerCase().includes('hi')) {
    response = "Hello! How can I help you today?"
  } else {
    response = "Thanks for that information. Is there anything else I can help you with?"
  }
  
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${response}</Say>
  <Gather input="speech" timeout="5" speechTimeout="auto" action="https://neverdnd-test-call.ngrok.io/conversation">
    <Say voice="Polly.Joanna">I'm still listening...</Say>
  </Gather>
  <Say voice="Polly.Joanna">Thanks for calling Never D N D! Have a great day!</Say>
  <Hangup/>
</Response>`

  res.type('text/xml')
  res.send(twiml)
})

// Status callback endpoint
app.post('/status', (req, res) => {
  console.log('📊 Call status:', req.body.CallStatus)
  res.send('OK')
})

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'running',
    message: 'NeverDND Call Handler Test Server',
    endpoints: ['/call', '/conversation', '/status']
  })
})

const PORT = process.env.PORT || 3002
app.listen(PORT, () => {
  console.log(`\n🎉 Call handler test server running on port ${PORT}`)
  console.log(`📞 Webhook URL: http://localhost:${PORT}/call`)
  console.log(`\n💡 To expose with ngrok: ngrok http ${PORT}`)
})
