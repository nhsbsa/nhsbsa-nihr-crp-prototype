// lib/progress.js
function ensureSession(req) {
  const data = req.session.data || (req.session.data = {})
  data.taskStatus = data.taskStatus || {}
  data.meta = data.meta || {}
  return data
}

function markInProgress(req, key) {
  const data = ensureSession(req)
  if (data.taskStatus[key] !== 'completed') data.taskStatus[key] = 'in progress'
}

function markComplete(req, key) {
  const data = ensureSession(req)
  data.taskStatus[key] = 'completed'
  data.meta.lastSaved = new Date().toLocaleString('en-GB', { hour12: false })
}

module.exports = { markInProgress, markComplete }
