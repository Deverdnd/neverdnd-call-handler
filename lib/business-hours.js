// Business hours checker

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
  
  // If business has no forward number, always use AI
  if (!businessConfig.forward_number) return true
  
  // If after hours, use AI
  if (!isWithinBusinessHours(businessConfig)) return true
  
  // If business hours and they want AI during hours
  if (businessConfig.use_ai_during_hours) return true
  
  // Otherwise, don't use AI (forward to their phone)
  return false
}

module.exports = {
  isWithinBusinessHours,
  shouldRouteToAI
}
