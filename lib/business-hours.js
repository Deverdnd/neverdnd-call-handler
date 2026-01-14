// Business hours checker with flexible AI routing modes

/**
 * AI Routing Modes:
 * - 'after-hours-only': AI only when business is closed (default)
 * - '24/7': AI always answers, never forwards
 * - 'business-hours-only': AI only during business hours, forward after hours
 * - 'disabled': Never use AI, always forward (if forward number exists)
 * - 'custom': Use custom schedule defined in ai_schedule field
 */

function isWithinBusinessHours(businessConfig) {
  if (!businessConfig) return false
  
  const now = new Date()
  const day = now.getDay() // 0 = Sunday, 6 = Saturday
  const hour = now.getHours()
  const minute = now.getMinutes()
  
  // Default hours if not specified
  const hours = businessConfig.business_hours || {
    monday: { open: '09:00', close: '17:00', closed: false },
    tuesday: { open: '09:00', close: '17:00', closed: false },
    wednesday: { open: '09:00', close: '17:00', closed: false },
    thursday: { open: '09:00', close: '17:00', closed: false },
    friday: { open: '09:00', close: '17:00', closed: false },
    saturday: { open: '10:00', close: '14:00', closed: false },
    sunday: { closed: true }
  }
  
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const todayHours = hours[dayNames[day]]
  
  // If closed today
  if (todayHours.closed) return false
  
  // Parse open/close times
  const [openHour, openMin] = todayHours.open.split(':').map(Number)
  const [closeHour, closeMin] = todayHours.close.split(':').map(Number)
  
  const currentMinutes = hour * 60 + minute
  const openMinutes = openHour * 60 + openMin
  const closeMinutes = closeHour * 60 + closeMin
  
  return currentMinutes >= openMinutes && currentMinutes < closeMinutes
}

function shouldRouteToAI(businessConfig) {
  // If no business config, always use AI
  if (!businessConfig) return true
  
  // If business has no forward number, always use AI (can't forward anywhere)
  if (!businessConfig.forward_number) return true
  
  // Get AI routing mode (default to 'after-hours-only' for backward compatibility)
  const aiMode = businessConfig.ai_routing_mode || 
                 (businessConfig.use_ai_during_hours ? '24/7' : 'after-hours-only')
  
  const withinHours = isWithinBusinessHours(businessConfig)
  
  switch (aiMode) {
    case '24/7':
      // AI always answers, never forwards
      return true
      
    case 'after-hours-only':
      // AI only when business is closed (default behavior)
      return !withinHours
      
    case 'business-hours-only':
      // AI only during business hours, forward after hours
      return withinHours
      
    case 'disabled':
      // Never use AI, always forward
      return false
      
    case 'custom':
      // Use custom AI schedule if defined
      return isWithinCustomAISchedule(businessConfig)
      
    default:
      // Fallback to after-hours-only
      return !withinHours
  }
}

function isWithinCustomAISchedule(businessConfig) {
  if (!businessConfig.ai_schedule) {
    // No custom schedule, fallback to after-hours
    return !isWithinBusinessHours(businessConfig)
  }
  
  const now = new Date()
  const day = now.getDay()
  const hour = now.getHours()
  const minute = now.getMinutes()
  
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const todaySchedule = businessConfig.ai_schedule[dayNames[day]]
  
  // If AI not enabled today, return false (will forward)
  if (!todaySchedule || !todaySchedule.enabled) return false
  
  // Parse AI active times
  const [startHour, startMin] = todaySchedule.start.split(':').map(Number)
  const [endHour, endMin] = todaySchedule.end.split(':').map(Number)
  
  const currentMinutes = hour * 60 + minute
  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin
  
  return currentMinutes >= startMinutes && currentMinutes < endMinutes
}

module.exports = {
  isWithinBusinessHours,
  shouldRouteToAI,
  isWithinCustomAISchedule
}
