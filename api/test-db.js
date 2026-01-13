const { createClient } = require('@supabase/supabase-js')

module.exports = async (req, res) => {
  try {
    console.log('🧪 Test endpoint called')
    console.log('Environment check:', {
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_SERVICE_KEY,
      url: process.env.SUPABASE_URL
    })
    
    // Initialize Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    )
    
    console.log('✅ Supabase client created')
    
    // Try to insert a test call
    const testData = {
      from_number: '+15551234567',
      to_number: '+16053075572',
      status: 'completed',
      duration: 42,
      transcript: 'Test call transcript',
      summary: 'This is a test call',
      recording_url: null,
      business_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    console.log('📝 Attempting to insert:', testData)
    
    const { data, error } = await supabase
      .from('calls')
      .insert(testData)
      .select()
    
    if (error) {
      console.error('❌ Database error:', error)
      return res.status(500).json({ success: false, error: error.message })
    }
    
    console.log('✅ Insert successful:', data)
    
    res.status(200).json({ 
      success: true, 
      message: 'Test call logged successfully',
      data: data
    })
    
  } catch (error) {
    console.error('❌ Exception:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}
