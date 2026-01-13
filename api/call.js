// Simplified call handler - just starts the call
module.exports = (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed')
  }

  const callSid = req.body.CallSid
  const from = req.body.From
  const to = req.body.To

  console.log('📞 Incoming call - CallSid:', callSid, 'From:', from)
  
  const baseUrl = `https://${req.headers.host}`
  
  const greeting = "Hi! Thanks for calling Never D N D, your A I phone answering service. How can I help you today?"
  
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
