module.exports = (req, res) => {
  console.log('📊 Call status:', req.body.CallStatus)
  res.status(200).send('OK')
}
