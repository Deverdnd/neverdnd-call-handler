const { canUseScheduling, createAppointment, sendAppointmentEmail, sendAppointmentSMS, logFeatureUsage } = require('./subscriptions')

/**
 * Enhanced AI system prompt for appointment scheduling
 */
function getSchedulingSystemPrompt(businessName, businessInfo, canSchedule) {
  const basePrompt = `You are an AI assistant for ${businessName}. ${businessInfo}

Your role is to be helpful, professional, and efficient.`

  if (!canSchedule) {
    return basePrompt + `

If a customer asks to schedule an appointment, politely inform them that you can take a message and someone will call them back to schedule. Ask for their name and phone number.`
  }

  return basePrompt + `

IMPORTANT SCHEDULING CAPABILITIES:
You CAN schedule appointments! When a customer wants to book an appointment:

1. First, ask what service they need
2. Then ask when they'd like to come in (day and time)
3. Get their name
4. Get their phone number
5. For auto shops: ask about their vehicle (year, make, model)
6. Ask if they have any special requests or concerns

Once you have all this information, respond with EXACTLY this format:

SCHEDULE_APPOINTMENT
Service: [service type]
Date: [YYYY-MM-DD format]
Time: [HH:MM format in 24-hour]
Name: [customer name]
Phone: [phone number]
Vehicle: [year make model] (if applicable)
Notes: [any special notes]
END_APPOINTMENT

Example:
SCHEDULE_APPOINTMENT
Service: Oil Change
Date: 2026-01-17
Time: 14:00
Name: John Smith
Phone: (605) 555-9999
Vehicle: 2018 Honda Civic
Notes: Customer mentioned slight engine noise
END_APPOINTMENT

Be conversational and natural while collecting this information!`
}

/**
 * Parse appointment details from AI response
 */
function parseAppointmentFromResponse(aiResponse) {
  const scheduleMatch = aiResponse.match(/SCHEDULE_APPOINTMENT([\s\S]*?)END_APPOINTMENT/)
  
  if (!scheduleMatch) {
    return null
  }

  const appointmentText = scheduleMatch[1]
  const lines = appointmentText.split('\n').filter(line => line.trim())

  const appointment = {}
  
  for (const line of lines) {
    const [key, ...valueParts] = line.split(':')
    const value = valueParts.join(':').trim()
    
    if (key && value) {
      const cleanKey = key.trim().toLowerCase()
      appointment[cleanKey] = value
    }
  }

  return appointment
}

/**
 * Process appointment scheduling from conversation
 */
async function processAppointmentScheduling(callSid, businessId, aiResponse, customerPhone) {
  try {
    const appointmentData = parseAppointmentFromResponse(aiResponse)
    
    if (!appointmentData) {
      return null // No appointment to schedule
    }

    console.log('Parsed appointment data:', appointmentData)

    // Parse vehicle info if present
    let vehicleInfo = null
    if (appointmentData.vehicle) {
      const vehicleParts = appointmentData.vehicle.split(' ')
      if (vehicleParts.length >= 3) {
        vehicleInfo = {
          year: vehicleParts[0],
          make: vehicleParts[1],
          model: vehicleParts.slice(2).join(' ')
        }
      }
    }

    // Create the appointment
    const result = await createAppointment({
      businessId: businessId,
      customerName: appointmentData.name,
      customerPhone: appointmentData.phone || customerPhone,
      serviceType: appointmentData.service,
      date: appointmentData.date,
      time: appointmentData.time,
      vehicleInfo: vehicleInfo,
      notes: appointmentData.notes,
      callSid: callSid,
      duration: 60
    })

    if (result.success) {
      console.log('Appointment created successfully:', result.appointment.id)
      
      // Send notifications
      await sendAppointmentEmail(businessId, result.appointment)
      await sendAppointmentSMS(businessId, result.appointment)
      
      // Log feature usage
      await logFeatureUsage(businessId, 'appointment_scheduled', {
        service_type: appointmentData.service,
        call_sid: callSid
      })

      return {
        success: true,
        appointmentId: result.appointment.id,
        confirmationMessage: `Perfect! I've scheduled your ${appointmentData.service} for ${appointmentData.date} at ${appointmentData.time}. You'll receive a confirmation text shortly.`
      }
    } else {
      console.error('Failed to create appointment:', result.error)
      return {
        success: false,
        error: result.error
      }
    }
  } catch (error) {
    console.error('Error processing appointment:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

module.exports = {
  getSchedulingSystemPrompt,
  parseAppointmentFromResponse,
  processAppointmentScheduling
}
