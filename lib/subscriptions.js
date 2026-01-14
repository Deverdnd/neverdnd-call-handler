const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

/**
 * Check if a business has access to appointment scheduling
 * Based on their subscription tier
 */
async function canUseScheduling(businessId) {
  try {
    // Get business subscription
    const { data: business } = await supabase
      .from('businesses')
      .select('subscription_id')
      .eq('id', businessId)
      .single()

    if (!business || !business.subscription_id) {
      return false // No subscription = no scheduling
    }

    // Get subscription with plan details
    const { data: subscription } = await supabase
      .from('customer_subscriptions')
      .select(`
        *,
        subscription_plans (slug)
      `)
      .eq('id', business.subscription_id)
      .single()

    if (!subscription) {
      return false
    }

    // Check if plan supports scheduling
    // Basic tier = no scheduling
    // Professional & Enterprise = yes scheduling
    const planSlug = subscription.subscription_plans?.slug
    
    return planSlug === 'professional' || planSlug === 'enterprise'
  } catch (error) {
    console.error('Error checking scheduling access:', error)
    return false
  }
}

/**
 * Create an appointment in the database
 */
async function createAppointment(appointmentData) {
  try {
    const { data, error } = await supabase
      .from('appointments')
      .insert({
        business_id: appointmentData.businessId,
        customer_name: appointmentData.customerName,
        customer_phone: appointmentData.customerPhone,
        customer_email: appointmentData.customerEmail || null,
        service_type: appointmentData.serviceType,
        appointment_date: appointmentData.date,
        appointment_time: appointmentData.time,
        duration_minutes: appointmentData.duration || 60,
        vehicle_info: appointmentData.vehicleInfo || null,
        notes: appointmentData.notes || null,
        call_sid: appointmentData.callSid,
        status: 'scheduled',
        created_by: 'ai'
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating appointment:', error)
      return { success: false, error: error.message }
    }

    return { success: true, appointment: data }
  } catch (error) {
    console.error('Error creating appointment:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Send email notification about new appointment
 */
async function sendAppointmentEmail(businessId, appointment) {
  try {
    // Get business details
    const { data: business } = await supabase
      .from('businesses')
      .select('name, notification_phone')
      .eq('id', businessId)
      .single()

    if (!business) {
      console.error('Business not found for email notification')
      return
    }

    // In a production environment, you would integrate with an email service here
    // For now, we'll log the email content and send SMS instead
    
    const emailContent = `
🚗 NEW APPOINTMENT SCHEDULED

Business: ${business.name}
Customer: ${appointment.customer_name}
Phone: ${appointment.customer_phone}
Service: ${appointment.service_type}
Date: ${appointment.appointment_date}
Time: ${appointment.appointment_time}
${appointment.vehicle_info ? `Vehicle: ${appointment.vehicle_info.year} ${appointment.vehicle_info.make} ${appointment.vehicle_info.model}` : ''}
${appointment.notes ? `Notes: ${appointment.notes}` : ''}

Status: SCHEDULED
View in dashboard: https://admin-nu-flame.vercel.app/appointments
    `

    console.log('Appointment Email:', emailContent)

    // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
    // For now, return success
    return { success: true }
  } catch (error) {
    console.error('Error sending appointment email:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Send SMS confirmation to customer
 */
async function sendAppointmentSMS(businessId, appointment) {
  try {
    // Get business details
    const { data: business } = await supabase
      .from('businesses')
      .select('name')
      .eq('id', businessId)
      .single()

    if (!business) {
      console.error('Business not found for SMS confirmation')
      return
    }

    const smsMessage = `${business.name} confirmed your ${appointment.service_type} for ${appointment.appointment_date} at ${appointment.appointment_time}. See you then!`

    console.log('Appointment SMS:', smsMessage)
    console.log('To:', appointment.customer_phone)

    // TODO: Integrate with Twilio SMS
    // const twilioClient = require('twilio')(accountSid, authToken)
    // await twilioClient.messages.create({
    //   body: smsMessage,
    //   from: process.env.TWILIO_PHONE_NUMBER,
    //   to: appointment.customer_phone
    // })

    return { success: true }
  } catch (error) {
    console.error('Error sending appointment SMS:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Log feature usage for analytics
 */
async function logFeatureUsage(businessId, featureName, metadata = {}) {
  try {
    await supabase
      .from('feature_usage')
      .insert({
        business_id: businessId,
        feature_name: featureName,
        metadata: metadata
      })
  } catch (error) {
    console.error('Error logging feature usage:', error)
  }
}

module.exports = {
  canUseScheduling,
  createAppointment,
  sendAppointmentEmail,
  sendAppointmentSMS,
  logFeatureUsage
}
