// In-memory store for active calls (tracks conversation during the call)
const activeCalls = new Map()

/**
 * Start tracking a new call
 */
function startCall(callSid, callData) {
  activeCalls.set(callSid, {
    callSid,
    from: callData.From,
    to: callData.To,
    startTime: new Date(),
    transcript: [],
    status: 'in-progress'
  })
  console.log(`📞 Started tracking call: ${callSid}`)
}

/**
 * Add a message to the call transcript
 */
function addToTranscript(callSid, speaker, message) {
  const call = activeCalls.get(callSid)
  if (call) {
    call.transcript.push({
      speaker,
      message,
      timestamp: new Date()
    })
    console.log(`💬 Added to transcript [${speaker}]: ${message}`)
  }
}

/**
 * Get call data
 */
function getCall(callSid) {
  return activeCalls.get(callSid)
}

/**
 * End call tracking and return final data
 */
function endCall(callSid) {
  const call = activeCalls.get(callSid)
  if (call) {
    call.endTime = new Date()
    call.duration = Math.floor((call.endTime - call.startTime) / 1000) // seconds
    call.status = 'completed'
    
    // Format transcript as readable text
    call.transcriptText = call.transcript
      .map(t => `${t.speaker}: ${t.message}`)
      .join('\n')
    
    console.log(`✅ Call ended: ${callSid} (${call.duration}s)`)
    
    // Remove from active calls after a delay (in case we need it)
    setTimeout(() => {
      activeCalls.delete(callSid)
      console.log(`🗑️  Removed call from memory: ${callSid}`)
    }, 60000) // Keep for 1 minute
    
    return call
  }
  return null
}

module.exports = {
  startCall,
  addToTranscript,
  getCall,
  endCall
}
