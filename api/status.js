const { endCall } = require('../lib/callTracker')
const { logCall, generateSummary } = require('../lib/database')

module.exports = async (req, res) => {
  const callSid = req.body.CallSid
  const callStatus = req.body.CallStatus
  const callDuration = req.body.CallDuration
  const recordingUrl = req.body.RecordingUrl
  
  console.log('📊 Call status:', callStatus, 'CallSid:', callSid)
  
  // When call is completed, save to database
  if (callStatus === 'completed') {
    const callData = endCall(callSid)
    
    if (callData) {
      console.log('💾 Saving call to database...')
      
      // Generate AI summary of the conversation
      let summary = 'No conversation recorded'
      if (callData.transcriptText && callData.transcriptText.length > 10) {
        summary = await generateSummary(callData.transcriptText)
      }
      
      // Save to database
      await logCall({
        from: callData.from,
        to: callData.to,
        status: callStatus,
        duration: parseInt(callDuration) || callData.duration || 0,
        transcript: callData.transcriptText || 'No transcript available',
        summary: summary,
        recordingUrl: recordingUrl || null,
        businessId: null // Will assign to business later when we have auth
      })
      
      console.log('✅ Call saved successfully!')
    } else {
      console.log('⚠️  No call data found for:', callSid)
    }
  }
  
  res.status(200).send('OK')
}
